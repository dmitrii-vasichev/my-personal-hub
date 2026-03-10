"""Tests for AI Knowledge Base CRUD + seeding."""
from __future__ import annotations

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch, call

from app.models.knowledge_base import AiKnowledgeBase
from app.models.user import User, UserRole
from app.schemas.knowledge_base import KBDocumentCreate, KBDocumentUpdate
from app.services.knowledge_base import (
    list_documents,
    get_document,
    create_document,
    update_document,
    delete_document,
    reset_document,
    get_documents_for_operation,
)
from app.services.kb_defaults import seed_kb_for_user, get_default_content, DEFAULT_KB_DOCUMENTS


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


def make_kb_doc(
    slug: str = "test-doc",
    title: str = "Test Document",
    is_default: bool = True,
    used_by: list[str] | None = None,
    user_id: int = 1,
) -> AiKnowledgeBase:
    d = AiKnowledgeBase()
    d.id = 1
    d.user_id = user_id
    d.slug = slug
    d.title = title
    d.content = "Test content"
    d.is_default = is_default
    d.used_by = used_by or []
    d.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    d.updated_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return d


# ---------------------------------------------------------------------------
# kb_defaults — seed_kb_for_user
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_seed_kb_creates_default_documents():
    """Seeding creates 4 default documents when none exist."""
    mock_db = AsyncMock()

    # First query: check existing slugs — returns empty
    mock_existing = MagicMock()
    mock_existing.scalars.return_value.all.return_value = []
    mock_db.execute.return_value = mock_existing
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    created = await seed_kb_for_user(mock_db, user_id=1)

    assert len(created) == 4
    assert mock_db.add.call_count == 4
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_seed_kb_is_idempotent():
    """When all defaults already exist, seeding creates nothing."""
    mock_db = AsyncMock()

    existing_slugs = [d["slug"] for d in DEFAULT_KB_DOCUMENTS]
    mock_existing = MagicMock()
    mock_existing.scalars.return_value.all.return_value = existing_slugs
    mock_db.execute.return_value = mock_existing

    created = await seed_kb_for_user(mock_db, user_id=1)

    assert len(created) == 0
    mock_db.add.assert_not_called()


def test_get_default_content_returns_content():
    """get_default_content returns content for known slugs."""
    content = get_default_content("resume-writing-rules")
    assert content is not None
    assert "Resume Writing" in content


def test_get_default_content_returns_none_for_unknown():
    """get_default_content returns None for unknown slugs."""
    assert get_default_content("nonexistent-slug") is None


# ---------------------------------------------------------------------------
# delete_document
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_delete_custom_document():
    """Custom (non-default) documents can be deleted."""
    user = make_user()
    doc = make_kb_doc(is_default=False)

    with patch("app.services.knowledge_base.get_document", new_callable=AsyncMock, return_value=doc):
        mock_db = AsyncMock()
        result = await delete_document(mock_db, user, "test-doc")

    assert result is True


@pytest.mark.asyncio
async def test_cannot_delete_default_document():
    """Default documents cannot be deleted — returns error string."""
    user = make_user()
    doc = make_kb_doc(is_default=True)

    with patch("app.services.knowledge_base.get_document", new_callable=AsyncMock, return_value=doc):
        mock_db = AsyncMock()
        result = await delete_document(mock_db, user, "test-doc")

    assert result == "cannot_delete_default"


@pytest.mark.asyncio
async def test_delete_nonexistent_returns_not_found():
    """Deleting non-existent document returns 'not_found'."""
    user = make_user()

    with patch("app.services.knowledge_base.get_document", new_callable=AsyncMock, return_value=None):
        mock_db = AsyncMock()
        result = await delete_document(mock_db, user, "no-such-doc")

    assert result == "not_found"


# ---------------------------------------------------------------------------
# reset_document
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_reset_document_restores_default_content():
    """Reset restores the original content of a default document."""
    user = make_user()
    doc = make_kb_doc(slug="resume-writing-rules")
    doc.content = "User edited content"

    mock_db = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    with patch("app.services.knowledge_base.get_document", new_callable=AsyncMock, return_value=doc):
        result = await reset_document(mock_db, user, "resume-writing-rules")

    assert result is not None
    assert "Resume Writing" in result.content
    assert result.content != "User edited content"


@pytest.mark.asyncio
async def test_reset_returns_none_for_custom_doc():
    """Reset returns None for non-default documents."""
    user = make_user()
    doc = make_kb_doc(slug="custom-doc", is_default=False)

    with patch("app.services.knowledge_base.get_document", new_callable=AsyncMock, return_value=doc):
        mock_db = AsyncMock()
        result = await reset_document(mock_db, user, "custom-doc")

    assert result is None


# ---------------------------------------------------------------------------
# get_documents_for_operation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_documents_for_operation_filters_by_used_by():
    """Only documents with matching used_by are returned."""
    user = make_user()

    doc1 = make_kb_doc(slug="resume-rules", used_by=["resume_generation"])
    doc2 = make_kb_doc(slug="ats-guide", used_by=["ats_audit"])
    doc3 = make_kb_doc(slug="analysis", used_by=["ats_audit", "gap_analysis"])

    with patch(
        "app.services.knowledge_base.list_documents",
        new_callable=AsyncMock,
        return_value=[doc1, doc2, doc3],
    ), patch(
        "app.services.knowledge_base._ensure_seeded",
        new_callable=AsyncMock,
    ):
        mock_db = AsyncMock()

        # ats_audit should return doc2 and doc3
        result = await get_documents_for_operation(mock_db, user, "ats_audit")
        slugs = [d.slug for d in result]
        assert "ats-guide" in slugs
        assert "analysis" in slugs
        assert "resume-rules" not in slugs


# ---------------------------------------------------------------------------
# create_document
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_custom_document():
    """Creating a custom document sets is_default=False."""
    user = make_user()
    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    data = KBDocumentCreate(
        slug="my-custom-doc",
        title="My Custom Guide",
        content="Custom content",
        used_by=["resume_generation"],
    )
    result = await create_document(mock_db, user, data)

    mock_db.add.assert_called_once()
    added_doc = mock_db.add.call_args[0][0]
    assert added_doc.is_default is False
    assert added_doc.slug == "my-custom-doc"


# ---------------------------------------------------------------------------
# update_document
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_document_changes_content():
    """Updating a document changes specified fields."""
    user = make_user()
    doc = make_kb_doc(slug="test-doc")

    mock_db = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    with patch("app.services.knowledge_base.get_document", new_callable=AsyncMock, return_value=doc):
        data = KBDocumentUpdate(content="New content", title="New Title")
        result = await update_document(mock_db, user, "test-doc", data)

    assert result is not None
    assert result.content == "New content"
    assert result.title == "New Title"
