"""
Tests for Telegram API credentials management (Phase 38).
Covers save/read credentials, DB-priority with .env fallback, write-only pattern.
"""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.telegram import PulseSettings
from app.models.user import User, UserRole
from app.schemas.telegram import (
    TelegramConfigStatusResponse,
    TelegramCredentialsSaveRequest,
)


# ── Helpers ──────────────────────────────────────────────────────────────────


def make_user(user_id: int = 1, role: UserRole = UserRole.admin) -> User:
    u = User()
    u.id = user_id
    u.role = role
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    return u


def make_pulse_settings(
    user_id: int = 1,
    api_id: int | None = None,
    api_hash_encrypted: str | None = None,
) -> PulseSettings:
    ps = PulseSettings()
    ps.id = 1
    ps.user_id = user_id
    ps.telegram_api_id = api_id
    ps.telegram_api_hash_encrypted = api_hash_encrypted
    return ps


# ── Schema validation tests ─────────────────────────────────────────────────


class TestCredentialSchemas:
    def test_valid_credentials(self):
        req = TelegramCredentialsSaveRequest(
            api_id=123456, api_hash="abcdef1234567890abcdef1234567890"
        )
        assert req.api_id == 123456
        assert req.api_hash == "abcdef1234567890abcdef1234567890"

    def test_api_id_must_be_positive(self):
        with pytest.raises(ValueError, match="api_id must be a positive integer"):
            TelegramCredentialsSaveRequest(
                api_id=0, api_hash="abcdef1234567890abcdef1234567890"
            )

    def test_api_id_negative_rejected(self):
        with pytest.raises(ValueError, match="api_id must be a positive integer"):
            TelegramCredentialsSaveRequest(
                api_id=-1, api_hash="abcdef1234567890abcdef1234567890"
            )

    def test_api_hash_must_be_32_hex(self):
        with pytest.raises(ValueError, match="api_hash must be a 32-character hex string"):
            TelegramCredentialsSaveRequest(api_id=123, api_hash="tooshort")

    def test_api_hash_non_hex_rejected(self):
        with pytest.raises(ValueError, match="api_hash must be a 32-character hex string"):
            TelegramCredentialsSaveRequest(
                api_id=123, api_hash="zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"
            )

    def test_api_hash_wrong_length(self):
        with pytest.raises(ValueError, match="api_hash must be a 32-character hex string"):
            TelegramCredentialsSaveRequest(
                api_id=123, api_hash="abcdef1234567890"  # 16 chars
            )

    def test_config_status_response(self):
        resp = TelegramConfigStatusResponse(configured=True, api_id=123456)
        assert resp.configured is True
        assert resp.api_id == 123456

    def test_config_status_response_unconfigured(self):
        resp = TelegramConfigStatusResponse(configured=False)
        assert resp.configured is False
        assert resp.api_id is None


# ── Service tests ────────────────────────────────────────────────────────────


