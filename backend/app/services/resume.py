"""
Resume and cover letter generation service.
Orchestrates AI calls, PDF generation, and database persistence.
"""
import io
import json
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import Job
from app.models.profile import UserProfile
from app.models.resume import CoverLetter, Resume
from app.models.user import User
from app.services.ai import get_llm_client
from app.services.profile_utils import build_profile_text
from app.services.prompt_assembly import assemble_prompt
from app.services.settings import get_or_create_settings, get_decrypted_key

# ── Prompts ───────────────────────────────────────────────────────────────────

RESUME_SYSTEM = """You are an expert resume writer who creates tailored, ATS-optimized resumes.
Output ONLY valid JSON matching this exact schema — no markdown, no extra text:
{
  "contact": {"name": string, "email": string, "phone": string, "location": string, "linkedin": string},
  "summary": string,
  "experience": [{"title": string, "company": string, "location": string, "start": string, "end": string, "bullets": [string]}],
  "education": [{"degree": string, "institution": string, "year": string}],
  "skills": [string],
  "certifications": [string]
}"""

RESUME_USER_TEMPLATE = """Create a tailored resume for this job posting.

JOB TITLE: {job_title}
COMPANY: {company}
JOB DESCRIPTION:
{job_description}

Use professional language. Highlight relevant skills. Keep bullets action-oriented with metrics where possible.
If specific experience is unknown, create realistic but generic content appropriate for the role."""

ATS_SYSTEM = """You are an ATS (Applicant Tracking System) expert. Analyze resumes against job descriptions.
Output ONLY valid JSON:
{
  "score": number (0-100),
  "matched_keywords": [string],
  "missing_keywords": [string],
  "formatting_issues": [string],
  "suggestions": [string]
}"""

ATS_USER_TEMPLATE = """Analyze this resume against the job description.

JOB DESCRIPTION:
{job_description}

RESUME:
{resume_text}

Score the ATS compatibility (0-100) and identify matched/missing keywords."""

GAP_SYSTEM = """You are a career coach analyzing resume-job fit.
Output ONLY valid JSON:
{
  "matching_skills": [string],
  "missing_skills": [string],
  "strengths": [string],
  "recommendations": [string]
}"""

GAP_USER_TEMPLATE = """Analyze the gap between this resume and the job requirements.

JOB DESCRIPTION:
{job_description}

RESUME:
{resume_text}"""

COVER_LETTER_SYSTEM = """You are an expert cover letter writer.
Write a professional, personalized cover letter (3-4 paragraphs, ~250-350 words).
Output only the cover letter text — no subject line, no JSON."""

COVER_LETTER_USER_TEMPLATE = """Write a cover letter for this job application.

JOB TITLE: {job_title}
COMPANY: {company}
JOB DESCRIPTION:
{job_description}

RESUME SUMMARY:
{resume_summary}

Make it specific, enthusiastic, and focused on value the candidate brings."""


# ── Helpers ───────────────────────────────────────────────────────────────────

def _resume_to_text(resume_json: dict) -> str:
    """Convert resume JSON to readable text for AI analysis."""
    parts = []
    contact = resume_json.get("contact", {})
    if contact.get("name"):
        parts.append(contact["name"])
    if resume_json.get("summary"):
        parts.append(resume_json["summary"])
    for exp in resume_json.get("experience", []):
        parts.append(f"{exp.get('title')} at {exp.get('company')}")
        parts.extend(exp.get("bullets", []))
    for edu in resume_json.get("education", []):
        parts.append(f"{edu.get('degree')} — {edu.get('institution')}")
    skills = resume_json.get("skills", [])
    if skills:
        parts.append("Skills: " + ", ".join(skills))
    return "\n".join(parts)


async def _get_job(db: AsyncSession, job_id: int, user: User) -> Optional[Job]:
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.user_id == user.id)
    )
    return result.scalar_one_or_none()


async def _get_llm(db: AsyncSession, user: User):
    settings = await get_or_create_settings(db, user)
    provider = settings.llm_provider or "openai"
    key_field = f"api_key_{provider}"
    api_key = get_decrypted_key(settings, key_field)
    if not api_key:
        raise ValueError(f"No API key configured for provider '{provider}'. Set it in Settings.")
    return get_llm_client(provider, api_key)


async def _load_profile_text(db: AsyncSession, user: User) -> str:
    """Load user profile and build text representation for LLM context."""
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        return ""
    return build_profile_text(profile)


