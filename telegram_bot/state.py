"""Per-chat Claude Code session state persistence.

Phase 1 used a single hardcoded UUID (``uuid5(NAMESPACE_DNS, "tg-default")``)
for every message. Phase 2 Task 4 introduces a per-chat mapping persisted to
``telegram_bot/.state.json`` so each Telegram chat gets its own CC session and
the user can reset it on demand via ``/new``.

First-run read: if a chat has no entry, return ``TG_DEFAULT_UUID`` WITHOUT
writing it to disk. This preserves Phase 1 backwards compatibility — the
existing ``~/.claude/projects/<encoded-workdir>/<tg-default-uuid>.jsonl`` file
continues to resume cleanly for chats that never call ``/new``.
"""

import json
import uuid
from pathlib import Path
from threading import Lock

STATE_FILE = Path(__file__).parent / ".state.json"
TG_DEFAULT_UUID = str(uuid.uuid5(uuid.NAMESPACE_DNS, "tg-default"))
_lock = Lock()


def _read() -> dict:
    if not STATE_FILE.exists():
        return {"sessions": {}}
    try:
        data = json.loads(STATE_FILE.read_text())
    except json.JSONDecodeError:
        # Corrupt file — behave as if empty. A subsequent _write() will
        # overwrite it atomically with a well-formed document.
        return {"sessions": {}}
    if not isinstance(data, dict) or not isinstance(data.get("sessions"), dict):
        return {"sessions": {}}
    return data


def _write(data: dict) -> None:
    # Write to a sibling temp file then atomically replace, so a crash
    # mid-write cannot leave a half-flushed .state.json on disk.
    tmp = STATE_FILE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, indent=2))
    tmp.replace(STATE_FILE)


def get_session(chat_id: int) -> str:
    """Return the session UUID for this chat.

    Defaults to ``TG_DEFAULT_UUID`` when the chat has no entry yet. The
    default is NOT persisted — only explicit ``new_session`` calls write.
    """
    with _lock:
        data = _read()
        return data["sessions"].get(str(chat_id), TG_DEFAULT_UUID)


def new_session(chat_id: int) -> str:
    """Assign a fresh ``uuid4`` to this chat, persist it, and return it."""
    new_uuid = str(uuid.uuid4())
    with _lock:
        data = _read()
        data["sessions"][str(chat_id)] = new_uuid
        _write(data)
    return new_uuid
