"""
Tests for Telegram auth service and API endpoints.
Covers Phase 32 — Telegram Connection & Pulse Models.
"""
from __future__ import annotations

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.telegram import TelegramSession
from app.models.user import User, UserRole
from app.schemas.telegram import (
    TelegramStartAuthRequest,
    TelegramStatusResponse,
    TelegramVerifyCodeRequest,
)


# ── Helpers ──────────────────────────────────────────────────────────────────


def make_user(user_id: int = 1, role: UserRole = UserRole.admin) -> User:
    u = User()
    u.id = user_id
    u.role = role
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    return u


def make_session(user_id: int = 1, active: bool = True) -> TelegramSession:
    s = TelegramSession()
    s.id = 1
    s.user_id = user_id
    s.session_string = "encrypted_session"
    s.phone_number = "encrypted_phone"
    s.is_active = active
    s.connected_at = datetime(2026, 3, 16, 12, 0, 0, tzinfo=timezone.utc)
    s.last_used_at = None
    return s


# ── Schema tests ─────────────────────────────────────────────────────────────


class TestTelegramSchemas:
    def test_start_auth_request(self):
        req = TelegramStartAuthRequest(phone_number="+79001234567")
        assert req.phone_number == "+79001234567"

    def test_verify_code_request_without_password(self):
        req = TelegramVerifyCodeRequest(code="12345")
        assert req.code == "12345"
        assert req.password is None

    def test_verify_code_request_with_password(self):
        req = TelegramVerifyCodeRequest(code="12345", password="my2fa")
        assert req.password == "my2fa"

    def test_status_response_connected(self):
        resp = TelegramStatusResponse(
            connected=True,
            phone_number="***4567",
            connected_at=datetime(2026, 3, 16, 12, 0, 0, tzinfo=timezone.utc),
        )
        assert resp.connected is True
        assert resp.phone_number == "***4567"

    def test_status_response_disconnected(self):
        resp = TelegramStatusResponse(connected=False)
        assert resp.connected is False
        assert resp.phone_number is None
        assert resp.connected_at is None


# ── Service tests ────────────────────────────────────────────────────────────


class TestTelegramAuthService:
    @pytest.mark.asyncio
    @patch("app.services.telegram_auth._create_client")
    async def test_start_auth_sends_code(self, mock_create_client):
        mock_client = AsyncMock()
        mock_client.connect = AsyncMock()
        mock_client.send_code_request = AsyncMock(
            return_value=MagicMock(phone_code_hash="hash123")
        )
        mock_create_client.return_value = mock_client

        from app.services.telegram_auth import start_auth, _pending_clients

        db = AsyncMock()
        user = make_user()

        result = await start_auth(db, user, "+79001234567")

        mock_client.connect.assert_called_once()
        mock_client.send_code_request.assert_called_once_with("+79001234567")
        assert result["phone_code_hash"] == "hash123"
        assert user.id in _pending_clients

        # Cleanup
        _pending_clients.pop(user.id, None)

    @pytest.mark.asyncio
    @patch("app.services.telegram_auth.encrypt_value", return_value="encrypted")
    @patch("app.services.telegram_auth._create_client")
    async def test_verify_code_stores_encrypted_session(
        self, mock_create_client, mock_encrypt
    ):
        from app.services.telegram_auth import verify_code, _pending_clients

        mock_client = AsyncMock()
        mock_client.sign_in = AsyncMock()
        mock_client.session = MagicMock()
        mock_client.session.save = MagicMock(return_value="session_string_data")
        mock_client._phone = "+79001234567"
        _pending_clients[1] = mock_client

        db = AsyncMock()
        # Mock the select query returning no existing session
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        user = make_user()
        result = await verify_code(db, user, "12345")

        assert result["connected"] is True
        assert "connected_at" in result
        db.add.assert_called_once()
        db.commit.assert_called_once()

    @pytest.mark.asyncio
    @patch("app.services.telegram_auth.encrypt_value", return_value="encrypted")
    @patch("app.services.telegram_auth._create_client")
    async def test_verify_code_with_2fa(self, mock_create_client, mock_encrypt):
        from app.services.telegram_auth import verify_code, _pending_clients
        from telethon.errors import SessionPasswordNeededError

        mock_client = AsyncMock()
        mock_client.sign_in = AsyncMock(
            side_effect=[SessionPasswordNeededError(request=None), None]
        )
        mock_client.session = MagicMock()
        mock_client.session.save = MagicMock(return_value="session_data")
        mock_client._phone = "+79001234567"
        _pending_clients[1] = mock_client

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        user = make_user()
        result = await verify_code(db, user, "12345", password="my2fa")

        assert result["connected"] is True
        assert mock_client.sign_in.call_count == 2

    @pytest.mark.asyncio
    async def test_status_connected(self):
        from app.services.telegram_auth import get_status

        db = AsyncMock()
        session = make_session()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = session
        db.execute = AsyncMock(return_value=mock_result)

        user = make_user()

        with patch(
            "app.services.telegram_auth.decrypt_value",
            return_value="+79001234567",
        ):
            result = await get_status(db, user)

        assert result["connected"] is True
        assert result["phone_number"] == "***4567"

    @pytest.mark.asyncio
    async def test_status_disconnected(self):
        from app.services.telegram_auth import get_status

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        user = make_user()
        result = await get_status(db, user)

        assert result["connected"] is False
        assert result["phone_number"] is None

    @pytest.mark.asyncio
    @patch("app.services.telegram_auth._create_client")
    async def test_disconnect_deletes_session(self, mock_create_client):
        from app.services.telegram_auth import disconnect

        mock_client = AsyncMock()
        mock_client.connect = AsyncMock()
        mock_client.log_out = AsyncMock()
        mock_create_client.return_value = mock_client

        db = AsyncMock()
        session = make_session()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = session
        db.execute = AsyncMock(return_value=mock_result)

        user = make_user()

        with patch(
            "app.services.telegram_auth.decrypt_value",
            return_value="session_data",
        ):
            await disconnect(db, user)

        db.delete.assert_called_once_with(session)
        db.commit.assert_called_once()

    @pytest.mark.asyncio
    @patch("app.services.telegram_auth.encrypt_value", return_value="encrypted")
    @patch("app.services.telegram_auth._create_client")
    async def test_session_unique_per_user(self, mock_create_client, mock_encrypt):
        """Second auth replaces first session (upsert)."""
        from app.services.telegram_auth import verify_code, _pending_clients

        mock_client = AsyncMock()
        mock_client.sign_in = AsyncMock()
        mock_client.session = MagicMock()
        mock_client.session.save = MagicMock(return_value="new_session")
        mock_client._phone = "+79009999999"
        _pending_clients[1] = mock_client

        existing_session = make_session()
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = existing_session
        db.execute = AsyncMock(return_value=mock_result)

        user = make_user()
        result = await verify_code(db, user, "99999")

        assert result["connected"] is True
        # Should update existing, not create new
        db.add.assert_not_called()
        assert existing_session.session_string == "encrypted"


