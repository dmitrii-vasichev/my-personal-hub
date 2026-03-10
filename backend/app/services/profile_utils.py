"""Shared utility for building text representation of UserProfile for LLM context."""


def build_profile_text(profile) -> str:
    """Build a text representation of UserProfile for LLM context.

    Works with any object that has summary, skills, experience, education,
    email, phone, linkedin, location attributes.
    """
    parts = []

    if getattr(profile, "summary", None):
        parts.append(f"SUMMARY: {profile.summary}")

    skills = getattr(profile, "skills", None) or []
    skill_names = [s.get("name", "") for s in skills if isinstance(s, dict)]
    if skill_names:
        parts.append(f"SKILLS: {', '.join(skill_names)}")

    experience = getattr(profile, "experience", None) or []
    if experience:
        parts.append("EXPERIENCE:")
        for exp in experience:
            if isinstance(exp, dict):
                line = f"- {exp.get('title', '')} at {exp.get('company', '')}"
                if exp.get("description"):
                    line += f": {exp['description']}"
                parts.append(line)

    education = getattr(profile, "education", None) or []
    if education:
        parts.append("EDUCATION:")
        for edu in education:
            if isinstance(edu, dict):
                parts.append(
                    f"- {edu.get('degree', '')} from {edu.get('institution', '')}"
                )

    contact_parts = []
    for field in ("email", "phone", "linkedin", "location"):
        val = getattr(profile, field, None)
        if val and isinstance(val, str):
            contact_parts.append(val)
    if contact_parts:
        parts.append(f"CONTACTS: {', '.join(contact_parts)}")

    return "\n".join(parts)
