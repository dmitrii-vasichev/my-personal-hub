"""Tests for AI job matching service."""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.job_matching import match_job


def _make_user(uid=1):
    u = MagicMock()
    u.id = uid
    return u


def _make_job(jid=1):
    j = MagicMock()
    j.id = jid
    j.user_id = 1
    j.title = "Senior Python Developer"
    j.company = "Acme Corp"
    j.description = "We need a Python dev with FastAPI experience."
    j.match_score = None
    j.match_result = None
    j.updated_at = None
    return j


def _make_profile():
    p = MagicMock()
    p.user_id = 1
    p.summary = "Experienced Python developer"
    p.skills = [{"name": "Python"}, {"name": "FastAPI"}, {"name": "PostgreSQL"}]
    p.experience = [{"title": "Dev", "company": "Old Corp", "description": "Built APIs"}]
    p.education = [{"degree": "CS", "institution": "MIT"}]
    return p


def _make_settings(provider="openai", api_key="encrypted-key"):
    s = MagicMock()
    s.llm_provider = provider
    s.api_key_openai = api_key
    s.instruction_job_matching = None
    return s


VALID_LLM_RESPONSE = json.dumps({
    "score": 85,
    "matched_skills": ["Python", "FastAPI"],
    "missing_skills": ["Kubernetes"],
    "strengths": ["Strong backend experience"],
    "recommendations": ["Learn Kubernetes"],
})


def _db_returning(*values):
    db = AsyncMock()
    results = []
    for v in values:
        r = MagicMock()
        if isinstance(v, list):
            r.scalars.return_value.all.return_value = v
        else:
            r.scalar_one_or_none.return_value = v
        results.append(r)
    db.execute = AsyncMock(side_effect=results)
    return db


@pytest.mark.asyncio
async def test_match_job_not_found():
    """Raises ValueError when job does not exist."""
    db = _db_returning(None)  # job not found
    user = _make_user()

    with pytest.raises(ValueError, match="Job not found"):
        await match_job(db, job_id=999, user=user)


@pytest.mark.asyncio
async def test_match_job_no_profile():
    """Raises ValueError when user has no profile."""
    job = _make_job()
    db = _db_returning(job, None)  # job found, profile not found
    user = _make_user()

    with pytest.raises(ValueError, match="No user profile"):
        await match_job(db, job_id=1, user=user)


@pytest.mark.asyncio
@patch("app.services.job_matching.get_llm_client")
@patch("app.services.job_matching.get_decrypted_key", return_value="real-key")
@patch("app.services.job_matching.get_or_create_settings")
@patch("app.services.job_matching.assemble_prompt")
async def test_match_job_success(mock_assemble, mock_settings, mock_decrypt, mock_llm_factory):
    """Successfully matches and saves result to job."""
    job = _make_job()
    profile = _make_profile()
    db = _db_returning(job, profile)

    mock_assemble.return_value = ("system prompt", "user prompt")
    mock_settings.return_value = _make_settings()
    mock_llm = AsyncMock()
    mock_llm.generate = AsyncMock(return_value=VALID_LLM_RESPONSE)
    mock_llm_factory.return_value = mock_llm

    user = _make_user()
    result = await match_job(db, job_id=1, user=user)

    assert result["score"] == 85
    assert "Python" in result["matched_skills"]
    assert "Kubernetes" in result["missing_skills"]
    assert len(result["strengths"]) == 1
    assert len(result["recommendations"]) == 1

    # Verify job record was updated
    assert job.match_score == 85
    assert job.match_result == result
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
@patch("app.services.job_matching.get_llm_client")
@patch("app.services.job_matching.get_decrypted_key", return_value="real-key")
@patch("app.services.job_matching.get_or_create_settings")
@patch("app.services.job_matching.assemble_prompt")
async def test_match_job_updates_existing_result(mock_assemble, mock_settings, mock_decrypt, mock_llm_factory):
    """Re-running match updates the existing result."""
    job = _make_job()
    job.match_score = 70
    job.match_result = {"score": 70, "matched_skills": []}
    profile = _make_profile()
    db = _db_returning(job, profile)

    mock_assemble.return_value = ("system", "user")
    mock_settings.return_value = _make_settings()
    mock_llm = AsyncMock()
    mock_llm.generate = AsyncMock(return_value=VALID_LLM_RESPONSE)
    mock_llm_factory.return_value = mock_llm

    result = await match_job(db, job_id=1, user=_make_user())
    assert result["score"] == 85
    assert job.match_score == 85


