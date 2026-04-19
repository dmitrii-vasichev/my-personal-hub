import asyncio
import logging
import signal
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from telegram import Update
from telegram.ext import (
    Application,
    ApplicationBuilder,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

import hub_client
import progress
import request_queue
import unlock
import voice
from cc_runner import run_cc, run_cc_streaming
from chunker import chunk_reply
from config import load_settings
from hub_client import PinLockedOut
from log_setup import setup_logging
from state import TG_DEFAULT_UUID, get_session, new_session
from unlock import unlock_chat

log = logging.getLogger(__name__)

# Minimum pause between consecutive sendMessage calls in a chunked reply.
# Keeps bursts under Telegram's anti-abuse thresholds for fresh bots.
CHUNK_SEND_INTERVAL_S = 0.7

# Cache the Hub's check-sender verdict per chat for this many seconds, so
# we don't hit the Hub on every single message. The owner's whitelist does
# not flip frequently, but unlock state / short network hiccups benefit
# from a short TTL.
WHITELIST_CACHE_S = 60

# Claude Code deny-list profiles. Locked is the default; unlocked widens the
# bash toolbelt for ~10 minutes after a successful /unlock. See Phase 2 PRD
# (decisions Q6a/Q6b) for the exact deny-list contents.
PROFILES_DIR = Path(__file__).parent / "profiles"
LOCKED_PROFILE = str(PROFILES_DIR / "locked.settings.json")
UNLOCKED_PROFILE = str(PROFILES_DIR / "unlocked.settings.json")

HELP_TEXT = (
    "/new — start a fresh CC session for this chat\n"
    "/unlock <pin> — unlock destructive ops for 10 min\n"
    "/status — current session, queue depth, unlock state\n"
    "/cancel — stop the current CC run (may leave partial state)\n"
    "/help — this message"
)


def _profile_for(chat_id: int) -> str:
    """Pick the CC settings profile based on the per-chat unlock state."""
    return UNLOCKED_PROFILE if unlock.is_unlocked(chat_id) else LOCKED_PROFILE


async def _is_whitelisted(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    settings,
) -> bool:
    """Return True iff the update's sender may talk to the bot.

    Primary source of truth is the Hub's ``/api/telegram/auth/check-sender``
    endpoint. On any transport/5xx failure we fall back to the optional env
    whitelist (``settings.whitelist_tg_user_id``); if neither source allows
    the user, we fail closed. A 404 from the Hub is authoritative ("not
    whitelisted") and does NOT trigger the env fallback.
    """
    user = update.effective_user
    if user is None:
        return False

    now = datetime.now(timezone.utc)
    cached_at = context.chat_data.get("whitelist_verified_at")
    if cached_at is not None and now - cached_at < timedelta(seconds=WHITELIST_CACHE_S):
        return context.chat_data.get("whitelist_ok", False)

    try:
        hub_id = await hub_client.check_sender(user.id)
        ok = hub_id is not None
    except Exception as exc:  # noqa: BLE001 — broad by design: any failure (network, 5xx, coding bug) falls through to the env fallback
        log.warning("check_sender failed (%s), falling back to env whitelist", type(exc).__name__)
        ok = (
            settings.whitelist_tg_user_id is not None
            and user.id == settings.whitelist_tg_user_id
        )

    context.chat_data["whitelist_verified_at"] = now
    context.chat_data["whitelist_ok"] = ok
    if not ok:
        log.debug("drop update from non-whitelisted id=%s", user.id)
    return ok


async def _render_result(update, status, result, settings) -> None:
    """Turn a ``RunResult`` into user-visible messages.

    Factored out of ``handle_text`` so the voice handler (Phase 3 Task 3)
    can reuse the same terminal-state rendering verbatim.
    """
    if result.timed_out:
        await status.edit_text("⏱ timed out")
        await update.message.reply_text(
            f"CC subprocess exceeded {settings.cc_timeout}s and was cancelled."
        )
        return

    if result.returncode != 0:
        await status.edit_text("❌ failed")
        tail = "\n".join(
            [ln for ln in result.stderr.splitlines() if ln.strip()][-3:]
        ) or "no stderr"
        await update.message.reply_text(
            f"⚠️ CC error (rc={result.returncode}):\n```\n{tail}\n```"
        )
        return

    await status.edit_text("✅ done")
    if result.stdout.strip():
        chunks = chunk_reply(result.stdout)
        for i, chunk in enumerate(chunks):
            if i > 0:
                await asyncio.sleep(CHUNK_SEND_INTERVAL_S)
            await update.message.reply_text(chunk)
    else:
        await update.message.reply_text("(empty reply)")


async def _run_cc_with_optional_progress(
    state: request_queue.ChatQueueState,
    prompt: str,
    *,
    settings,
    status,
    chat_id: int,
):
    """Run CC with or without stream-json progress based on settings.

    When ``settings.progress_enabled`` is False (the default grace-period
    state), the bot runs the Phase 2 non-streaming path — a single
    ``🤔 thinking…`` edit followed by the terminal transition. When True,
    stream-json is parsed and the status message is edited on every
    ``tool_use`` event that clears the ≥10 s throttle.
    """
    on_spawn = lambda p: setattr(state, "active_proc", p)  # noqa: E731

    if not settings.progress_enabled:
        return await run_cc(
            prompt,
            binary_path=settings.cc_binary_path,
            workdir=settings.cc_workdir,
            session_id=get_session(chat_id),
            timeout=settings.cc_timeout,
            settings_path=_profile_for(chat_id),
            on_spawn=on_spawn,
        )

    progress_state = progress.StatusState()

    async def on_line(line: str) -> None:
        status_text = progress.parse_line(line, progress_state)
        if status_text is None:
            return
        now = time.monotonic()
        if not progress.should_edit(progress_state, now):
            return
        try:
            await status.edit_text(status_text)
        except Exception:  # noqa: BLE001 — status edits are best-effort;
            # "message not modified" and other 400s from Telegram must not
            # abort the CC subprocess.
            log.debug("status edit failed, continuing", exc_info=True)
            return
        progress.mark_edited(progress_state, now)

    return await run_cc_streaming(
        prompt,
        binary_path=settings.cc_binary_path,
        workdir=settings.cc_workdir,
        session_id=get_session(chat_id),
        timeout=settings.cc_timeout,
        settings_path=_profile_for(chat_id),
        on_spawn=on_spawn,
        on_event_line=on_line,
    )


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    settings = context.application.bot_data["settings"]
    if not await _is_whitelisted(update, context, settings):
        return
    prompt = update.message.text or ""
    chat_id = update.effective_chat.id
    log.info("dispatching to cc len=%d", len(prompt))

    async def _job(state: request_queue.ChatQueueState) -> None:
        # Single static status message. When progress is disabled (default)
        # this message is edited exactly once on the final transition —
        # Phase 2 anti-abuse behaviour. When progress is enabled, stream-json
        # events may re-edit it, but no more often than every 10 seconds.
        status = await update.message.reply_text("🤔 thinking…")
        result = await _run_cc_with_optional_progress(
            state, prompt, settings=settings, status=status, chat_id=chat_id
        )
        await _render_result(update, status, result, settings)

    try:
        position = await request_queue.enqueue(
            chat_id, _job, label=f"text: {prompt[:40]}"
        )
    except request_queue.QueueFull:
        await update.message.reply_text("⛔ queue full, try later")
        return

    if position > 0:
        # Queued behind other work — let the user know their place so they
        # don't think the message was dropped.
        await update.message.reply_text(f"⏳ in queue (pos {position})")


async def handle_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await _is_whitelisted(
        update, context, context.application.bot_data["settings"]
    ):
        return
    await update.message.reply_text(HELP_TEXT)


async def handle_status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await _is_whitelisted(
        update, context, context.application.bot_data["settings"]
    ):
        return
    chat_id = update.effective_chat.id
    session = get_session(chat_id)
    depth = request_queue.queue_depth(chat_id)
    active = request_queue.active_label(chat_id) or "idle"
    expires = unlock.unlock_expires_at(chat_id)
    if expires is not None:
        # Render in the bot host's local timezone — the owner reads /status
        # on their own device and expects local wall-clock.
        unlock_line = f"unlocked until {expires.astimezone().strftime('%H:%M')}"
    else:
        unlock_line = "locked"
    await update.message.reply_text(
        f"session: `{session}`\n"
        f"active: {active}\n"
        f"queue: {depth} waiting\n"
        f"state: {unlock_line}",
        parse_mode="Markdown",
    )


async def handle_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await _is_whitelisted(
        update, context, context.application.bot_data["settings"]
    ):
        return
    chat_id = update.effective_chat.id
    proc = request_queue.active_proc(chat_id)
    # ``active_proc`` stays non-None while the job's ``_render_result`` is
    # still chunking the reply (the worker clears it only in its ``finally``).
    # In that window the subprocess has already exited — ``proc.returncode``
    # is no longer None — so we treat it as nothing-to-cancel rather than
    # signalling a dead PID.
    if proc is None or proc.returncode is not None:
        await update.message.reply_text("🟢 nothing to cancel")
        return
    try:
        proc.send_signal(signal.SIGINT)
    except ProcessLookupError:
        await update.message.reply_text("🟢 nothing to cancel")
        return
    # PRD decision Q5: accept the half-state risk on cancel and surface the
    # caveat verbatim to the user so partial writes are not a surprise.
    await update.message.reply_text(
        "🛑 stopped. Some actions may have already executed — check state manually."
    )


async def handle_new(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await _is_whitelisted(
        update, context, context.application.bot_data["settings"]
    ):
        return
    chat_id = update.effective_chat.id
    new_uuid = new_session(chat_id)
    log.info("new session chat_id=%s uuid=%s", chat_id, new_uuid)
    await update.message.reply_text(f"🆕 new session: {new_uuid}")


async def handle_unlock(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await _is_whitelisted(
        update, context, context.application.bot_data["settings"]
    ):
        return
    chat_id = update.effective_chat.id
    args = context.args or []
    if not args:
        await update.message.reply_text("⛔ usage: /unlock <pin>")
        return
    pin = args[0]
    try:
        ok = await hub_client.verify_pin(pin)
    except PinLockedOut as e:
        # Avoid rendering "~0 min" when the remaining window is under a minute.
        minutes = max(1, e.seconds // 60)
        await update.message.reply_text(
            f"⛔ too many attempts. Retry in ~{minutes} min."
        )
        return
    except Exception:  # noqa: BLE001 — defensive catch to keep PTB from
        # dumping a traceback into the chat on transport/5xx failures.
        log.exception("verify_pin failed unexpectedly")
        await update.message.reply_text("⛔ auth service unavailable")
        return

    if ok:
        unlock_chat(chat_id)
        log.info("unlock granted chat_id=%s", chat_id)
        await update.message.reply_text("🔓 unlocked for 10 min")
    else:
        await update.message.reply_text("⛔ wrong PIN")


async def handle_voice(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    settings = context.application.bot_data["settings"]
    if not await _is_whitelisted(update, context, settings):
        return

    chat_id = update.effective_chat.id
    vm = update.message.voice
    if vm is None:
        # Defensive — the filter should prevent this, but we'd rather drop
        # than crash on a malformed update.
        return

    async def _job(state: request_queue.ChatQueueState) -> None:
        # Download the Opus .ogg blob into memory; voice notes are small
        # enough (≤10 MB per TG) that spilling to disk buys nothing.
        file = await context.bot.get_file(vm.file_id)
        audio_bytes = bytes(await file.download_as_bytearray())

        try:
            transcript = await voice.transcribe_bytes(
                audio_bytes,
                model_size=settings.whisper_model_size,
                compute_type=settings.whisper_compute_type,
            )
        except Exception:  # noqa: BLE001 — any whisper failure surfaces to the
            # user as a terse warning; the bot stays alive for the next message.
            log.exception("voice transcription failed")
            await update.message.reply_text("⚠️ transcription failed")
            return

        if not transcript:
            await update.message.reply_text("⚠️ transcription produced empty text")
            return

        # PRD decision Q4 — always echo the full transcript, regardless of
        # length. Short voice commands with misrecognitions are the
        # dangerous case; the user must see what CC will actually act on.
        for i, chunk in enumerate(chunk_reply(f"🎙 transcribed: {transcript}")):
            if i > 0:
                await asyncio.sleep(CHUNK_SEND_INTERVAL_S)
            await update.message.reply_text(chunk)

        status = await update.message.reply_text("🤔 thinking…")
        result = await _run_cc_with_optional_progress(
            state, transcript, settings=settings, status=status, chat_id=chat_id
        )
        await _render_result(update, status, result, settings)

    try:
        position = await request_queue.enqueue(chat_id, _job, label="voice")
    except request_queue.QueueFull:
        await update.message.reply_text("⛔ queue full, try later")
        return

    if position > 0:
        await update.message.reply_text(f"⏳ in queue (pos {position})")


async def _post_init(app: Application) -> None:
    settings = app.bot_data["settings"]
    hub_client.init(settings.hub_api_url, settings.hub_api_token)
    log.info("hub_client initialised base_url=%s", settings.hub_api_url)


async def _post_shutdown(app: Application) -> None:
    await hub_client.shutdown()
    log.info("hub_client shut down")


def main() -> None:
    settings = load_settings()
    setup_logging(settings.log_level)
    app = (
        ApplicationBuilder()
        .token(settings.telegram_bot_token)
        .post_init(_post_init)
        .post_shutdown(_post_shutdown)
        .build()
    )
    app.bot_data["settings"] = settings
    app.add_handler(CommandHandler("new", handle_new))
    app.add_handler(CommandHandler("unlock", handle_unlock))
    app.add_handler(CommandHandler("help", handle_help))
    app.add_handler(CommandHandler("status", handle_status))
    app.add_handler(CommandHandler("cancel", handle_cancel))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    app.add_handler(MessageHandler(filters.VOICE, handle_voice))
    log.info("starting bot polling session_default=%s", TG_DEFAULT_UUID)
    # Do not pass drop_pending_updates — PTB would then call deleteWebhook
    # on every start. For a polling-only bot with no webhook, that call
    # is noise that anti-abuse may interpret as state churn on a fresh token.
    app.run_polling()


if __name__ == "__main__":
    main()
