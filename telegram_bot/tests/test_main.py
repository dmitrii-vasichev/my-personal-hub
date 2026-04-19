"""Tests for `main._is_whitelisted` — the per-update Hub check-sender gate.

The helper is the single choke-point Task 7 uses to gate all three handlers,
so it's covered here in isolation. Handler-level integration (non-whitelisted
user sends /new → no side effect) overlaps with Task 10's E2E and is skipped.
"""
import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import hub_client
import main


def _make_update(user_id: int | None = 12345) -> SimpleNamespace:
    user = None if user_id is None else SimpleNamespace(id=user_id)
    return SimpleNamespace(effective_user=user)


def _make_context(chat_data: dict | None = None) -> SimpleNamespace:
    return SimpleNamespace(chat_data=chat_data if chat_data is not None else {})


def _make_settings(whitelist: int | None) -> SimpleNamespace:
    return SimpleNamespace(whitelist_tg_user_id=whitelist)


# --- Hub verdicts ---------------------------------------------------------


def test_hub_returns_hub_id_returns_true_and_populates_cache(monkeypatch):
    check = AsyncMock(return_value=42)
    monkeypatch.setattr(hub_client, "check_sender", check)

    update = _make_update(user_id=12345)
    context = _make_context()
    settings = _make_settings(whitelist=None)

    ok = asyncio.run(main._is_whitelisted(update, context, settings))

    assert ok is True
    check.assert_awaited_once_with(12345)
    assert context.chat_data["whitelist_ok"] is True
    assert isinstance(context.chat_data["whitelist_verified_at"], datetime)


def test_hub_returns_none_returns_false_and_populates_cache(monkeypatch):
    check = AsyncMock(return_value=None)
    monkeypatch.setattr(hub_client, "check_sender", check)

    update = _make_update(user_id=12345)
    context = _make_context()
    settings = _make_settings(whitelist=12345)  # even if env matches, 404 wins

    ok = asyncio.run(main._is_whitelisted(update, context, settings))

    assert ok is False
    check.assert_awaited_once_with(12345)
    assert context.chat_data["whitelist_ok"] is False


# --- Env fallback on exception --------------------------------------------


def test_hub_raises_env_fallback_matches_returns_true(monkeypatch):
    check = AsyncMock(side_effect=RuntimeError("boom"))
    monkeypatch.setattr(hub_client, "check_sender", check)

    update = _make_update(user_id=12345)
    context = _make_context()
    settings = _make_settings(whitelist=12345)

    ok = asyncio.run(main._is_whitelisted(update, context, settings))

    assert ok is True
    check.assert_awaited_once()
    assert context.chat_data["whitelist_ok"] is True


def test_hub_raises_env_fallback_mismatch_returns_false(monkeypatch):
    check = AsyncMock(side_effect=RuntimeError("boom"))
    monkeypatch.setattr(hub_client, "check_sender", check)

    update = _make_update(user_id=12345)
    context = _make_context()
    settings = _make_settings(whitelist=99999)  # some other id

    ok = asyncio.run(main._is_whitelisted(update, context, settings))

    assert ok is False
    assert context.chat_data["whitelist_ok"] is False


def test_hub_raises_env_not_set_returns_false(monkeypatch):
    check = AsyncMock(side_effect=RuntimeError("boom"))
    monkeypatch.setattr(hub_client, "check_sender", check)

    update = _make_update(user_id=12345)
    context = _make_context()
    settings = _make_settings(whitelist=None)

    ok = asyncio.run(main._is_whitelisted(update, context, settings))

    assert ok is False
    assert context.chat_data["whitelist_ok"] is False


# --- Cache behaviour ------------------------------------------------------


def test_cache_hit_within_ttl_skips_check_sender(monkeypatch):
    check = AsyncMock(side_effect=AssertionError("should not be called"))
    monkeypatch.setattr(hub_client, "check_sender", check)

    recent = datetime.now(timezone.utc) - timedelta(seconds=5)
    context = _make_context(
        chat_data={"whitelist_verified_at": recent, "whitelist_ok": True}
    )
    update = _make_update(user_id=12345)
    settings = _make_settings(whitelist=None)

    ok = asyncio.run(main._is_whitelisted(update, context, settings))

    assert ok is True
    check.assert_not_awaited()


def test_cache_expired_triggers_fresh_check_sender_call(monkeypatch):
    check = AsyncMock(return_value=42)
    monkeypatch.setattr(hub_client, "check_sender", check)

    stale = datetime.now(timezone.utc) - timedelta(seconds=main.WHITELIST_CACHE_S + 5)
    context = _make_context(
        chat_data={"whitelist_verified_at": stale, "whitelist_ok": False}
    )
    update = _make_update(user_id=12345)
    settings = _make_settings(whitelist=None)

    ok = asyncio.run(main._is_whitelisted(update, context, settings))

    assert ok is True
    check.assert_awaited_once_with(12345)
    # Cache should be rewritten with a fresh timestamp.
    assert context.chat_data["whitelist_verified_at"] > stale


# --- effective_user is None ----------------------------------------------


def test_none_effective_user_returns_false_without_call(monkeypatch):
    check = AsyncMock(side_effect=AssertionError("should not be called"))
    monkeypatch.setattr(hub_client, "check_sender", check)

    update = _make_update(user_id=None)
    context = _make_context()
    settings = _make_settings(whitelist=12345)

    ok = asyncio.run(main._is_whitelisted(update, context, settings))

    assert ok is False
    check.assert_not_awaited()
    # No cache write — the chat_data dict stays empty.
    assert context.chat_data == {}
