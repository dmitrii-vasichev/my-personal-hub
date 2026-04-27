"""Tests for `main._is_whitelisted` — the per-update Hub check-sender gate.

The helper is the single choke-point Task 7 uses to gate all three handlers,
so it's covered here in isolation. Handler-level integration (non-whitelisted
user sends /new → no side effect) overlaps with Task 10's E2E and is skipped.

Phase 3 adds queue-backed dispatch for ``handle_text`` and the new
``/help`` / ``/status`` / ``/cancel`` handlers; those are covered under the
"Handlers" section at the bottom.
"""
import asyncio
import signal
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

import hub_client
import main
import request_queue


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


# ==========================================================================
# Phase 3 — handlers through the request queue
# ==========================================================================


@pytest.fixture(autouse=True)
def _reset_queue_between_tests():
    request_queue._reset_for_tests()
    yield
    request_queue._reset_for_tests()


@pytest.fixture
def _bypass_whitelist(monkeypatch):
    """Let handler tests skip the Hub check-sender path."""

    async def _allow(update, context, settings):
        return True

    monkeypatch.setattr(main, "_is_whitelisted", _allow)


def _settings_stub(progress_enabled: bool = False):
    return SimpleNamespace(
        cc_binary_path="/fake/claude",
        cc_workdir="/tmp/fake",
        cc_timeout=30,
        whitelist_tg_user_id=None,
        progress_enabled=progress_enabled,
        whisper_model_size="small",
        whisper_compute_type="int8",
        whisper_device="cpu",
        default_project="my-personal-hub",
        project_base_dir="/tmp",
        project_deny_list=[],
    )


def _make_handler_update(chat_id: int = 100, text: str = "hello"):
    """Build a minimal Update stand-in that the handler code consumes."""
    reply = AsyncMock(return_value=SimpleNamespace(edit_text=AsyncMock()))
    message = SimpleNamespace(text=text, reply_text=reply, voice=None)
    return SimpleNamespace(
        effective_chat=SimpleNamespace(id=chat_id),
        effective_user=SimpleNamespace(id=42),
        message=message,
    )


def _make_handler_context(settings=None):
    app = SimpleNamespace(bot_data={"settings": settings or _settings_stub()})
    return SimpleNamespace(application=app, chat_data={}, args=[])


def _ok_run_result(stdout: str = "ok"):
    return SimpleNamespace(
        stdout=stdout, stderr="", returncode=0, timed_out=False
    )


# --- /help ----------------------------------------------------------------


def test_help_lists_all_commands(_bypass_whitelist):
    update = _make_handler_update()
    context = _make_handler_context()

    asyncio.run(main.handle_help(update, context))

    body = update.message.reply_text.await_args.args[0]
    for token in ("/new", "/unlock", "/status", "/cancel", "/help"):
        assert token in body


# --- /status --------------------------------------------------------------


def test_status_reports_idle_and_locked(_bypass_whitelist, monkeypatch, tmp_path):
    # Force the session-state file under tmp so the test doesn't mutate the
    # developer's real .state.json.
    monkeypatch.setattr(main, "get_session", lambda chat_id, project: "fake-session-id")

    update = _make_handler_update(chat_id=777)
    context = _make_handler_context()

    asyncio.run(main.handle_status(update, context))

    body = update.message.reply_text.await_args.args[0]
    assert "fake-session-id" in body
    assert "idle" in body
    assert "0 waiting" in body
    assert "locked" in body


def test_status_reports_queue_and_unlock(_bypass_whitelist, monkeypatch):
    monkeypatch.setattr(main, "get_session", lambda chat_id, project: "s")
    # Seed queue state: active job + 2 waiting.
    s = request_queue._state_for(1)
    s.active_label = "text: hello world"
    s.queue.put_nowait(("j1", "l1"))
    s.queue.put_nowait(("j2", "l2"))
    # Mark chat unlocked.
    import unlock as unlock_mod
    unlock_mod.unlock_chat(1)

    update = _make_handler_update(chat_id=1)
    context = _make_handler_context()

    asyncio.run(main.handle_status(update, context))

    body = update.message.reply_text.await_args.args[0]
    assert "text: hello world" in body
    assert "2 waiting" in body
    assert "unlocked until" in body

    # Cleanup: drain put items so the teardown fixture clears cleanly.
    unlock_mod._reset_for_tests()


