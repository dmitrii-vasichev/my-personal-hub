import asyncio
import logging
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
import unlock
from cc_runner import run_cc
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


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    settings = context.application.bot_data["settings"]
    if not await _is_whitelisted(update, context, settings):
        return
    prompt = update.message.text or ""
    log.info("dispatching to cc len=%d", len(prompt))

    # Single static status message — no spinner animation. Telegram's
    # anti-abuse classifier has been observed (2026-04-18) to flag fresh
    # bots that emit sub-15-second `editMessageText` bursts; we now edit
    # this message exactly once, on the final state transition.
    status = await update.message.reply_text("🤔 thinking…")

    result = await run_cc(
        prompt,
        binary_path=settings.cc_binary_path,
        workdir=settings.cc_workdir,
        session_id=get_session(update.effective_chat.id),
        timeout=settings.cc_timeout,
        settings_path=_profile_for(update.effective_chat.id),
    )

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
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    log.info("starting bot polling session_default=%s", TG_DEFAULT_UUID)
    # Do not pass drop_pending_updates — PTB would then call deleteWebhook
    # on every start. For a polling-only bot with no webhook, that call
    # is noise that anti-abuse may interpret as state churn on a fresh token.
    app.run_polling()


if __name__ == "__main__":
    main()
