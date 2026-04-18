import asyncio
import logging
import uuid

from telegram import Update
from telegram.ext import (
    ApplicationBuilder,
    ContextTypes,
    MessageHandler,
    filters,
)

from cc_runner import run_cc
from chunker import chunk_reply
from config import load_settings
from log_setup import setup_logging

log = logging.getLogger(__name__)

SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

# Deterministic UUID for the default CC session — `claude -p --session-id`
# requires a valid UUID, so we derive one from the logical label "tg-default"
# to keep a single continuous conversation across bot restarts.
TG_DEFAULT_SESSION_UUID = str(uuid.uuid5(uuid.NAMESPACE_DNS, "tg-default"))


async def _spin(message, stop: asyncio.Event) -> None:
    idx = 0
    while not stop.is_set():
        try:
            await message.edit_text(f"{SPINNER_FRAMES[idx % len(SPINNER_FRAMES)]} thinking…")
        except Exception:  # noqa: BLE001 — TG edit may rate-limit
            pass
        idx += 1
        try:
            await asyncio.wait_for(stop.wait(), timeout=2.0)
        except asyncio.TimeoutError:
            continue


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    settings = context.application.bot_data["settings"]
    user = update.effective_user
    if user is None or user.id != settings.whitelist_tg_user_id:
        log.debug("drop update from non-whitelisted id=%s", user.id if user else None)
        return
    prompt = update.message.text or ""
    log.info("dispatching to cc len=%d", len(prompt))

    status = await update.message.reply_text("🤔 thinking…")
    stop = asyncio.Event()
    spinner_task = asyncio.create_task(_spin(status, stop))

    try:
        result = await run_cc(
            prompt,
            binary_path=settings.cc_binary_path,
            workdir=settings.cc_workdir,
            session_id=TG_DEFAULT_SESSION_UUID,
            timeout=settings.cc_timeout,
        )
    finally:
        stop.set()
        await spinner_task

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
        for chunk in chunk_reply(result.stdout):
            await update.message.reply_text(chunk)
    else:
        await update.message.reply_text("(empty reply)")


def main() -> None:
    settings = load_settings()
    setup_logging(settings.log_level)
    app = ApplicationBuilder().token(settings.telegram_bot_token).build()
    app.bot_data["settings"] = settings
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    log.info("starting bot polling session_default=%s", TG_DEFAULT_SESSION_UUID)
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