# --- /cancel --------------------------------------------------------------


def test_cancel_with_no_active_proc(_bypass_whitelist):
    update = _make_handler_update(chat_id=5)
    context = _make_handler_context()

    asyncio.run(main.handle_cancel(update, context))

    body = update.message.reply_text.await_args.args[0]
    assert "nothing to cancel" in body


def test_cancel_sends_sigint_to_active_proc(_bypass_whitelist):
    captured_signals: list[int] = []

    class FakeProc:
        returncode = None  # still running

        def send_signal(self, sig):
            captured_signals.append(sig)

    request_queue._state_for(9).active_proc = FakeProc()

    update = _make_handler_update(chat_id=9)
    context = _make_handler_context()

    asyncio.run(main.handle_cancel(update, context))

    assert captured_signals == [signal.SIGINT]
    # The cancelled flag is what _render_result reads to suppress the
    # "Execution error" stdout that claude -p emits on SIGINT (rc=0).
    assert request_queue.is_cancelled(9)
    body = update.message.reply_text.await_args.args[0]
    assert "stopped" in body.lower()
    assert "may have already" in body


def test_cancel_after_cc_finished_replies_nothing_to_cancel(_bypass_whitelist):
    """Regression for the live-smoke bug on 2026-04-19.

    After run_cc returns, the worker is still streaming chunks through
    _render_result — its finally block (which clears active_proc) hasn't
    run yet. The subprocess is dead, but active_proc still points at it.
    handle_cancel must detect this via ``proc.returncode is not None``
    and reply "nothing to cancel" instead of SIGINTing a reaped PID.
    """
    captured_signals: list[int] = []

    class FinishedProc:
        returncode = 0  # exited successfully

        def send_signal(self, sig):
            captured_signals.append(sig)

    request_queue._state_for(10).active_proc = FinishedProc()

    update = _make_handler_update(chat_id=10)
    context = _make_handler_context()

    asyncio.run(main.handle_cancel(update, context))

    assert captured_signals == [], "must not signal an already-finished PID"
    body = update.message.reply_text.await_args.args[0]
    assert "nothing to cancel" in body


def test_cancel_process_lookup_error_treated_as_nothing_to_cancel(_bypass_whitelist):
    class GoneProc:
        returncode = None  # claims still running, but PID was reaped

        def send_signal(self, sig):
            raise ProcessLookupError("already exited")

    request_queue._state_for(11).active_proc = GoneProc()

    update = _make_handler_update(chat_id=11)
    context = _make_handler_context()

    asyncio.run(main.handle_cancel(update, context))

    body = update.message.reply_text.await_args.args[0]
    assert "nothing to cancel" in body


# --- handle_text through the queue ---------------------------------------


def test_handle_text_dispatches_through_queue(_bypass_whitelist, monkeypatch):
    """A single message goes through the queue without a 'pos N' reply."""
    run_cc_mock = AsyncMock(
        return_value=SimpleNamespace(
            stdout="ok", stderr="", returncode=0, timed_out=False
        )
    )
    monkeypatch.setattr(main, "run_cc", run_cc_mock)
    monkeypatch.setattr(main, "get_session", lambda chat_id, project: "s")

    update = _make_handler_update(chat_id=42, text="ping")
    context = _make_handler_context()

    async def scenario():
        await main.handle_text(update, context)
        worker = request_queue._state_for(42).worker
        if worker is not None:
            await worker

    asyncio.run(scenario())

    run_cc_mock.assert_awaited_once()
    # First reply is the "🤔 thinking…" status, then "✅ done" edit,
    # then the final stdout. No "⏳ in queue" message since position == 0.
    replies = [c.args[0] for c in update.message.reply_text.await_args_list]
    assert any("thinking" in r for r in replies)
    assert not any("in queue" in r for r in replies)