class TestCredentialsService:
    @pytest.mark.asyncio
    async def test_get_credentials_from_db(self):
        from app.services.telegram_auth import get_credentials

        ps = make_pulse_settings(api_id=999, api_hash_encrypted="encrypted_hash")
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = ps
        db.execute = AsyncMock(return_value=mock_result)

        with patch(
            "app.services.telegram_auth.decrypt_value",
            return_value="real_hash_value",
        ):
            result = await get_credentials(db, make_user())

        assert result == (999, "real_hash_value")

    @pytest.mark.asyncio
    async def test_get_credentials_env_fallback(self):
        from app.services.telegram_auth import get_credentials

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        with patch("app.services.telegram_auth.settings") as mock_settings:
            mock_settings.TELEGRAM_API_ID = 555
            mock_settings.TELEGRAM_API_HASH = "envhash"
            result = await get_credentials(db, make_user())

        assert result == (555, "envhash")

    @pytest.mark.asyncio
    async def test_get_credentials_none_when_empty(self):
        from app.services.telegram_auth import get_credentials

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        with patch("app.services.telegram_auth.settings") as mock_settings:
            mock_settings.TELEGRAM_API_ID = 0
            mock_settings.TELEGRAM_API_HASH = ""
            result = await get_credentials(db, make_user())

        assert result is None

    @pytest.mark.asyncio
    async def test_get_credentials_db_priority_over_env(self):
        """DB credentials should take priority over .env."""
        from app.services.telegram_auth import get_credentials

        ps = make_pulse_settings(api_id=999, api_hash_encrypted="encrypted_db_hash")
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = ps
        db.execute = AsyncMock(return_value=mock_result)

        with (
            patch(
                "app.services.telegram_auth.decrypt_value",
                return_value="db_hash",
            ),
            patch("app.services.telegram_auth.settings") as mock_settings,
        ):
            mock_settings.TELEGRAM_API_ID = 111
            mock_settings.TELEGRAM_API_HASH = "env_hash"
            result = await get_credentials(db, make_user())

        assert result == (999, "db_hash")

    @pytest.mark.asyncio
    @patch("app.services.telegram_auth.encrypt_value", return_value="encrypted_new")
    async def test_save_credentials_creates_new(self, _mock_encrypt):
        from app.services.telegram_auth import save_credentials

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        await save_credentials(db, make_user(), 123, "a" * 32)

        db.add.assert_called_once()
        db.commit.assert_called_once()
        added = db.add.call_args[0][0]
        assert added.telegram_api_id == 123
        assert added.telegram_api_hash_encrypted == "encrypted_new"

    @pytest.mark.asyncio
    @patch("app.services.telegram_auth.encrypt_value", return_value="encrypted_updated")
    async def test_save_credentials_updates_existing(self, _mock_encrypt):
        from app.services.telegram_auth import save_credentials

        existing = make_pulse_settings(api_id=100, api_hash_encrypted="old_encrypted")
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = existing
        db.execute = AsyncMock(return_value=mock_result)

        await save_credentials(db, make_user(), 200, "b" * 32)

        db.add.assert_not_called()
        db.commit.assert_called_once()
        assert existing.telegram_api_id == 200
        assert existing.telegram_api_hash_encrypted == "encrypted_updated"

    @pytest.mark.asyncio
    async def test_get_credentials_status_configured(self):
        from app.services.telegram_auth import get_credentials_status

        with patch(
            "app.services.telegram_auth.get_credentials",
            return_value=(123, "hash"),
        ):
            result = await get_credentials_status(AsyncMock(), make_user())

        assert result["configured"] is True
        assert result["api_id"] == 123

    @pytest.mark.asyncio
    async def test_get_credentials_status_not_configured(self):
        from app.services.telegram_auth import get_credentials_status

        with patch(
            "app.services.telegram_auth.get_credentials",
            return_value=None,
        ):
            result = await get_credentials_status(AsyncMock(), make_user())

        assert result["configured"] is False
        assert result["api_id"] is None


# ── API endpoint tests ───────────────────────────────────────────────────────


class TestCredentialsAPI:
    def setup_method(self):
        from app.core.deps import get_current_user

        self._user = make_user()
        app.dependency_overrides[get_current_user] = lambda: self._user

    def teardown_method(self):
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    @patch("app.services.telegram_auth.save_credentials")
    async def test_put_credentials_success(self, mock_save):
        mock_save.return_value = None

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.put(
                "/api/pulse/telegram/credentials",
                json={
                    "api_id": 123456,
                    "api_hash": "abcdef1234567890abcdef1234567890",
                },
            )

        assert response.status_code == 200
        assert response.json()["ok"] is True
        mock_save.assert_called_once()

    @pytest.mark.asyncio
    async def test_put_credentials_validation_error(self):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.put(
                "/api/pulse/telegram/credentials",
                json={"api_id": 0, "api_hash": "short"},
            )

        assert response.status_code == 422

    @pytest.mark.asyncio
    @patch("app.services.telegram_auth.save_credentials")
    async def test_put_credentials_non_admin_rejected(self, mock_save):
        from app.core.deps import get_current_user

        member_user = make_user(role=UserRole.member)
        app.dependency_overrides[get_current_user] = lambda: member_user

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.put(
                "/api/pulse/telegram/credentials",
                json={
                    "api_id": 123456,
                    "api_hash": "abcdef1234567890abcdef1234567890",
                },
            )

        assert response.status_code == 403
        mock_save.assert_not_called()

    @pytest.mark.asyncio
    @patch("app.services.telegram_auth.get_credentials_status")
    async def test_config_status_returns_api_id(self, mock_status):
        mock_status.return_value = {"configured": True, "api_id": 123456}

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/pulse/telegram/config-status")

        assert response.status_code == 200
        data = response.json()
        assert data["configured"] is True
        assert data["api_id"] == 123456
        # Ensure no hash in response
        assert "api_hash" not in data
        assert "telegram_api_hash" not in data
