"""
Tests for Phase 22: Notes Module — Google Drive Integration & Notes Backend.
Covers: Note model, schemas, settings extension, Drive service (mocked),
note service (sync, CRUD), notes API endpoints.
"""
from __future__ import annotations

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.note import Note
from app.models.user import User, UserRole
from app.models.settings import UserSettings
from app.schemas.note import NoteResponse, NoteTreeNode, NoteTreeResponse
from app.schemas.settings import SettingsUpdate, SettingsResponse
from app.services.settings import to_response, update_settings
from app.services import note as note_service
from app.services import google_drive


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(user_id: int = 1, role: UserRole = UserRole.admin) -> User:
    u = User()
    u.id = user_id
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    u.password_hash = "hashed"
    u.role = role
    u.must_change_password = False
    u.is_blocked = False
    u.theme = "dark"
    u.last_login_at = None
    u.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return u


def make_settings(user_id: int = 1, **kwargs) -> UserSettings:
    s = UserSettings()
    s.id = 1
    s.user_id = user_id
    s.default_location = "Remote"
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
    s.google_drive_notes_folder_id = None
    s.instruction_resume = None
    s.instruction_ats_audit = None
    s.instruction_gap_analysis = None
    s.instruction_cover_letter = None
    s.updated_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for k, v in kwargs.items():
        setattr(s, k, v)
    return s


def make_note(
    note_id: int = 1,
    user_id: int = 1,
    google_file_id: str = "file_abc",
    title: str = "test.md",
    folder_path: str = "",
    mime_type: str = "text/markdown",
) -> Note:
    n = Note()
    n.id = note_id
    n.user_id = user_id
    n.google_file_id = google_file_id
    n.title = title
    n.folder_path = folder_path
    n.mime_type = mime_type
    n.last_synced_at = datetime(2026, 3, 10, tzinfo=timezone.utc)
    n.created_at = datetime(2026, 3, 10, tzinfo=timezone.utc)
    n.updated_at = datetime(2026, 3, 10, tzinfo=timezone.utc)
    return n


SAMPLE_TREE = [
    NoteTreeNode(
        name="Notes",
        type="folder",
        google_file_id="folder_1",
        children=[
            NoteTreeNode(name="readme.md", type="file", google_file_id="file_1"),
            NoteTreeNode(name="todo.md", type="file", google_file_id="file_2"),
        ],
    ),
    NoteTreeNode(name="root.md", type="file", google_file_id="file_3"),
]


# ---------------------------------------------------------------------------
# 1. Note model
# ---------------------------------------------------------------------------

def test_note_model_fields():
    """Note model has all required fields."""
    note = make_note()
    assert note.id == 1
    assert note.user_id == 1
    assert note.google_file_id == "file_abc"
    assert note.title == "test.md"
    assert note.folder_path == ""
    assert note.mime_type == "text/markdown"
    assert note.last_synced_at is not None
    assert note.created_at is not None
    assert note.updated_at is not None


# ---------------------------------------------------------------------------
# 2. Note schemas
# ---------------------------------------------------------------------------

def test_note_response_from_model():
    """NoteResponse can be created from Note model attributes."""
    note = make_note()
    resp = NoteResponse.model_validate(note, from_attributes=True)
    assert resp.id == 1
    assert resp.google_file_id == "file_abc"
    assert resp.title == "test.md"


def test_note_tree_node_recursive():
    """NoteTreeNode supports recursive children."""
    node = NoteTreeNode(
        name="parent",
        type="folder",
        google_file_id="folder_1",
        children=[
            NoteTreeNode(name="child.md", type="file", google_file_id="file_1"),
        ],
    )
    assert len(node.children) == 1
    assert node.children[0].type == "file"


def test_note_tree_response():
    """NoteTreeResponse wraps folder_id and tree."""
    resp = NoteTreeResponse(folder_id="root_folder", tree=SAMPLE_TREE)
    assert resp.folder_id == "root_folder"
    assert len(resp.tree) == 2


# ---------------------------------------------------------------------------
# 3. Settings — notes folder field
# ---------------------------------------------------------------------------

def test_settings_response_includes_notes_folder():
    """SettingsResponse exposes google_drive_notes_folder_id as plain string."""
    settings = make_settings(google_drive_notes_folder_id="folder_abc_123")
    resp = to_response(settings)
    assert resp.google_drive_notes_folder_id == "folder_abc_123"


def test_settings_response_notes_folder_none():
    """SettingsResponse returns None when notes folder not set."""
    settings = make_settings()
    resp = to_response(settings)
    assert resp.google_drive_notes_folder_id is None