async def _next_version(db: AsyncSession, job_id: int, model_class) -> int:
    result = await db.execute(
        select(model_class).where(model_class.job_id == job_id)
    )
    existing = result.scalars().all()
    return len(existing) + 1


# ── Resume generation ─────────────────────────────────────────────────────────

async def generate_resume(db: AsyncSession, user: User, job_id: int) -> Resume:
    job = await _get_job(db, job_id, user)
    if not job:
        raise ValueError("Job not found")

    job_description = job.description or f"Position: {job.title} at {job.company}"

    profile_text = await _load_profile_text(db, user)

    context = {
        "job_description": job_description,
        "job_title": job.title,
        "company": job.company,
    }
    if profile_text:
        context["user_profile"] = profile_text
        context["extra_instructions"] = (
            "Use the candidate's real profile data (skills, experience, education, contacts) "
            "to create the resume. Do NOT invent fictional experience."
        )
    else:
        context["extra_instructions"] = (
            "No candidate profile available. Create realistic but generic content appropriate for the role."
        )

    system_prompt, user_prompt = await assemble_prompt(db, user, "resume_generation", context)

    llm = await _get_llm(db, user)
    raw = await llm.generate(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
    )

    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    resume_json = json.loads(raw)

    version = await _next_version(db, job_id, Resume)
    resume = Resume(
        job_id=job_id,
        version=version,
        resume_json=resume_json,
    )
    db.add(resume)
    await db.commit()
    await db.refresh(resume)
    return resume


async def get_resumes(db: AsyncSession, user: User, job_id: int) -> list[Resume]:
    job = await _get_job(db, job_id, user)
    if not job:
        raise ValueError("Job not found")
    result = await db.execute(
        select(Resume)
        .where(Resume.job_id == job_id)
        .order_by(Resume.version.desc())
    )
    return list(result.scalars().all())


async def get_resume(db: AsyncSession, user: User, resume_id: int) -> Optional[Resume]:
    result = await db.execute(select(Resume).where(Resume.id == resume_id))
    resume = result.scalar_one_or_none()
    if not resume:
        return None
    # Verify ownership via job
    job = await _get_job(db, resume.job_id, user)
    return resume if job else None


def generate_pdf(resume_json: dict) -> bytes:
    """Generate a PDF from resume JSON using reportlab."""
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
    from reportlab.lib.enums import TA_CENTER, TA_LEFT

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()
    name_style = ParagraphStyle("Name", parent=styles["Title"], fontSize=18, spaceAfter=4, alignment=TA_CENTER)
    contact_style = ParagraphStyle("Contact", parent=styles["Normal"], fontSize=9, spaceAfter=8, alignment=TA_CENTER, textColor=colors.grey)
    section_style = ParagraphStyle("Section", parent=styles["Heading2"], fontSize=11, spaceAfter=4, spaceBefore=10, textColor=colors.HexColor("#333333"))
    body_style = ParagraphStyle("Body", parent=styles["Normal"], fontSize=10, spaceAfter=4, leading=14)
    bullet_style = ParagraphStyle("Bullet", parent=styles["Normal"], fontSize=10, spaceAfter=2, leading=13, leftIndent=12, bulletIndent=4)

    story = []

    # Header
    contact = resume_json.get("contact", {})
    if contact.get("name"):
        story.append(Paragraph(contact["name"], name_style))
    contact_parts = [v for k, v in contact.items() if k != "name" and v]
    if contact_parts:
        story.append(Paragraph(" | ".join(contact_parts), contact_style))

    # Summary
    if resume_json.get("summary"):
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
        story.append(Paragraph("SUMMARY", section_style))
        story.append(Paragraph(resume_json["summary"], body_style))

    # Experience
    experience = resume_json.get("experience", [])
    if experience:
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
        story.append(Paragraph("EXPERIENCE", section_style))
        for exp in experience:
            title_line = f"<b>{exp.get('title', '')}</b> — {exp.get('company', '')}"
            if exp.get("location"):
                title_line += f", {exp['location']}"
            dates = f"{exp.get('start', '')} – {exp.get('end', 'Present')}"
            story.append(Paragraph(f"{title_line} <font color='grey' size='9'>{dates}</font>", body_style))
            for bullet in exp.get("bullets", []):
                story.append(Paragraph(f"• {bullet}", bullet_style))
            story.append(Spacer(1, 4))

    # Education
    education = resume_json.get("education", [])
    if education:
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
        story.append(Paragraph("EDUCATION", section_style))
        for edu in education:
            line = f"<b>{edu.get('degree', '')}</b> — {edu.get('institution', '')}"
            if edu.get("year"):
                line += f" ({edu['year']})"
            story.append(Paragraph(line, body_style))

    # Skills
    skills = resume_json.get("skills", [])
    if skills:
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
        story.append(Paragraph("SKILLS", section_style))
        story.append(Paragraph(", ".join(skills), body_style))

    # Certifications
    certs = resume_json.get("certifications", [])
    if certs:
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
        story.append(Paragraph("CERTIFICATIONS", section_style))
        for cert in certs:
            story.append(Paragraph(f"• {cert}", bullet_style))

    doc.build(story)
    return buffer.getvalue()


