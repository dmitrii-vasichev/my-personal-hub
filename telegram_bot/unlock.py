"""Per-chat unlock state for the Telegram→CC bridge.

Task 5 of Phase 2: after a successful ``/unlock <pin>``, the chat enters an
"unlocked" window during which Task 6 will spawn ``claude -p`` with the
``unlocked.settings.json`` profile instead of the default locked one.

The state is module-level and deliberately in-memory only — losing it on
process restart is a feature, not a bug (PRD): any restart forces the user
to re-unlock, which bounds exposure of the wider toolbelt to the length of
a single bot run.
"""

from datetime import datetime, timedelta, timezone

UNLOCK_DURATION = timedelta(minutes=10)

# chat_id → UTC datetime at which the unlock expires.
_unlock_until: dict[int, datetime] = {}


def unlock_chat(chat_id: int, duration: timedelta = UNLOCK_DURATION) -> datetime:
    """Mark ``chat_id`` as unlocked for ``duration`` from now. Returns the
    expiry timestamp (UTC)."""
    until = datetime.now(timezone.utc) + duration
    _unlock_until[chat_id] = until
    return until


def is_unlocked(chat_id: int) -> bool:
    """Return True iff the chat currently has an active unlock window.

    Lazily evicts expired entries on read so the dict doesn't grow without
    bound across long-running sessions.
    """
    until = _unlock_until.get(chat_id)
    if until is None:
        return False
    if until <= datetime.now(timezone.utc):
        _unlock_until.pop(chat_id, None)
        return False
    return True


def _reset_for_tests() -> None:
    """Test-only helper to clear module state between tests."""
    _unlock_until.clear()