@pytest.mark.asyncio
async def test_admin_can_save_notes_folder():
    """Admin can update google_drive_notes_folder_id."""
    admin = make_user(user_id=1, role=UserRole.admin)
    settings = make_settings(user_id=admin.id)

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = settings
    mock_db.execute.return_value = mock_result
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    data = SettingsUpdate(google_drive_notes_folder_id="my_folder_id")

    with patch("app.services.settings.encrypt_value", side_effect=lambda v: f"enc_{v}"):
        result = await update_settings(mock_db, admin, data)

    assert result.google_drive_notes_folder_id == "my_folder_id"


@pytest.mark.asyncio
async def test_member_cannot_save_notes_folder():
    """Member cannot update google_drive_notes_folder_id."""
    member = make_user(user_id=2, role=UserRole.member)
    settings = make_settings(user_id=member.id)

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = settings
    mock_db.execute.return_value = mock_result
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    data = SettingsUpdate(google_drive_notes_folder_id="should_be_ignored")
    result = await update_settings(mock_db, member, data)

    assert result.google_drive_notes_folder_id is None


# ---------------------------------------------------------------------------
# 4. Google Drive service (mocked API)
# ---------------------------------------------------------------------------

def test_is_markdown_file():
    """_is_markdown_file correctly identifies markdown files."""
    from app.services.google_drive import _is_markdown_file

    assert _is_markdown_file("readme.md", "text/plain") is True
    assert _is_markdown_file("notes.markdown", "text/plain") is True
    assert _is_markdown_file("doc.txt", "text/markdown") is True
    assert _is_markdown_file("image.png", "image/png") is False
    assert _is_markdown_file("README.MD", "text/plain") is True


@pytest.mark.asyncio
async def test_list_folder_tree_with_mocked_api():
    """list_folder_tree builds tree from mocked Drive API response."""
    mock_files_response = {
        "files": [
            {"id": "folder_1", "name": "Subfolder", "mimeType": "application/vnd.google-apps.folder"},
            {"id": "file_1", "name": "note.md", "mimeType": "text/plain"},
            {"id": "file_2", "name": "image.png", "mimeType": "image/png"},
        ],
        "nextPageToken": None,
    }
    subfolder_response = {
        "files": [
            {"id": "file_3", "name": "nested.md", "mimeType": "text/markdown"},
        ],
        "nextPageToken": None,
    }

    mock_service = MagicMock()
    mock_list = mock_service.files.return_value.list
    mock_list.return_value.execute.side_effect = [mock_files_response, subfolder_response]

    with patch("app.services.google_drive._get_drive_service", return_value=mock_service):
        # Clear cache to force fresh fetch
        google_drive._tree_cache.clear()
        mock_creds = MagicMock()
        tree = await google_drive.list_folder_tree(mock_creds, "root_folder", use_cache=False)

    # Should have folder + 1 md file at root (png filtered out)
    assert len(tree) == 2
    folder_node = next(n for n in tree if n.type == "folder")
    assert folder_node.name == "Subfolder"
    assert len(folder_node.children) == 1
    assert folder_node.children[0].name == "nested.md"

    file_node = next(n for n in tree if n.type == "file")
    assert file_node.name == "note.md"


@pytest.mark.asyncio
async def test_get_file_content_mocked():
    """get_file_content returns decoded UTF-8 content."""
    mock_service = MagicMock()
    mock_service.files.return_value.get_media.return_value.execute.return_value = (
        b"# Hello World\n\nThis is a test."
    )

    with patch("app.services.google_drive._get_drive_service", return_value=mock_service):
        mock_creds = MagicMock()
        content = await google_drive.get_file_content(mock_creds, "file_1")

    assert content == "# Hello World\n\nThis is a test."


@pytest.mark.asyncio
async def test_validate_folder_access_valid():
    """validate_folder_access returns True for valid folder."""
    mock_service = MagicMock()
    mock_service.files.return_value.get.return_value.execute.return_value = {
        "mimeType": "application/vnd.google-apps.folder"
    }

    with patch("app.services.google_drive._get_drive_service", return_value=mock_service):
        mock_creds = MagicMock()
        result = await google_drive.validate_folder_access(mock_creds, "folder_id")

    assert result is True


@pytest.mark.asyncio
async def test_validate_folder_access_not_folder():
    """validate_folder_access returns False if target is not a folder."""
    mock_service = MagicMock()
    mock_service.files.return_value.get.return_value.execute.return_value = {
        "mimeType": "text/plain"
    }

    with patch("app.services.google_drive._get_drive_service", return_value=mock_service):
        mock_creds = MagicMock()
        result = await google_drive.validate_folder_access(mock_creds, "file_id")

    assert result is False