def test_handle_text_shows_position_when_behind_active(_bypass_whitelist, monkeypatch):
    monkeypatch.setattr(main, "get_session", lambda chat_id, project: "s")

    # Fill one active + one waiting so the handler's enqueue lands at pos 2.
    s = request_queue._state_for(88)
    s.active_label = "text: busy"
    s.queue.put_nowait(("j", "l"))
    # Avoid the real worker draining the fake items — leave worker None.

    # run_cc is patched but should not actually be awaited: the test's
    # message sits at pos 2 behind two fake non-executing jobs.
    monkeypatch.setattr(main, "run_cc", AsyncMock())

    update = _make_handler_update(chat_id=88, text="ping")
    context = _make_handler_context()

    asyncio.run(main.handle_text(update, context))

    replies = [c.args[0] for c in update.message.reply_text.await_args_list]
    assert any("in queue (pos 2)" in r for r in replies)


def test_handle_text_queue_full_replies_and_drops(_bypass_whitelist, monkeypatch):
    monkeypatch.setattr(main, "get_session", lambda chat_id, project: "s")
    run_cc_mock = AsyncMock()
    monkeypatch.setattr(main, "run_cc", run_cc_mock)

    # Saturate: 1 active + 4 waiting = MAX_INFLIGHT. No worker so nothing drains.
    s = request_queue._state_for(55)
    s.active_label = "text: active"
    for _ in range(request_queue.MAX_INFLIGHT - 1):
        s.queue.put_nowait(("j", "l"))

    update = _make_handler_update(chat_id=55, text="ping")
    context = _make_handler_context()

    asyncio.run(main.handle_text(update, context))

    replies = [c.args[0] for c in update.message.reply_text.await_args_list]
    assert any("queue full" in r for r in replies)
    run_cc_mock.assert_not_awaited()


# --- progress-flag routing -----------------------------------------------


def test_handle_text_progress_disabled_uses_run_cc(_bypass_whitelist, monkeypatch):
    """Default (grace period) → non-streaming run_cc, no stream-json argv."""
    monkeypatch.setattr(main, "get_session", lambda chat_id, project: "s")
    run_cc_mock = AsyncMock(return_value=_ok_run_result())
    run_cc_streaming_mock = AsyncMock(return_value=_ok_run_result())
    monkeypatch.setattr(main, "run_cc", run_cc_mock)
    monkeypatch.setattr(main, "run_cc_streaming", run_cc_streaming_mock)

    update = _make_handler_update(chat_id=200, text="ping")
    context = _make_handler_context(_settings_stub(progress_enabled=False))

    async def scenario():
        await main.handle_text(update, context)
        worker = request_queue._state_for(200).worker
        if worker is not None:
            await worker

    asyncio.run(scenario())

    run_cc_mock.assert_awaited_once()
    run_cc_streaming_mock.assert_not_awaited()


def test_handle_text_progress_enabled_uses_streaming(_bypass_whitelist, monkeypatch):
    monkeypatch.setattr(main, "get_session", lambda chat_id, project: "s")
    run_cc_mock = AsyncMock(return_value=_ok_run_result())
    run_cc_streaming_mock = AsyncMock(return_value=_ok_run_result("from stream"))
    monkeypatch.setattr(main, "run_cc", run_cc_mock)
    monkeypatch.setattr(main, "run_cc_streaming", run_cc_streaming_mock)

    update = _make_handler_update(chat_id=201, text="ping")
    context = _make_handler_context(_settings_stub(progress_enabled=True))

    async def scenario():
        await main.handle_text(update, context)
        worker = request_queue._state_for(201).worker
        if worker is not None:
            await worker

    asyncio.run(scenario())

    run_cc_mock.assert_not_awaited()
    run_cc_streaming_mock.assert_awaited_once()
    # Kwargs must include an on_event_line closure so progress edits reach us.
    kwargs = run_cc_streaming_mock.await_args.kwargs
    assert "on_event_line" in kwargs and kwargs["on_event_line"] is not None