# ── Model tests ──────────────────────────────────────────────────────────────


class TestTelegramModels:
    def test_telegram_session_cascade_field(self):
        """TelegramSession has CASCADE on user FK."""
        from app.models.telegram import TelegramSession

        fk = TelegramSession.__table__.c.user_id.foreign_keys
        fk_obj = next(iter(fk))
        assert fk_obj.ondelete == "CASCADE"

    def test_pulse_source_unique_constraint(self):
        """PulseSource has unique constraint on (user_id, telegram_id)."""
        from app.models.telegram import PulseSource

        constraints = [
            c.name for c in PulseSource.__table__.constraints if hasattr(c, "name")
        ]
        assert "uq_pulse_sources_user_telegram" in constraints

    def test_pulse_message_unique_constraint(self):
        """PulseMessage has unique constraint on (user_id, source_id, telegram_message_id)."""
        from app.models.telegram import PulseMessage

        constraints = [
            c.name for c in PulseMessage.__table__.constraints if hasattr(c, "name")
        ]
        assert "uq_pulse_messages_user_source_msg" in constraints

    def test_pulse_settings_cascade_field(self):
        """PulseSettings has CASCADE on user FK."""
        from app.models.telegram import PulseSettings

        fk = PulseSettings.__table__.c.user_id.foreign_keys
        fk_obj = next(iter(fk))
        assert fk_obj.ondelete == "CASCADE"


# ── API endpoint tests ───────────────────────────────────────────────────────


class TestTelegramAPI:
    def setup_method(self):
        """Override auth dependency for all API tests."""
        from app.core.deps import get_current_user

        self._user = make_user()
        app.dependency_overrides[get_current_user] = lambda: self._user

    def teardown_method(self):
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    @patch("app.services.telegram_auth.get_status")
    async def test_api_status_endpoint(self, mock_get_status):
        mock_get_status.return_value = {
            "connected": True,
            "phone_number": "***4567",
            "connected_at": datetime(2026, 3, 16, 12, 0, 0, tzinfo=timezone.utc),
        }

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/pulse/telegram/status")

        assert response.status_code == 200
        data = response.json()
        assert data["connected"] is True
        assert data["phone_number"] == "***4567"

    @pytest.mark.asyncio
    @patch("app.services.telegram_auth.start_auth")
    async def test_api_start_auth_endpoint(self, mock_start_auth):
        mock_start_auth.return_value = {
            "phone_code_hash": "hash123",
            "phone_number": "+79001234567",
        }

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/pulse/telegram/start-auth",
                json={"phone_number": "+79001234567"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True

    @pytest.mark.asyncio
    @patch("app.services.telegram_auth.verify_code")
    async def test_api_verify_code_endpoint(self, mock_verify):
        mock_verify.return_value = {
            "connected": True,
            "phone_number": None,
            "connected_at": datetime(2026, 3, 16, 12, 0, 0, tzinfo=timezone.utc),
        }

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/pulse/telegram/verify-code",
                json={"code": "12345"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["connected"] is True

    @pytest.mark.asyncio
    @patch("app.services.telegram_auth.disconnect")
    async def test_api_disconnect_endpoint(self, mock_disconnect):
        mock_disconnect.return_value = None

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.delete("/api/pulse/telegram/disconnect")

        assert response.status_code == 204