@pytest.mark.asyncio
async def test_validate_folder_access_http_error():
    """validate_folder_access returns False on HttpError."""
    from googleapiclient.errors import HttpError
    from unittest.mock import PropertyMock

    mock_service = MagicMock()
    mock_resp = MagicMock()
    mock_resp.status = 404
    mock_resp.reason = "Not Found"
    mock_service.files.return_value.get.return_value.execute.side_effect = HttpError(
        mock_resp, b"Not Found"
    )

    with patch("app.services.google_drive._get_drive_service", return_value=mock_service):
        mock_creds = MagicMock()
        result = await google_drive.validate_folder_access(mock_creds, "bad_id")

    assert result is False


def test_cache_invalidation():
    """invalidate_cache removes entry from cache."""
    google_drive._tree_cache["test_folder"] = (0, [])
    google_drive.invalidate_cache("test_folder")
    assert "test_folder" not in google_drive._tree_cache


# ---------------------------------------------------------------------------
# 5. Note service — sync, CRUD
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_sync_metadata_creates_notes():
    """sync_metadata creates Note records from tree."""
    user = make_user()
    mock_db = AsyncMock()

    # No existing notes
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db.execute.return_value = mock_result
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    notes = await note_service.sync_metadata(mock_db, user, SAMPLE_TREE)

    # 3 files: readme.md, todo.md, root.md
    assert len(notes) == 3
    assert mock_db.add.call_count == 3


@pytest.mark.asyncio
async def test_sync_metadata_updates_existing():
    """sync_metadata updates existing notes and removes stale ones."""
    user = make_user()
    mock_db = AsyncMock()

    existing_note = make_note(
        note_id=1, google_file_id="file_1", title="old_name.md"
    )
    stale_note = make_note(
        note_id=2, google_file_id="stale_file", title="stale.md"
    )

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [existing_note, stale_note]
    mock_db.execute.return_value = mock_result
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    notes = await note_service.sync_metadata(mock_db, user, SAMPLE_TREE)

    # existing note should be updated
    assert existing_note.title == "readme.md"
    # 3 total notes (1 updated + 2 new)
    assert len(notes) == 3
    # delete should have been called for stale notes
    assert mock_db.execute.call_count >= 2  # select + delete


@pytest.mark.asyncio
async def test_get_notes():
    """get_notes returns user's notes."""
    user = make_user()
    mock_db = AsyncMock()
    mock_result = MagicMock()
    expected = [make_note(note_id=1), make_note(note_id=2, google_file_id="file_2")]
    mock_result.scalars.return_value.all.return_value = expected
    mock_db.execute.return_value = mock_result

    result = await note_service.get_notes(mock_db, user)
    assert len(result) == 2


@pytest.mark.asyncio
async def test_get_note_found():
    """get_note returns single note by ID."""
    user = make_user()
    mock_db = AsyncMock()
    expected = make_note()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = expected
    mock_db.execute.return_value = mock_result

    result = await note_service.get_note(mock_db, user, 1)
    assert result is not None
    assert result.id == 1


@pytest.mark.asyncio
async def test_get_note_not_found():
    """get_note returns None for non-existent note."""
    user = make_user()
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result

    result = await note_service.get_note(mock_db, user, 999)
    assert result is None


@pytest.mark.asyncio
async def test_get_note_by_google_file_id():
    """get_note_by_google_file_id looks up by Drive file ID."""
    user = make_user()
    mock_db = AsyncMock()
    expected = make_note(google_file_id="drive_file_xyz")
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = expected
    mock_db.execute.return_value = mock_result

    result = await note_service.get_note_by_google_file_id(mock_db, user, "drive_file_xyz")
    assert result is not None
    assert result.google_file_id == "drive_file_xyz"


# ---------------------------------------------------------------------------
# 6. Note service helpers
# ---------------------------------------------------------------------------

def test_flatten_tree():
    """_flatten_tree produces correct (file_id, title, folder_path, mime) tuples."""
    result: list[tuple[str, str, str, str]] = []
    note_service._flatten_tree(SAMPLE_TREE, "", result)

    assert len(result) == 3
    # Files in Notes folder should have folder_path = "Notes"
    notes_files = [(fid, title, path) for fid, title, path, _ in result if path == "Notes"]
    assert len(notes_files) == 2
    # Root file should have empty path
    root_files = [(fid, title, path) for fid, title, path, _ in result if path == ""]
    assert len(root_files) == 1
    assert root_files[0][1] == "root.md"