def test_progress_on_line_throttles_edits_under_10s(_bypass_whitelist, monkeypatch):
    """Two tool_use events within 10s → exactly one status.edit_text call."""
    monkeypatch.setattr(main, "get_session", lambda chat_id, project: "s")

    # Capture the on_event_line callback that handle_text wires up.
    captured_on_line: list = []

    async def fake_streaming(prompt, **kwargs):
        captured_on_line.append(kwargs["on_event_line"])
        return _ok_run_result()

    monkeypatch.setattr(main, "run_cc_streaming", fake_streaming)

    # Pin time.monotonic so the throttle test is deterministic.
    now_val = [1000.0]
    monkeypatch.setattr(main.time, "monotonic", lambda: now_val[0])

    update = _make_handler_update(chat_id=301, text="ping")
    context = _make_handler_context(_settings_stub(progress_enabled=True))

    async def scenario():
        await main.handle_text(update, context)
        worker = request_queue._state_for(301).worker
        if worker is not None:
            await worker

        on_line = captured_on_line[0]
        status_obj = update.message.reply_text.return_value

        # First tool_use — current throttle is 0, allowed.
        await on_line(
            '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Read","input":{"file_path":"/a.md"}}]}}'
        )
        # 5 seconds later — blocked by throttle.
        now_val[0] = 1005.0
        await on_line(
            '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash","input":{"command":"ls"}}]}}'
        )
        # 11 seconds after the first — allowed again.
        now_val[0] = 1011.01
        await on_line(
            '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash","input":{"command":"pwd"}}]}}'
        )
        return status_obj

    status_obj = asyncio.run(scenario())

    # Two allowed edits (first + third), middle one blocked by throttle.
    edits = [c.args[0] for c in status_obj.edit_text.await_args_list]
    # First is the "✅ done" from _render_result; filter those out to count
    # progress edits only.
    progress_edits = [e for e in edits if "done" not in e and "failed" not in e and "timed out" not in e]
    assert len(progress_edits) == 2
    assert progress_edits[0].startswith("📖 reading")
    assert progress_edits[1].startswith("🔧 running")


# --- voice handler -------------------------------------------------------


def _make_voice_update(chat_id: int = 400):
    """Build an Update with a non-None `voice` attached to message."""
    reply = AsyncMock(return_value=SimpleNamespace(edit_text=AsyncMock()))
    voice_obj = SimpleNamespace(file_id="file-abc", duration=3)
    message = SimpleNamespace(text=None, voice=voice_obj, reply_text=reply)
    return SimpleNamespace(
        effective_chat=SimpleNamespace(id=chat_id),
        effective_user=SimpleNamespace(id=42),
        message=message,
    )


def _make_voice_context(settings=None):
    """Extend the handler context with a `bot.get_file` AsyncMock."""
    downloaded = AsyncMock(return_value=bytearray(b"\x00\x01\x02 fake ogg"))
    file_obj = SimpleNamespace(download_as_bytearray=downloaded)
    bot = SimpleNamespace(get_file=AsyncMock(return_value=file_obj))
    app = SimpleNamespace(bot_data={"settings": settings or _settings_stub()})
    return SimpleNamespace(application=app, chat_data={}, args=[], bot=bot)


def test_voice_handler_echoes_transcript_then_dispatches_cc(_bypass_whitelist, monkeypatch):
    monkeypatch.setattr(main, "get_session", lambda chat_id, project: "s")
    transcribe = AsyncMock(return_value="привет мир")
    monkeypatch.setattr(main.voice, "transcribe_bytes", transcribe)
    run_cc_mock = AsyncMock(return_value=_ok_run_result("done"))
    monkeypatch.setattr(main, "run_cc", run_cc_mock)

    update = _make_voice_update(chat_id=400)
    context = _make_voice_context()

    async def scenario():
        await main.handle_voice(update, context)
        worker = request_queue._state_for(400).worker
        if worker is not None:
            await worker

    asyncio.run(scenario())

    # Transcript must be echoed verbatim (PRD Q4 "always on preview").
    replies = [c.args[0] for c in update.message.reply_text.await_args_list]
    assert any("🎙 transcribed: привет мир" in r for r in replies)

    # CC dispatched with the transcript as the prompt.
    transcribe.assert_awaited_once()
    assert transcribe.await_args.kwargs["device"] == "cpu"
    assert transcribe.await_args.kwargs["audio_duration_s"] == 3
    run_cc_mock.assert_awaited_once()
    assert run_cc_mock.await_args.args[0] == "привет мир"