# ── ATS Audit & Gap Analysis ──────────────────────────────────────────────────

async def run_ats_audit(db: AsyncSession, user: User, resume_id: int) -> Resume:
    resume = await get_resume(db, user, resume_id)
    if not resume:
        raise ValueError("Resume not found")

    await db.refresh(resume, ["job"])
    job = resume.job
    job_description = job.description or f"{job.title} at {job.company}"
    resume_text = _resume_to_text(resume.resume_json)

    profile_text = await _load_profile_text(db, user)
    context = {
        "job_description": job_description,
        "resume_text": resume_text,
    }
    if profile_text:
        context["user_profile"] = profile_text

    system_prompt, user_prompt = await assemble_prompt(db, user, "ats_audit", context)

    llm = await _get_llm(db, user)
    raw = await llm.generate(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
    )

    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    audit = json.loads(raw)

    resume.ats_score = int(audit.get("score", 0))
    resume.ats_audit_result = audit
    await db.commit()
    await db.refresh(resume)
    return resume


async def run_gap_analysis(db: AsyncSession, user: User, resume_id: int) -> Resume:
    resume = await get_resume(db, user, resume_id)
    if not resume:
        raise ValueError("Resume not found")

    await db.refresh(resume, ["job"])
    job = resume.job
    job_description = job.description or f"{job.title} at {job.company}"
    resume_text = _resume_to_text(resume.resume_json)

    profile_text = await _load_profile_text(db, user)
    context = {
        "job_description": job_description,
        "resume_text": resume_text,
    }
    if profile_text:
        context["user_profile"] = profile_text

    system_prompt, user_prompt = await assemble_prompt(db, user, "gap_analysis", context)

    llm = await _get_llm(db, user)
    raw = await llm.generate(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
    )

    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    gap = json.loads(raw)

    resume.gap_analysis = gap
    await db.commit()
    await db.refresh(resume)
    return resume


# ── Cover Letter ──────────────────────────────────────────────────────────────

async def generate_cover_letter(
    db: AsyncSession, user: User, job_id: int
) -> CoverLetter:
    job = await _get_job(db, job_id, user)
    if not job:
        raise ValueError("Job not found")

    # Use latest resume summary if available
    resumes = await get_resumes(db, user, job_id)
    resume_summary = ""
    if resumes:
        resume_summary = _resume_to_text(resumes[0].resume_json)[:1500]

    job_description = job.description or f"{job.title} at {job.company}"

    llm = await _get_llm(db, user)
    content = await llm.generate(
        system_prompt=COVER_LETTER_SYSTEM,
        user_prompt=COVER_LETTER_USER_TEMPLATE.format(
            job_title=job.title,
            company=job.company,
            job_description=job_description,
            resume_summary=resume_summary or "Experienced professional",
        ),
    )

    version = await _next_version(db, job_id, CoverLetter)
    cover_letter = CoverLetter(
        job_id=job_id,
        version=version,
        content=content.strip(),
    )
    db.add(cover_letter)
    await db.commit()
    await db.refresh(cover_letter)
    return cover_letter


async def get_cover_letters(
    db: AsyncSession, user: User, job_id: int
) -> list[CoverLetter]:
    job = await _get_job(db, job_id, user)
    if not job:
        raise ValueError("Job not found")
    result = await db.execute(
        select(CoverLetter)
        .where(CoverLetter.job_id == job_id)
        .order_by(CoverLetter.version.desc())
    )
    return list(result.scalars().all())
