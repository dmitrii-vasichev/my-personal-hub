"""
Tests for Pulse Sources service and API endpoints.
Covers Phase 33 — Sources Management.
"""
from __future__ import annotations

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.telegram import PulseSource
from app.models.user import User, UserRole
from app.schemas.pulse_source import (
    PulseSourceCreate,
    PulseSourceResponse,
    PulseSourceResolveResponse,
    PulseSourceUpdate,
)


# ── Helpers ──────────────────────────────────────────────────────────────────


def make_user(user_id: int = 1, role: UserRole = UserRole.admin) -> User:
    u = User()
    u.id = user_id
    u.role = role
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    return u


def make_source(
    source_id: int = 1,
    user_id: int = 1,
    telegram_id: int = -1001234567890,
    title: str = "Test Channel",
    category: str = "news",
) -> PulseSource:
    s = PulseSource()
    s.id = source_id
    s.user_id = user_id
    s.telegram_id = telegram_id
    s.username = "test_channel"
    s.title = title
    s.category = category
    s.subcategory = None
    s.keywords = ["python", "ai"]
    s.criteria = None
    s.is_active = True
    s.poll_status = "idle"
    s.last_poll_error = None
    s.last_poll_message_count = 0
    s.last_polled_at = None
    s.created_at = datetime(2026, 3, 16, 12, 0, 0, tzinfo=timezone.utc)
    return s


# ── Schema tests ─────────────────────────────────────────────────────────────


class TestPulseSourceSchemas:
    def test_create_schema(self):
        data = PulseSourceCreate(
            telegram_id=-1001234567890,
            username="test_channel",
            title="Test Channel",
            category="news",
            keywords=["python"],
        )
        assert data.telegram_id == -1001234567890
        assert data.category == "news"
        assert data.subcategory is None

    def test_update_schema_partial(self):
        data = PulseSourceUpdate(category="jobs")
        dumped = data.model_dump(exclude_unset=True)
        assert dumped == {"category": "jobs"}

    def test_response_schema(self):
        source = make_source()
        resp = PulseSourceResponse.model_validate(source)
        assert resp.id == 1
        assert resp.title == "Test Channel"
        assert resp.is_active is True

    def test_resolve_response_schema(self):
        resp = PulseSourceResolveResponse(
            telegram_id=-1001234567890,
            username="test_channel",
            title="Test Channel",
            members_count=5000,
        )
        assert resp.members_count == 5000


# ── Service tests ────────────────────────────────────────────────────────────