def test_voice_handler_transcription_failure_replies_warning_no_dispatch(_bypass_whitelist, monkeypatch):
    monkeypatch.setattr(main, "get_session", lambda chat_id, project: "s")
    monkeypatch.setattr(
        main.voice,
        "transcribe_bytes",
        AsyncMock(side_effect=RuntimeError("whisper died")),
    )
    run_cc_mock = AsyncMock()
    monkeypatch.setattr(main, "run_cc", run_cc_mock)

    update = _make_voice_update(chat_id=401)
    context = _make_voice_context()

    async def scenario():
        await main.handle_voice(update, context)
        worker = request_queue._state_for(401).worker
        if worker is not None:
            await worker

    asyncio.run(scenario())

    replies = [c.args[0] for c in update.message.reply_text.await_args_list]
    assert any("transcription failed" in r for r in replies)
    run_cc_mock.assert_not_awaited()


def test_voice_handler_empty_transcript_replies_warning_no_dispatch(_bypass_whitelist, monkeypatch):
    monkeypatch.setattr(main, "get_session", lambda chat_id, project: "s")
    monkeypatch.setattr(main.voice, "transcribe_bytes", AsyncMock(return_value=""))
    run_cc_mock = AsyncMock()
    monkeypatch.setattr(main, "run_cc", run_cc_mock)

    update = _make_voice_update(chat_id=402)
    context = _make_voice_context()

    async def scenario():
        await main.handle_voice(update, context)
        worker = request_queue._state_for(402).worker
        if worker is not None:
            await worker

    asyncio.run(scenario())

    replies = [c.args[0] for c in update.message.reply_text.await_args_list]
    assert any("empty text" in r for r in replies)
    run_cc_mock.assert_not_awaited()


def test_voice_handler_queue_full_replies_and_skips_transcription(_bypass_whitelist, monkeypatch):
    """When capacity is saturated, don't even download+transcribe — reject."""
    monkeypatch.setattr(main, "get_session", lambda chat_id, project: "s")
    transcribe = AsyncMock()
    monkeypatch.setattr(main.voice, "transcribe_bytes", transcribe)

    s = request_queue._state_for(403)
    s.active_label = "text: active"
    for _ in range(request_queue.MAX_INFLIGHT - 1):
        s.queue.put_nowait(("j", "l"))

    update = _make_voice_update(chat_id=403)
    context = _make_voice_context()

    asyncio.run(main.handle_voice(update, context))

    replies = [c.args[0] for c in update.message.reply_text.await_args_list]
    assert any("queue full" in r for r in replies)
    transcribe.assert_not_awaited()
    # The Telegram file-download API must not have been invoked either —
    # enqueue runs before the job body.
    context.bot.get_file.assert_not_awaited()


def test_progress_on_line_swallows_telegram_edit_failure(_bypass_whitelist, monkeypatch):
    """A 400 from editMessageText must not abort the CC run."""
    monkeypatch.setattr(main, "get_session", lambda chat_id, project: "s")

    captured_on_line: list = []

    async def fake_streaming(prompt, **kwargs):
        captured_on_line.append(kwargs["on_event_line"])
        return _ok_run_result()

    monkeypatch.setattr(main, "run_cc_streaming", fake_streaming)
    monkeypatch.setattr(main.time, "monotonic", lambda: 1000.0)

    update = _make_handler_update(chat_id=302, text="ping")
    status = update.message.reply_text.return_value
    status.edit_text = AsyncMock(side_effect=RuntimeError("telegram 400"))
    context = _make_handler_context(_settings_stub(progress_enabled=True))

    async def scenario():
        await main.handle_text(update, context)
        worker = request_queue._state_for(302).worker
        if worker is not None:
            await worker
        on_line = captured_on_line[0]
        # Must not raise even though status.edit_text explodes.
        await on_line(
            '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Read","input":{"file_path":"/a.md"}}]}}'
        )

    # If we get here without an exception, the test passes.
    asyncio.run(scenario())


# --- _render_result cancel path ------------------------------------------