def test_collect_file_ids():
    """_collect_file_ids collects only file (not folder) IDs."""
    result: set[str] = set()
    note_service._collect_file_ids(SAMPLE_TREE, result)

    assert result == {"file_1", "file_2", "file_3"}
    assert "folder_1" not in result


# ---------------------------------------------------------------------------
# 7. Notes API — endpoint tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_notes_api_unauthorized():
    """Notes endpoints return 401 without auth token."""
    from httpx import AsyncClient, ASGITransport
    from app.main import app

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.get("/api/notes/")
        assert resp.status_code in (401, 403)

        resp = await client.get("/api/notes/tree")
        assert resp.status_code in (401, 403)

        resp = await client.post("/api/notes/sync")
        assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# 8. OAuth scope extension
# ---------------------------------------------------------------------------

def test_oauth_scopes_include_drive():
    """SCOPES list includes calendar, drive.readonly and drive.file."""
    from app.services.google_oauth import SCOPES

    assert "https://www.googleapis.com/auth/calendar" in SCOPES
    assert "https://www.googleapis.com/auth/drive.readonly" in SCOPES
    assert "https://www.googleapis.com/auth/drive.file" in SCOPES
    assert len(SCOPES) == 3


# ---------------------------------------------------------------------------
# 9. Google Drive — create_file
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_file_success():
    """create_file creates a markdown file in Google Drive."""
    mock_service = MagicMock()
    mock_service.files.return_value.create.return_value.execute.return_value = {
        "id": "new_file_123"
    }

    with patch("app.services.google_drive._get_drive_service", return_value=mock_service):
        mock_creds = MagicMock()
        file_id = await google_drive.create_file(
            mock_creds, "folder_abc", "My Note", "# Hello\n\nContent here."
        )

    assert file_id == "new_file_123"
    # Verify create was called with correct metadata
    call_kwargs = mock_service.files.return_value.create.call_args
    assert call_kwargs.kwargs["body"]["name"] == "My Note.md"
    assert call_kwargs.kwargs["body"]["parents"] == ["folder_abc"]


@pytest.mark.asyncio
async def test_create_file_already_has_md_extension():
    """create_file does not double-append .md."""
    mock_service = MagicMock()
    mock_service.files.return_value.create.return_value.execute.return_value = {
        "id": "new_file_456"
    }

    with patch("app.services.google_drive._get_drive_service", return_value=mock_service):
        mock_creds = MagicMock()
        await google_drive.create_file(
            mock_creds, "folder_abc", "already.md", "content"
        )

    call_kwargs = mock_service.files.return_value.create.call_args
    assert call_kwargs.kwargs["body"]["name"] == "already.md"


# ---------------------------------------------------------------------------
# 10. Note service — create_note
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_note_success():
    """create_note creates Drive file and saves metadata."""
    user = make_user()
    mock_db = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()
    mock_creds = MagicMock()

    with patch("app.services.note.google_drive.create_file", new_callable=AsyncMock) as mock_create:
        mock_create.return_value = "drive_file_new"

        note = await note_service.create_note(
            mock_db, user, "Test Note", "# Content", mock_creds, "folder_id"
        )

    assert note.google_file_id == "drive_file_new"
    assert note.title == "Test Note.md"
    assert note.user_id == user.id
    assert note.mime_type == "text/markdown"
    mock_db.add.assert_called_once()
    mock_db.commit.assert_awaited_once()


# ---------------------------------------------------------------------------
# 11. NoteCreate schema
# ---------------------------------------------------------------------------

def test_note_create_schema():
    """NoteCreate schema validates title and content."""
    from app.schemas.note import NoteCreate

    data = NoteCreate(title="Test", content="# Hello")
    assert data.title == "Test"
    assert data.content == "# Hello"


# ---------------------------------------------------------------------------
# 12. Regression: OAuth scopes must include both drive.readonly and drive.file
# ---------------------------------------------------------------------------

def test_google_oauth_scopes_include_drive_readonly_and_file():
    """Regression: drive.readonly is required to list existing notes,
    drive.file is required to create new notes. Both must be present.
    See issue #543 — Phase 36 accidentally replaced drive.readonly with drive.file."""
    from app.services.google_oauth import SCOPES

    assert "https://www.googleapis.com/auth/drive.readonly" in SCOPES, (
        "drive.readonly scope is missing — notes tree listing will fail"
    )
    assert "https://www.googleapis.com/auth/drive.file" in SCOPES, (
        "drive.file scope is missing — note creation will fail"
    )
