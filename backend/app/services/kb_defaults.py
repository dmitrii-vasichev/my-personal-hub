"""Default AI Knowledge Base documents — seeded for each new user.

Content based on resume optimization best practices (OpenClaw-style).
Each document maps to specific AI operations via `used_by`.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.knowledge_base import AiKnowledgeBase


DEFAULT_KB_DOCUMENTS = [
    {
        "slug": "resume-writing-rules",
        "title": "Resume Writing Best Practices",
        "content": """# Resume Writing Best Practices

## Structure & Format
- Use reverse chronological order for experience and education
- Keep resume to 1-2 pages maximum
- Use clear section headings: Summary, Experience, Education, Skills
- Consistent formatting throughout (fonts, spacing, bullet style)

## Bullet Points
- Start every bullet with a strong action verb (Led, Developed, Implemented, Optimized, etc.)
- Follow the STAR method: Situation, Task, Action, Result
- Include quantifiable metrics whenever possible (%, $, time saved, users impacted)
- Keep bullets to 1-2 lines each, avoid paragraphs
- Use 3-6 bullets per role, prioritize most impactful contributions

## Action Verbs by Category
- Leadership: Led, Directed, Managed, Coordinated, Supervised, Mentored
- Technical: Developed, Engineered, Architected, Implemented, Deployed, Automated
- Analysis: Analyzed, Evaluated, Assessed, Researched, Investigated, Audited
- Improvement: Optimized, Streamlined, Enhanced, Redesigned, Modernized, Accelerated
- Communication: Presented, Collaborated, Negotiated, Facilitated, Trained

## Summary Section
- 2-3 sentences highlighting years of experience, key specialization, and top achievement
- Tailor to the specific role — mirror language from the job description
- Avoid generic statements like "hard-working professional"

## Skills Section
- Group by category (Programming Languages, Frameworks, Tools, etc.)
- List most relevant skills first
- Match exact terminology from job description when truthful
- Include both hard and soft skills where appropriate""",
        "used_by": ["resume_generation"],
    },
    {
        "slug": "ats-optimization",
        "title": "ATS Optimization Guide",
        "content": """# ATS (Applicant Tracking System) Optimization

## Formatting for ATS
- Use standard section headings (Experience, Education, Skills — avoid creative names)
- Avoid tables, columns, text boxes, headers/footers, and graphics
- Use standard bullet characters (•, -, *)
- Do not use images or icons for contact info
- Stick to common fonts (Arial, Calibri, Times New Roman)

## Keyword Strategy
- Extract keywords directly from the job description
- Include both acronyms and full terms (e.g., "Machine Learning (ML)")
- Place keywords naturally in context, not as keyword stuffing
- Mirror exact phrases from the job posting when truthful
- Include industry-standard certifications and tool names

## Common ATS Pitfalls
- Fancy formatting that breaks parsing (columns, graphics)
- Missing standard section headers
- Using images instead of text
- Non-standard file formats (use .docx or .pdf)
- Keyword stuffing without context (ATS and recruiters flag this)

## Scoring Factors
- Keyword match percentage (40-60% of score)
- Skills alignment with requirements
- Experience relevance and recency
- Education match
- Proper formatting and parsability

## Optimization Checklist
- [ ] All keywords from job description included naturally
- [ ] Standard section headings used
- [ ] No formatting that could break ATS parsing
- [ ] Contact info in plain text
- [ ] File saved in compatible format
- [ ] Consistent date formats throughout""",
        "used_by": ["ats_audit"],
    },
    {
        "slug": "analysis-checklist",
        "title": "Resume Analysis & Scoring Checklist",
        "content": """# Resume Analysis & Scoring Framework

## Overall Scoring (0-100 points)

### Content Quality (40 points)
- Impact statements with metrics: 0-10
- Action verb usage: 0-5
- Relevance to target role: 0-10
- Skills coverage vs requirements: 0-10
- Summary effectiveness: 0-5