def test_render_result_when_cancelled_skips_stdout_and_edits_to_cancelled(
    _bypass_whitelist,
):
    """Regression for the 2026-04-19 ``Execution error`` ghost reply.

    claude -p exits rc=0 with stdout ``"Execution error"`` when SIGINT'd
    mid-generation. Without the cancel guard, _render_result would edit
    status to ✅ done and forward that string as if it were the model's
    answer, on top of the ``🛑 stopped…`` that handle_cancel already sent.
    """
    chat_id = 999
    # Create state the way the enqueue path would, then flip the flag the
    # way handle_cancel does.
    request_queue._state_for(chat_id)
    request_queue.mark_cancelled(chat_id)
    assert request_queue.is_cancelled(chat_id)

    update = _make_handler_update(chat_id=chat_id)
    status = SimpleNamespace(edit_text=AsyncMock())
    result = _ok_run_result(stdout="Execution error")
    settings = _settings_stub()

    asyncio.run(
        main._render_result(update, status, result, settings, chat_id)
    )

    status.edit_text.assert_awaited_once()
    edit_arg = status.edit_text.await_args.args[0]
    assert "cancel" in edit_arg.lower()
    # The user must NOT see CC's interrupted-run stdout as a model reply.
    update.message.reply_text.assert_not_called()


# --- /project -------------------------------------------------------------


import projects as projects_mod  # noqa: E402 — imported here so earlier tests
# don't have to care about this module's existence.
import state as state_mod  # noqa: E402


@pytest.fixture
def _isolated_state_file(tmp_path, monkeypatch):
    """Keep /project callback tests from mutating the real .state.json."""
    monkeypatch.setattr(state_mod, "STATE_FILE", tmp_path / ".state.json")
    monkeypatch.setattr(state_mod, "_default_project", None)
    state_mod.configure("my-personal-hub")
    yield tmp_path / ".state.json"


def _project_handler_context(projects=None, settings=None):
    app = SimpleNamespace(
        bot_data={
            "settings": settings or _settings_stub(),
            "projects": projects
            if projects is not None
            else [
                projects_mod.Project(name="my-personal-hub", path="/tmp/my-personal-hub"),
                projects_mod.Project(name="moving", path="/tmp/moving"),
            ],
        }
    )
    return SimpleNamespace(application=app, chat_data={}, args=[])


def test_project_command_renders_keyboard_with_active_marker(
    _bypass_whitelist, _isolated_state_file
):
    update = _make_handler_update(chat_id=777)
    context = _project_handler_context()

    asyncio.run(main.handle_project(update, context))

    call = update.message.reply_text.await_args
    body = call.args[0]
    # Default active project is my-personal-hub — keyboard must mark it.
    assert "active: my-personal-hub" in body
    markup = call.kwargs["reply_markup"]
    labels = [row[0].text for row in markup.inline_keyboard]
    assert "✅ my-personal-hub" in labels
    assert "moving" in labels  # no tick, not active
    datas = [row[0].callback_data for row in markup.inline_keyboard]
    assert set(datas) == {"proj:my-personal-hub", "proj:moving"}


def test_project_command_with_no_projects_shows_hint(
    _bypass_whitelist, _isolated_state_file
):
    update = _make_handler_update(chat_id=1)
    context = _project_handler_context(projects=[])

    asyncio.run(main.handle_project(update, context))

    body = update.message.reply_text.await_args.args[0]
    assert "no projects" in body.lower()
    assert "/refresh" in body


def test_refresh_command_rediscovers_projects(
    _bypass_whitelist, _isolated_state_file, monkeypatch
):
    update = _make_handler_update(chat_id=1)
    context = _project_handler_context(
        projects=[
            projects_mod.Project(name="my-personal-hub", path="/tmp/my-personal-hub")
        ]
    )
    discovered = [
        projects_mod.Project(name="moving", path="/tmp/moving"),
        projects_mod.Project(name="my-personal-hub", path="/tmp/my-personal-hub"),
    ]
    monkeypatch.setattr(main.projects_mod, "discover", lambda base, deny: discovered)

    asyncio.run(main.handle_refresh(update, context))

    assert context.application.bot_data["projects"] == discovered
    assert main._projects_ref["known"] == discovered
    body = update.message.reply_text.await_args.args[0]
    assert "2 found" in body
    assert "added: moving" in body


