"""Tests for resume generation with user profile integration and profile_utils."""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.profile_utils import build_profile_text
from app.services.resume import generate_resume


def _make_user(uid=1):
    u = MagicMock()
    u.id = uid
    return u


def _make_profile():
    p = MagicMock()
    p.user_id = 1
    p.summary = "Senior Python developer with 8 years of experience"
    p.skills = [{"name": "Python"}, {"name": "FastAPI"}, {"name": "PostgreSQL"}]
    p.experience = [
        {"title": "Senior Dev", "company": "Tech Corp", "description": "Built microservices"},
        {"title": "Developer", "company": "Old Inc", "description": "REST APIs"},
    ]
    p.education = [{"degree": "CS", "institution": "MIT"}]
    p.email = "dev@example.com"
    p.phone = "+1234567890"
    p.linkedin = "linkedin.com/in/dev"
    p.location = "San Francisco"
    return p


def _make_settings(provider="openai"):
    s = MagicMock()
    s.llm_provider = provider
    s.api_key_openai = "encrypted-key"
    s.instruction_resume = None
    return s


def _make_application(app_id=1, user_id=1):
    app = MagicMock()
    app.id = app_id
    app.user_id = user_id
    job = MagicMock()
    job.title = "Python Developer"
    job.company = "Acme Inc"
    job.description = "We need a Python developer with FastAPI skills."
    app.job = job
    return app


VALID_RESUME_JSON = json.dumps({
    "contact": {"name": "Dev", "email": "dev@example.com", "phone": "+1234567890", "location": "SF", "linkedin": ""},
    "summary": "Senior Python developer",
    "experience": [{"title": "Senior Dev", "company": "Tech Corp", "location": "SF", "start": "2020", "end": "Present", "bullets": ["Built microservices"]}],
    "education": [{"degree": "CS", "institution": "MIT", "year": "2016"}],
    "skills": ["Python", "FastAPI", "PostgreSQL"],
    "certifications": [],
})


class TestBuildProfileText:
    def test_full_profile(self):
        profile = _make_profile()
        text = build_profile_text(profile)
        assert "SUMMARY:" in text
        assert "Senior Python developer" in text
        assert "SKILLS:" in text
        assert "Python" in text
        assert "EXPERIENCE:" in text
        assert "Senior Dev at Tech Corp" in text
        assert "EDUCATION:" in text
        assert "CS from MIT" in text
        assert "CONTACTS:" in text
        assert "dev@example.com" in text

    def test_empty_profile(self):
        p = MagicMock()
        p.summary = None
        p.skills = []
        p.experience = []
        p.education = []
        p.email = None
        p.phone = None
        p.linkedin = None
        p.location = None
        text = build_profile_text(p)
        assert text == ""

    def test_partial_profile(self):
        p = MagicMock()
        p.summary = "Developer"
        p.skills = [{"name": "JavaScript"}]
        p.experience = []
        p.education = []
        p.email = None
        p.phone = None
        p.linkedin = None
        p.location = None
        text = build_profile_text(p)
        assert "SUMMARY: Developer" in text
        assert "SKILLS: JavaScript" in text
        assert "EXPERIENCE:" not in text
        assert "CONTACTS:" not in text


class TestResumeWithProfile:
    @pytest.mark.asyncio
    @patch("app.services.resume._get_llm")
    @patch("app.services.resume.assemble_prompt")
    @patch("app.services.resume._load_profile_text")
    @patch("app.services.resume._get_app_with_job")
    async def test_resume_includes_profile(self, mock_get_app, mock_profile, mock_assemble, mock_llm):
        """Resume generation passes profile data to prompt assembly."""
        app = _make_application()
        mock_get_app.return_value = app

        mock_profile.return_value = "SUMMARY: Senior Python developer\nSKILLS: Python, FastAPI"
        mock_assemble.return_value = ("system prompt", "user prompt")

        mock_llm_inst = AsyncMock()
        mock_llm_inst.generate = AsyncMock(return_value=VALID_RESUME_JSON)
        mock_llm.return_value = mock_llm_inst

        db = AsyncMock()
        db.execute = AsyncMock(return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: [])))

        user = _make_user()
        resume = await generate_resume(db, user, application_id=1)

        # Verify assemble_prompt was called with user_profile in context
        mock_assemble.assert_awaited_once()
        call_args = mock_assemble.call_args
        context = call_args[0][3] if len(call_args[0]) > 3 else call_args[1].get("context", call_args[0][3])
        assert "user_profile" in context
        assert "Senior Python developer" in context["user_profile"]

    @pytest.mark.asyncio
    @patch("app.services.resume._get_llm")
    @patch("app.services.resume.assemble_prompt")
    @patch("app.services.resume._load_profile_text")
    @patch("app.services.resume._get_app_with_job")
    async def test_resume_without_profile_fallback(self, mock_get_app, mock_profile, mock_assemble, mock_llm):
        """Resume generation works without profile (fallback)."""
        app = _make_application()
        mock_get_app.return_value = app

        mock_profile.return_value = ""  # No profile
        mock_assemble.return_value = ("system prompt", "user prompt")

        mock_llm_inst = AsyncMock()
        mock_llm_inst.generate = AsyncMock(return_value=VALID_RESUME_JSON)
        mock_llm.return_value = mock_llm_inst

        db = AsyncMock()
        db.execute = AsyncMock(return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: [])))

        user = _make_user()
        resume = await generate_resume(db, user, application_id=1)

        mock_assemble.assert_awaited_once()
        call_args = mock_assemble.call_args
        context = call_args[0][3] if len(call_args[0]) > 3 else call_args[1].get("context", call_args[0][3])
        assert "user_profile" not in context
        assert "generic content" in context.get("extra_instructions", "").lower()
