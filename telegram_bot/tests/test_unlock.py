import asyncio
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

import hub_client
import main
import unlock
from hub_client import PinLockedOut


@pytest.fixture(autouse=True)
def _reset_unlock_state():
    """Keep module state from leaking across tests."""
    unlock._reset_for_tests()
    yield
    unlock._reset_for_tests()


# --- Pure module tests ----------------------------------------------------


def test_is_unlocked_returns_false_initially():
    assert unlock.is_unlocked(42) is False


def test_unlock_chat_then_is_unlocked_returns_true():
    unlock.unlock_chat(42)
    assert unlock.is_unlocked(42) is True


def test_lazy_cleanup_on_expired_is_unlocked():
    # A negative duration lands in the past → the very next read must
    # report "locked" AND evict the entry from the backing dict so the
    # map doesn't grow without bound over a long-running process.
    unlock.unlock_chat(42, duration=timedelta(seconds=-1))
    assert unlock.is_unlocked(42) is False
    assert 42 not in unlock._unlock_until


def test_different_chat_ids_are_isolated():
    unlock.unlock_chat(111)
    assert unlock.is_unlocked(111) is True
    assert unlock.is_unlocked(222) is False


def test_unlock_chat_returns_expiry_in_the_future():
    until = unlock.unlock_chat(42)
    # 10-minute default window → the returned expiry must be strictly
    # greater than "now" at the time of the call.
    from datetime import datetime, timezone
    assert until > datetime.now(timezone.utc)


# --- Handler tests --------------------------------------------------------


def _make_update(chat_id: int = 42, user_id: int = 12345) -> SimpleNamespace:
    message = SimpleNamespace(reply_text=AsyncMock())
    chat = SimpleNamespace(id=chat_id)
    user = SimpleNamespace(id=user_id)
    return SimpleNamespace(effective_chat=chat, effective_user=user, message=message)


def _make_context(args: list[str]) -> SimpleNamespace:
    # Task 7: handlers now go through `_is_whitelisted`, which needs
    # `chat_data` (for the TTL cache) and `application.bot_data["settings"]`
    # (for the env-fallback whitelist).
    settings = SimpleNamespace(whitelist_tg_user_id=None)
    application = SimpleNamespace(bot_data={"settings": settings})
    return SimpleNamespace(args=args, chat_data={}, application=application)


@pytest.fixture(autouse=True)
def _whitelist_the_sender(monkeypatch):
    """Make `_is_whitelisted` return True for the handler tests below.

    Each test focuses on unlock logic — whitelist gating is covered in
    `test_main.py`. Without this, the new gate in `handle_unlock` would
    short-circuit before reaching `verify_pin`.
    """
    monkeypatch.setattr(hub_client, "check_sender", AsyncMock(return_value=1))


def test_unlock_success(monkeypatch):
    verify_mock = AsyncMock(return_value=True)
    monkeypatch.setattr(hub_client, "verify_pin", verify_mock)

    update = _make_update(chat_id=42)
    context = _make_context(args=["1234"])
    asyncio.run(main.handle_unlock(update, context))

    verify_mock.assert_awaited_once_with("1234")
    update.message.reply_text.assert_awaited_once_with("🔓 unlocked for 10 min")
    assert unlock.is_unlocked(42) is True


def test_unlock_wrong_pin(monkeypatch):
    verify_mock = AsyncMock(return_value=False)
    monkeypatch.setattr(hub_client, "verify_pin", verify_mock)

    update = _make_update(chat_id=42)
    context = _make_context(args=["0000"])
    asyncio.run(main.handle_unlock(update, context))

    verify_mock.assert_awaited_once_with("0000")
    update.message.reply_text.assert_awaited_once_with("⛔ wrong PIN")
    assert unlock.is_unlocked(42) is False


def test_unlock_rate_limited(monkeypatch):
    verify_mock = AsyncMock(side_effect=PinLockedOut(842))
    monkeypatch.setattr(hub_client, "verify_pin", verify_mock)

    update = _make_update(chat_id=42)
    context = _make_context(args=["1234"])
    asyncio.run(main.handle_unlock(update, context))

    # 842s // 60 == 14 → "~14 min"
    update.message.reply_text.assert_awaited_once_with(
        "⛔ too many attempts. Retry in ~14 min."
    )
    assert unlock.is_unlocked(42) is False


def test_unlock_rate_limited_sub_minute_rounds_up_to_one(monkeypatch):
    # Guard against the "~0 min" bug when the remaining lockout is
    # below 60s — we promise the user at least a one-minute wait.
    verify_mock = AsyncMock(side_effect=PinLockedOut(30))
    monkeypatch.setattr(hub_client, "verify_pin", verify_mock)

    update = _make_update(chat_id=42)
    context = _make_context(args=["1234"])
    asyncio.run(main.handle_unlock(update, context))

    update.message.reply_text.assert_awaited_once_with(
        "⛔ too many attempts. Retry in ~1 min."
    )


def test_unlock_auth_service_unavailable(monkeypatch):
    verify_mock = AsyncMock(side_effect=RuntimeError("boom"))
    monkeypatch.setattr(hub_client, "verify_pin", verify_mock)

    update = _make_update(chat_id=42)
    context = _make_context(args=["1234"])
    asyncio.run(main.handle_unlock(update, context))

    update.message.reply_text.assert_awaited_once_with("⛔ auth service unavailable")
    assert unlock.is_unlocked(42) is False


def test_unlock_no_args_prints_usage(monkeypatch):
    verify_mock = AsyncMock()
    monkeypatch.setattr(hub_client, "verify_pin", verify_mock)

    update = _make_update(chat_id=42)
    context = _make_context(args=[])
    asyncio.run(main.handle_unlock(update, context))

    update.message.reply_text.assert_awaited_once_with("⛔ usage: /unlock <pin>")
    verify_mock.assert_not_awaited()
    assert unlock.is_unlocked(42) is False