def test_refresh_command_reports_removed_projects(
    _bypass_whitelist, _isolated_state_file, monkeypatch
):
    update = _make_handler_update(chat_id=1)
    context = _project_handler_context()
    discovered = [
        projects_mod.Project(name="my-personal-hub", path="/tmp/my-personal-hub"),
    ]
    monkeypatch.setattr(main.projects_mod, "discover", lambda base, deny: discovered)

    asyncio.run(main.handle_refresh(update, context))

    body = update.message.reply_text.await_args.args[0]
    assert "removed: moving" in body


def _make_callback_update(user_id: int = 42, data: str = "proj:moving", chat_id: int = 777):
    query = SimpleNamespace(
        answer=AsyncMock(),
        from_user=SimpleNamespace(id=user_id),
        data=data,
        message=SimpleNamespace(chat_id=chat_id),
        edit_message_text=AsyncMock(),
    )
    return SimpleNamespace(callback_query=query)


def test_project_callback_updates_active_project(
    monkeypatch, _isolated_state_file
):
    monkeypatch.setattr(hub_client, "check_sender", AsyncMock(return_value=99))

    update = _make_callback_update(data="proj:moving", chat_id=555)
    context = _project_handler_context()

    asyncio.run(main.handle_project_callback(update, context))

    update.callback_query.answer.assert_awaited_once()
    update.callback_query.edit_message_text.assert_awaited_once()
    edit_body = update.callback_query.edit_message_text.await_args.args[0]
    assert "switched to moving" in edit_body
    assert state_mod.get_active_project(555, "my-personal-hub") == "moving"


def test_project_callback_ignores_unknown_project_name(
    monkeypatch, _isolated_state_file
):
    monkeypatch.setattr(hub_client, "check_sender", AsyncMock(return_value=99))

    update = _make_callback_update(data="proj:doesnotexist", chat_id=555)
    context = _project_handler_context()

    asyncio.run(main.handle_project_callback(update, context))

    edit_body = update.callback_query.edit_message_text.await_args.args[0]
    assert "unknown project" in edit_body.lower()
    # State must not flip — chat still on the default.
    assert (
        state_mod.get_active_project(555, "my-personal-hub")
        == "my-personal-hub"
    )


def test_project_callback_drops_non_whitelisted_taps(
    monkeypatch, _isolated_state_file
):
    # Hub returns None (not whitelisted) AND env whitelist doesn't match.
    monkeypatch.setattr(hub_client, "check_sender", AsyncMock(return_value=None))

    update = _make_callback_update(user_id=9999, data="proj:moving", chat_id=555)
    context = _project_handler_context()

    asyncio.run(main.handle_project_callback(update, context))

    update.callback_query.answer.assert_awaited_once()
    # Must not edit the message and must not flip state.
    update.callback_query.edit_message_text.assert_not_called()
    assert (
        state_mod.get_active_project(555, "my-personal-hub")
        == "my-personal-hub"
    )


def test_project_callback_env_fallback_on_hub_error(
    monkeypatch, _isolated_state_file
):
    monkeypatch.setattr(
        hub_client, "check_sender", AsyncMock(side_effect=RuntimeError("boom"))
    )
    settings = _settings_stub()
    settings.whitelist_tg_user_id = 42

    update = _make_callback_update(user_id=42, data="proj:moving", chat_id=555)
    context = _project_handler_context(settings=settings)

    asyncio.run(main.handle_project_callback(update, context))

    update.callback_query.edit_message_text.assert_awaited_once()
    assert state_mod.get_active_project(555, "my-personal-hub") == "moving"


def test_help_includes_project_command(_bypass_whitelist):
    update = _make_handler_update()
    context = _make_handler_context()
    asyncio.run(main.handle_help(update, context))
    body = update.message.reply_text.await_args.args[0]
    assert "/project" in body
    assert "/refresh" in body


# --- Active-project routing (Task 4) -------------------------------------


@pytest.fixture
def _known_projects(monkeypatch):
    """Register a known-project set in the module-level ref."""
    known = [
        projects_mod.Project(name="my-personal-hub", path="/p/hub"),
        projects_mod.Project(name="moving", path="/p/moving"),
    ]
    monkeypatch.setitem(main._projects_ref, "known", known)
    yield known


