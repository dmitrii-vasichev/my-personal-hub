"""Prompt assembly service — builds complete prompts for AI operations.

Two-layer architecture:
  Layer 1 (system_prompt): User's custom instruction (or default)
  Layer 2 (user_prompt): KB reference documents + context data + output format
"""
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.services.knowledge_base import get_documents_for_operation
from app.services.settings import get_or_create_settings


# Default instructions per operation — used when user has no custom instruction set.
DEFAULT_INSTRUCTIONS = {
    "resume_generation": (
        "You are an expert resume writer who creates tailored, ATS-optimized resumes. "
        "Output ONLY valid JSON matching the schema provided in the reference documents."
    ),
    "ats_audit": (
        "You are an ATS (Applicant Tracking System) expert. Analyze resumes against job descriptions. "
        "Output ONLY valid JSON with score, matched/missing keywords, and suggestions."
    ),
    "gap_analysis": (
        "You are a career coach analyzing resume-job fit. "
        "Output ONLY valid JSON with matching skills, missing skills, strengths, and recommendations."
    ),
    "cover_letter": (
        "You are an expert cover letter writer. Write a professional, personalized cover letter "
        "(3-4 paragraphs, 250-350 words). Output only the cover letter text."
    ),
    "job_matching": (
        "You are a career match analyst. Evaluate how well the candidate fits the job "
        "by rating each category on a 1-5 scale (1=no match, 2=weak, 3=partial, 4=strong, 5=excellent).\n\n"
        "Rating guidelines:\n"
        "- skills_match: What fraction of required hard/soft skills does the candidate have? "
        "1=<20%, 2=20-40%, 3=40-60%, 4=60-80%, 5=>80%\n"
        "- experience_level: Does the candidate's years and depth of experience match the role? "
        "1=far below, 2=below, 3=close, 4=matches, 5=exceeds\n"
        "- domain_relevance: Has the candidate worked in the same or adjacent industry/domain? "
        "1=unrelated, 2=tangential, 3=adjacent, 4=same domain, 5=exact match\n"
        "- role_alignment: How closely does the candidate's recent job title and responsibilities "
        "match this role? 1=very different, 2=some overlap, 3=similar level, 4=close match, 5=exact\n"
        "- location_fit: Does the candidate's location/remote preference match the job? "
        "If the job is remote and the candidate is open to remote — rate 5. "
        "1=incompatible, 2=requires major relocation, 3=partial overlap, 4=close match, 5=exact match or both remote\n"
        "- bonus_qualifications: Certifications, languages, tools listed as nice-to-have. "
        "1=none, 3=some, 5=all or most\n\n"
        "Output ONLY valid JSON — no markdown, no extra text:\n"
        '{"ratings": {"skills_match": number, "experience_level": number, "domain_relevance": number, '
        '"role_alignment": number, "location_fit": number, "bonus_qualifications": number}, '
        '"matched_skills": [string], "missing_skills": [string], '
        '"strengths": [string], "recommendations": [string]}'
    ),
}


async def assemble_prompt(
    db: AsyncSession,
    user: User,
    operation: str,
    context: dict,
) -> tuple[str, str]:
    """Build (system_prompt, user_prompt) for an AI operation.

    Args:
        db: Database session
        user: Current user
        operation: One of "resume_generation", "ats_audit", "gap_analysis", "cover_letter"
        context: Dict with keys like job_description, resume_text, user_profile, etc.

    Returns:
        Tuple of (system_prompt, user_prompt)
    """
    # Layer 1: System prompt from user's custom instruction or default
    settings = await get_or_create_settings(db, user)

    instruction_field = f"instruction_{operation.replace('_generation', '')}"
    if operation == "resume_generation":
        instruction_field = "instruction_resume"

    custom_instruction = getattr(settings, instruction_field, None)
    system_prompt = custom_instruction or DEFAULT_INSTRUCTIONS.get(operation, "")

    # Layer 2: User prompt = reference docs + context
    user_prompt_parts = []

    # Add KB reference documents
    kb_docs = await get_documents_for_operation(db, user, operation)
    if kb_docs:
        user_prompt_parts.append("=== REFERENCE DOCUMENTS ===")
        for doc in kb_docs:
            user_prompt_parts.append(f"\n--- {doc.title} ---")
            user_prompt_parts.append(doc.content)
        user_prompt_parts.append("\n=== END REFERENCE DOCUMENTS ===\n")

    # Add context data
    if context.get("job_description"):
        user_prompt_parts.append(f"JOB DESCRIPTION:\n{context['job_description']}")

    if context.get("job_title"):
        user_prompt_parts.append(f"JOB TITLE: {context['job_title']}")

    if context.get("company"):
        user_prompt_parts.append(f"COMPANY: {context['company']}")

    if context.get("resume_text"):
        user_prompt_parts.append(f"\nRESUME:\n{context['resume_text']}")

    if context.get("user_profile"):
        user_prompt_parts.append(f"\nCANDIDATE PROFILE:\n{context['user_profile']}")

    # Add any extra instructions from context
    if context.get("extra_instructions"):
        user_prompt_parts.append(f"\nADDITIONAL INSTRUCTIONS:\n{context['extra_instructions']}")

    user_prompt = "\n".join(user_prompt_parts)

    return system_prompt, user_prompt
