"""Regression tests for the Telegram-to-Claude-Code bridge decommission."""
from __future__ import annotations

from datetime import datetime, timezone

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.user import User, UserRole
from app.schemas.auth import user_to_response


def make_user() -> User:
    user = User()
    user.id = 1
    user.email = "owner@example.com"
    user.display_name = "Owner"
    user.role = UserRole.admin
    user.password_hash = "unused"
    user.must_change_password = False
    user.is_blocked = False
    user.theme = "dark"
    user.timezone = "UTC"
    user.last_login_at = None
    user.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return user


@pytest.mark.asyncio
async def test_telegram_bridge_auth_routes_are_removed():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        check_sender = await client.post(
            "/api/telegram/auth/check-sender",
            json={"telegram_user_id": 123456},
        )
        verify_pin = await client.post(
            "/api/telegram/auth/verify-pin",
            json={"pin": "1234"},
        )

    assert check_sender.status_code == 404
    assert verify_pin.status_code == 404


def test_user_response_excludes_bridge_pairing_fields():
    payload = user_to_response(make_user()).model_dump()

    assert "telegram_user_id" not in payload
    assert "telegram_pin_configured" not in payload