### ATS Compatibility (30 points)
- Keyword match rate: 0-10
- Standard formatting: 0-5
- Section structure: 0-5
- Parsability: 0-5
- File format compatibility: 0-5

### Presentation (15 points)
- Visual clarity and readability: 0-5
- Consistent formatting: 0-5
- Appropriate length: 0-5

### Strategic Positioning (15 points)
- Career narrative coherence: 0-5
- Achievement emphasis vs duty listing: 0-5
- Tailoring to specific role: 0-5

## Gap Analysis Categories
- **Hard Skills Gap**: Technical skills required but not demonstrated
- **Soft Skills Gap**: Interpersonal/leadership skills missing
- **Experience Gap**: Required years or level not met
- **Industry Gap**: Different industry background
- **Certification Gap**: Required certifications not held

## Recommendations Framework
- Priority 1: Critical gaps that would cause immediate rejection
- Priority 2: Important gaps that reduce competitiveness
- Priority 3: Nice-to-have improvements for stronger positioning""",
        "used_by": ["ats_audit", "gap_analysis"],
    },
    {
        "slug": "cover-letter-rules",
        "title": "Cover Letter Writing Guide",
        "content": """# Cover Letter Writing Guide

## Structure (3-4 paragraphs, 250-350 words)

### Opening Paragraph
- State the specific position you're applying for
- Hook: a compelling reason why you're excited about this role/company
- Brief mention of your most relevant qualification

### Body Paragraph(s) (1-2)
- Connect your top 2-3 achievements to the job requirements
- Use specific examples with results and metrics
- Show you understand the company's challenges or goals
- Demonstrate cultural fit and enthusiasm

### Closing Paragraph
- Reiterate your interest and fit
- Include a call to action (available for interview, follow-up)
- Thank the reader for their time

## Style Guidelines
- Professional but personable tone
- Avoid repeating the resume — add context and personality
- Address to a specific person when possible (research the hiring manager)
- Customize for each application — generic letters are obvious
- Show knowledge of the company (recent news, products, values)

## Common Mistakes to Avoid
- Starting with "I am writing to apply for..." (too generic)
- Listing job duties instead of achievements
- Making it about what you want vs. what you offer
- Typos and grammatical errors (proofread carefully)
- Being too long (keep under 400 words)
- Using the same letter for every application

## Power Phrases
- "My experience in [X] directly aligns with your need for [Y]"
- "In my role at [Company], I achieved [specific result]"
- "I'm particularly drawn to [Company] because [specific reason]"
- "I would welcome the opportunity to discuss how my background in [X] can contribute to [goal]" """,
        "used_by": ["cover_letter"],
    },
]


async def seed_kb_for_user(db: AsyncSession, user_id: int) -> list[AiKnowledgeBase]:
    """Create default KB documents for a user if they don't exist yet.

    Idempotent — skips documents whose slug already exists for this user.
    Returns the list of created documents (empty if all already existed).
    """
    result = await db.execute(
        select(AiKnowledgeBase.slug).where(AiKnowledgeBase.user_id == user_id)
    )
    existing_slugs = set(result.scalars().all())

    created = []
    for doc_data in DEFAULT_KB_DOCUMENTS:
        if doc_data["slug"] in existing_slugs:
            continue
        doc = AiKnowledgeBase(
            user_id=user_id,
            slug=doc_data["slug"],
            title=doc_data["title"],
            content=doc_data["content"],
            is_default=True,
            used_by=doc_data["used_by"],
        )
        db.add(doc)
        created.append(doc)

    if created:
        await db.commit()
        for doc in created:
            await db.refresh(doc)

    return created


def get_default_content(slug: str) -> str | None:
    """Return the default content for a given slug, or None if not a default doc."""
    for doc_data in DEFAULT_KB_DOCUMENTS:
        if doc_data["slug"] == slug:
            return doc_data["content"]
    return None