class TestPulseSourceService:
    @pytest.mark.asyncio
    async def test_create_source(self):
        from app.services.pulse_source import create_source

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        data = PulseSourceCreate(
            telegram_id=-1001234567890,
            title="Test Channel",
            category="news",
        )
        await create_source(db, 1, data)

        db.add.assert_called_once()
        db.flush.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_source_duplicate_telegram_id(self):
        from fastapi import HTTPException
        from app.services.pulse_source import create_source

        db = AsyncMock()
        existing = make_source()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = existing
        db.execute = AsyncMock(return_value=mock_result)

        data = PulseSourceCreate(
            telegram_id=-1001234567890,
            title="Duplicate",
            category="news",
        )

        with pytest.raises(HTTPException) as exc_info:
            await create_source(db, 1, data)
        assert exc_info.value.status_code == 409

    @pytest.mark.asyncio
    async def test_list_sources(self):
        from app.services.pulse_source import list_sources

        db = AsyncMock()
        sources = [make_source(1), make_source(2, telegram_id=-100999)]
        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = sources
        mock_result.scalars.return_value = mock_scalars
        db.execute = AsyncMock(return_value=mock_result)

        result = await list_sources(db, 1)
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_get_source_ownership(self):
        from fastapi import HTTPException
        from app.services.pulse_source import get_source

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(HTTPException) as exc_info:
            await get_source(db, 999, user_id=1)
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_update_source(self):
        from app.services.pulse_source import update_source

        source = make_source()
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = source
        db.execute = AsyncMock(return_value=mock_result)

        data = PulseSourceUpdate(category="jobs", is_active=False)
        updated = await update_source(db, 1, 1, data)

        assert updated.category == "jobs"
        assert updated.is_active is False

    @pytest.mark.asyncio
    async def test_delete_source(self):
        from app.services.pulse_source import delete_source

        source = make_source()
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = source
        db.execute = AsyncMock(return_value=mock_result)

        await delete_source(db, 1, 1)
        db.delete.assert_called_once_with(source)

    @pytest.mark.asyncio
    @patch("app.services.pulse_source.telethon_utils.get_peer_id", return_value=-1001234567890)
    @patch("app.services.pulse_source.get_client_for_user")
    async def test_resolve_source(self, mock_get_client, _mock_get_peer_id):
        from app.services.pulse_source import resolve_source

        mock_entity = MagicMock()
        mock_entity.id = -1001234567890
        mock_entity.username = "test_channel"
        mock_entity.title = "Test Channel"
        mock_entity.participants_count = 5000

        mock_client = AsyncMock()
        mock_client.get_entity = AsyncMock(return_value=mock_entity)
        mock_client.disconnect = AsyncMock()
        mock_get_client.return_value = mock_client

        db = AsyncMock()
        user = make_user()

        result = await resolve_source(db, user, "@test_channel")

        assert result["telegram_id"] == -1001234567890
        assert result["title"] == "Test Channel"
        assert result["members_count"] == 5000
        mock_client.disconnect.assert_called_once()

    @pytest.mark.asyncio
    @patch("app.services.pulse_source.telethon_utils.get_peer_id")
    @patch("app.services.pulse_source.get_client_for_user")
    async def test_resolve_source_uses_peer_id_for_channels(
        self, mock_get_client, mock_get_peer_id
    ):
        """Regression: resolve_source must use get_peer_id, not raw entity.id.

        Raw entity.id for channels lacks the -100 prefix, causing
        get_entity() to fail with PeerUser error during polling.
        See: https://github.com/dmitrii-vasichev/my-personal-hub/issues/573
        """
        from app.services.pulse_source import resolve_source

        # Simulate real Telethon behavior: entity.id is raw (no -100 prefix)
        mock_entity = MagicMock()
        mock_entity.id = 1234567890  # raw channel ID without prefix
        mock_entity.username = "tech_channel"
        mock_entity.title = "Tech Channel"
        mock_entity.participants_count = 10000

        mock_client = AsyncMock()
        mock_client.get_entity = AsyncMock(return_value=mock_entity)
        mock_client.disconnect = AsyncMock()
        mock_get_client.return_value = mock_client

        # get_peer_id should return the properly prefixed ID
        mock_get_peer_id.return_value = -1001234567890

        db = AsyncMock()
        user = make_user()

        result = await resolve_source(db, user, "@tech_channel")

        # Must use get_peer_id result, NOT raw entity.id
        mock_get_peer_id.assert_called_once_with(mock_entity)
        assert result["telegram_id"] == -1001234567890
        assert result["telegram_id"] != mock_entity.id  # NOT the raw ID


# ── API endpoint tests ───────────────────────────────────────────────────────


class TestPulseSourcesAPI:
    def setup_method(self):
        from app.core.deps import get_current_user

        self._user = make_user()
        app.dependency_overrides[get_current_user] = lambda: self._user

    def teardown_method(self):
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    @patch("app.services.pulse_source.list_sources")
    async def test_api_list_sources(self, mock_list):
        source = make_source()
        mock_list.return_value = [source]

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/pulse/sources/")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == "Test Channel"

    @pytest.mark.asyncio
    @patch("app.services.pulse_source.create_source")
    async def test_api_create_source(self, mock_create):
        source = make_source()
        mock_create.return_value = source

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/pulse/sources/",
                json={
                    "telegram_id": -1001234567890,
                    "title": "Test Channel",
                    "category": "news",
                },
            )

        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Test Channel"

    @pytest.mark.asyncio
    @patch("app.services.pulse_source.update_source")
    async def test_api_update_source(self, mock_update):
        source = make_source()
        source.category = "jobs"
        mock_update.return_value = source

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.patch(
                "/api/pulse/sources/1",
                json={"category": "jobs"},
            )

        assert response.status_code == 200
        assert response.json()["category"] == "jobs"

    @pytest.mark.asyncio
    @patch("app.services.pulse_source.delete_source")
    async def test_api_delete_source(self, mock_delete):
        mock_delete.return_value = None

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.delete("/api/pulse/sources/1")

        assert response.status_code == 204

    @pytest.mark.asyncio
    @patch("app.services.pulse_source.resolve_source")
    async def test_api_resolve_source(self, mock_resolve):
        mock_resolve.return_value = {
            "telegram_id": -1001234567890,
            "username": "test_channel",
            "title": "Test Channel",
            "members_count": 5000,
        }

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get(
                "/api/pulse/sources/resolve",
                params={"identifier": "@test_channel"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["telegram_id"] == -1001234567890
        assert data["members_count"] == 5000