def test_active_project_default_when_chat_never_picked(_isolated_state_file, _known_projects):
    settings = _settings_stub()
    name, workdir = main._active_project(settings, chat_id=111)
    assert name == "my-personal-hub"
    assert workdir == "/p/hub"


def test_active_project_uses_picked_name_and_its_path(_isolated_state_file, _known_projects):
    state_mod.set_active_project(222, "moving")
    settings = _settings_stub()
    name, workdir = main._active_project(settings, chat_id=222)
    assert name == "moving"
    assert workdir == "/p/moving"


def test_active_project_stale_falls_back_to_default_and_warns(
    _isolated_state_file, _known_projects, caplog
):
    # Chat picked "ghost" earlier; since then discovery dropped it.
    state_mod.set_active_project(333, "ghost")
    settings = _settings_stub()
    with caplog.at_level("WARNING"):
        name, workdir = main._active_project(settings, chat_id=333)
    assert name == "my-personal-hub"
    assert workdir == "/p/hub"
    assert any("ghost" in rec.message for rec in caplog.records)
    # State must NOT be rewritten — the chat still points at "ghost" so the
    # user sees the fallback in /status and can re-pick explicitly.
    assert state_mod.get_active_project(333, "my-personal-hub") == "ghost"


def test_active_project_extreme_fallback_when_discovery_empty(
    _isolated_state_file, monkeypatch
):
    monkeypatch.setitem(main._projects_ref, "known", [])
    settings = _settings_stub()
    name, workdir = main._active_project(settings, chat_id=444)
    assert name == "my-personal-hub"
    # No discovered projects → fall through to the raw cc_workdir so the bot
    # still works (Phase 4 behaviour preserved).
    assert workdir == settings.cc_workdir


def test_handle_text_routes_workdir_to_active_project(
    _bypass_whitelist, _isolated_state_file, _known_projects, monkeypatch
):
    captured: dict = {}

    async def fake_run_cc(prompt, **kwargs):
        captured.update(kwargs)
        return _ok_run_result()

    monkeypatch.setattr(main, "run_cc", fake_run_cc)
    state_mod.set_active_project(777, "moving")

    update = _make_handler_update(chat_id=777, text="ping")
    context = _make_handler_context()

    async def scenario():
        await main.handle_text(update, context)
        worker = request_queue._state_for(777).worker
        if worker is not None:
            await worker

    asyncio.run(scenario())

    assert captured["workdir"] == "/p/moving"
    # session_id must be the UUID persisted for (777, "moving"), not the
    # default TG_DEFAULT_UUID.
    expected = state_mod.get_session(777, "moving")
    assert captured["session_id"] == expected
    assert captured["session_id"] != state_mod.TG_DEFAULT_UUID


def test_handle_new_resets_only_the_active_projects_session(
    _bypass_whitelist, _isolated_state_file, _known_projects
):
    # Seed: chat 888 has "my-personal-hub" session A and "moving" session B.
    state_mod.new_session(888, "my-personal-hub")
    u_hub_before = state_mod.get_session(888, "my-personal-hub")
    state_mod.new_session(888, "moving")
    u_moving_before = state_mod.get_session(888, "moving")
    # Switch active to "moving", then /new.
    state_mod.set_active_project(888, "moving")

    update = _make_handler_update(chat_id=888)
    context = _make_handler_context()
    asyncio.run(main.handle_new(update, context))

    # "moving" got a fresh UUID; "my-personal-hub" untouched.
    u_moving_after = state_mod.get_session(888, "moving")
    u_hub_after = state_mod.get_session(888, "my-personal-hub")
    assert u_moving_after != u_moving_before
    assert u_hub_after == u_hub_before
    body = update.message.reply_text.await_args.args[0]
    assert "moving" in body


def test_status_shows_active_project_on_top(
    _bypass_whitelist, _isolated_state_file, _known_projects
):
    state_mod.set_active_project(999, "moving")
    update = _make_handler_update(chat_id=999)
    context = _make_handler_context()

    asyncio.run(main.handle_status(update, context))

    body = update.message.reply_text.await_args.args[0]
    assert "project: `moving`" in body
