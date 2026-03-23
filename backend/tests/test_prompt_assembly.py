"""Tests for prompt assembly service."""
from __future__ import annotations

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from app.models.knowledge_base import AiKnowledgeBase
from app.models.user import User, UserRole
from app.models.settings import UserSettings
from app.services.prompt_assembly import assemble_prompt, DEFAULT_INSTRUCTIONS


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(user_id: int = 1) -> User:
    u = User()
    u.id = user_id
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    u.password_hash = "hashed"
    u.role = UserRole.member
    u.must_change_password = False
    u.is_blocked = False
    u.theme = "dark"
    u.last_login_at = None
    u.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return u


def make_settings(
    user_id: int = 1,
    instruction_resume: str | None = None,
    instruction_ats_audit: str | None = None,
) -> UserSettings:
    s = UserSettings()
    s.id = 1
    s.user_id = user_id
    s.default_location = None
    s.target_roles = []
    s.min_match_score = 0
    s.excluded_companies = []
    s.stale_threshold_days = 14
    s.llm_provider = "openai"
    s.api_key_openai = None
    s.api_key_anthropic = None
    s.api_key_gemini = None
    s.api_key_adzuna_id = None
    s.api_key_adzuna_key = None
    s.api_key_serpapi = None
    s.api_key_jsearch = None
    s.google_client_id = None
    s.google_client_secret = None
    s.google_redirect_uri = None
    s.instruction_resume = instruction_resume
    s.instruction_ats_audit = instruction_ats_audit
    s.instruction_gap_analysis = None
    s.instruction_cover_letter = None
    s.updated_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return s


def make_kb_doc(slug: str, title: str, content: str, used_by: list[str]) -> AiKnowledgeBase:
    d = AiKnowledgeBase()
    d.id = 1
    d.user_id = 1
    d.slug = slug
    d.title = title
    d.content = content
    d.is_default = True
    d.used_by = used_by
    d.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    d.updated_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return d


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_assemble_uses_default_instruction():
    """When no custom instruction, uses DEFAULT_INSTRUCTIONS."""
    user = make_user()
    settings = make_settings()

    with patch(
        "app.services.prompt_assembly.get_or_create_settings",
        new_callable=AsyncMock,
        return_value=settings,
    ), patch(
        "app.services.prompt_assembly.get_documents_for_operation",
        new_callable=AsyncMock,
        return_value=[],
    ):
        mock_db = AsyncMock()
        system, user_prompt = await assemble_prompt(
            mock_db, user, "resume_generation",
            {"job_description": "Build APIs in Python"},
        )

    assert system == DEFAULT_INSTRUCTIONS["resume_generation"]
    assert "Build APIs in Python" in user_prompt


@pytest.mark.asyncio
async def test_assemble_uses_custom_instruction():
    """When user has custom instruction, it overrides default."""
    user = make_user()
    settings = make_settings(instruction_resume="You are a custom resume bot.")

    with patch(
        "app.services.prompt_assembly.get_or_create_settings",
        new_callable=AsyncMock,
        return_value=settings,
    ), patch(
        "app.services.prompt_assembly.get_documents_for_operation",
        new_callable=AsyncMock,
        return_value=[],
    ):
        mock_db = AsyncMock()
        system, user_prompt = await assemble_prompt(
            mock_db, user, "resume_generation",
            {"job_description": "Test"},
        )

    assert system == "You are a custom resume bot."


@pytest.mark.asyncio
async def test_assemble_includes_kb_docs():
    """KB documents are included in the user prompt."""
    user = make_user()
    settings = make_settings()

    kb_doc = make_kb_doc(
        slug="resume-rules",
        title="Resume Rules",
        content="Use action verbs. Add metrics.",
        used_by=["resume_generation"],
    )

    with patch(
        "app.services.prompt_assembly.get_or_create_settings",
        new_callable=AsyncMock,
        return_value=settings,
    ), patch(
        "app.services.prompt_assembly.get_documents_for_operation",
        new_callable=AsyncMock,
        return_value=[kb_doc],
    ):
        mock_db = AsyncMock()
        system, user_prompt = await assemble_prompt(
            mock_db, user, "resume_generation",
            {"job_description": "Python dev role"},
        )

    assert "REFERENCE DOCUMENTS" in user_prompt
    assert "Resume Rules" in user_prompt
    assert "Use action verbs" in user_prompt


@pytest.mark.asyncio
async def test_assemble_includes_context_fields():
    """Context fields (job_title, company, resume_text, etc.) appear in user prompt."""
    user = make_user()
    settings = make_settings()

    with patch(
        "app.services.prompt_assembly.get_or_create_settings",
        new_callable=AsyncMock,
        return_value=settings,
    ), patch(
        "app.services.prompt_assembly.get_documents_for_operation",
        new_callable=AsyncMock,
        return_value=[],
    ):
        mock_db = AsyncMock()
        system, user_prompt = await assemble_prompt(
            mock_db, user, "ats_audit",
            {
                "job_description": "We need a Go developer",
                "job_title": "Go Engineer",
                "company": "Acme Corp",
                "resume_text": "Experienced Go developer with 5 years",
            },
        )

    assert "Go Engineer" in user_prompt
    assert "Acme Corp" in user_prompt
    assert "We need a Go developer" in user_prompt
    assert "Experienced Go developer" in user_prompt


@pytest.mark.asyncio
async def test_assemble_handles_empty_kb():
    """When no KB docs match the operation, prompt still works."""
    user = make_user()
    settings = make_settings()

    with patch(
        "app.services.prompt_assembly.get_or_create_settings",
        new_callable=AsyncMock,
        return_value=settings,
    ), patch(
        "app.services.prompt_assembly.get_documents_for_operation",
        new_callable=AsyncMock,
        return_value=[],
    ):
        mock_db = AsyncMock()
        system, user_prompt = await assemble_prompt(
            mock_db, user, "cover_letter",
            {"job_description": "Marketing role"},
        )

    assert "REFERENCE DOCUMENTS" not in user_prompt
    assert "Marketing role" in user_prompt
    assert system == DEFAULT_INSTRUCTIONS["cover_letter"]