@pytest.mark.asyncio
@patch("app.services.job_matching.get_llm_client")
@patch("app.services.job_matching.get_decrypted_key", return_value="real-key")
@patch("app.services.job_matching.get_or_create_settings")
@patch("app.services.job_matching.assemble_prompt")
async def test_match_job_invalid_json(mock_assemble, mock_settings, mock_decrypt, mock_llm_factory):
    """Raises RuntimeError when LLM returns invalid JSON."""
    job = _make_job()
    profile = _make_profile()
    db = _db_returning(job, profile)

    mock_assemble.return_value = ("system", "user")
    mock_settings.return_value = _make_settings()
    mock_llm = AsyncMock()
    mock_llm.generate = AsyncMock(return_value="not json at all")
    mock_llm_factory.return_value = mock_llm

    with pytest.raises(RuntimeError, match="invalid response"):
        await match_job(db, job_id=1, user=_make_user())


@pytest.mark.asyncio
@patch("app.services.job_matching.get_llm_client")
@patch("app.services.job_matching.get_decrypted_key", return_value="real-key")
@patch("app.services.job_matching.get_or_create_settings")
@patch("app.services.job_matching.assemble_prompt")
async def test_match_job_llm_error(mock_assemble, mock_settings, mock_decrypt, mock_llm_factory):
    """Raises RuntimeError when LLM call fails."""
    job = _make_job()
    profile = _make_profile()
    db = _db_returning(job, profile)

    mock_assemble.return_value = ("system", "user")
    mock_settings.return_value = _make_settings()
    mock_llm = AsyncMock()
    mock_llm.generate = AsyncMock(side_effect=Exception("API timeout"))
    mock_llm_factory.return_value = mock_llm

    with pytest.raises(RuntimeError, match="AI matching failed"):
        await match_job(db, job_id=1, user=_make_user())


@pytest.mark.asyncio
async def test_match_job_no_api_key():
    """Raises ValueError when no API key is configured."""
    job = _make_job()
    profile = _make_profile()
    db = _db_returning(job, profile)

    with patch("app.services.job_matching.assemble_prompt", return_value=("sys", "usr")), \
         patch("app.services.job_matching.get_or_create_settings", return_value=_make_settings()), \
         patch("app.services.job_matching.get_decrypted_key", return_value=None):

        with pytest.raises(ValueError, match="No API key"):
            await match_job(db, job_id=1, user=_make_user())


@pytest.mark.asyncio
@patch("app.services.job_matching.get_llm_client")
@patch("app.services.job_matching.get_decrypted_key", return_value="real-key")
@patch("app.services.job_matching.get_or_create_settings")
@patch("app.services.job_matching.assemble_prompt")
async def test_match_job_markdown_fences(mock_assemble, mock_settings, mock_decrypt, mock_llm_factory):
    """Handles LLM response wrapped in markdown code fences."""
    job = _make_job()
    profile = _make_profile()
    db = _db_returning(job, profile)

    fenced_response = f"```json\n{VALID_LLM_RESPONSE}\n```"

    mock_assemble.return_value = ("system", "user")
    mock_settings.return_value = _make_settings()
    mock_llm = AsyncMock()
    mock_llm.generate = AsyncMock(return_value=fenced_response)
    mock_llm_factory.return_value = mock_llm

    result = await match_job(db, job_id=1, user=_make_user())
    assert result["score"] == 85


@pytest.mark.asyncio
@patch("app.services.job_matching.get_llm_client")
@patch("app.services.job_matching.get_decrypted_key", return_value="real-key")
@patch("app.services.job_matching.get_or_create_settings")
@patch("app.services.job_matching.assemble_prompt")
async def test_match_job_score_clamped(mock_assemble, mock_settings, mock_decrypt, mock_llm_factory):
    """Score is clamped to 0-100 range."""
    job = _make_job()
    profile = _make_profile()
    db = _db_returning(job, profile)

    over_score_response = json.dumps({
        "score": 150,
        "matched_skills": [],
        "missing_skills": [],
        "strengths": [],
        "recommendations": [],
    })

    mock_assemble.return_value = ("system", "user")
    mock_settings.return_value = _make_settings()
    mock_llm = AsyncMock()
    mock_llm.generate = AsyncMock(return_value=over_score_response)
    mock_llm_factory.return_value = mock_llm

    result = await match_job(db, job_id=1, user=_make_user())
    assert result["score"] == 100
