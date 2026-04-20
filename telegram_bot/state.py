"""Per-chat, per-project Claude Code session state.

Phase 5 schema (``.state.json``)::

    {
        "chats": {
            "<chat_id>": {
                "active_project": "my-personal-hub",
                "sessions": {
                    "my-personal-hub": "<uuid>",
                    "market-pulse-dashboard": "<uuid>"
                }
            }
        }
    }

On first read, a legacy Phase 2/3/4 document (``{"sessions": {chat_id:
uuid}}``) is silently promoted in place into the new shape. The default
project name is the one registered via ``configure()`` at bot startup,
or ``"my-personal-hub"`` if nothing was configured (tests).

Default-project reads still return ``TG_DEFAULT_UUID`` without persisting
so the Phase 1 deterministic UUID keeps resuming the pre-existing
``~/.claude/projects/<encoded-workdir>/<uuid>.jsonl`` file. Non-default
projects persist a fresh ``uuid4`` on first read — otherwise a second
``get_session`` would hand out a different UUID and break resume.
"""

import json
import uuid
from pathlib import Path
from threading import Lock

STATE_FILE = Path(__file__).parent / ".state.json"
TG_DEFAULT_UUID = str(uuid.uuid5(uuid.NAMESPACE_DNS, "tg-default"))
_lock = Lock()
_default_project: str | None = None


def configure(default_project: str) -> None:
    """Register the bot's default project name.

    Called once from ``main()`` so legacy migration and no-entry reads
    resolve to the right project.
    """
    global _default_project
    _default_project = default_project


def _effective_default() -> str:
    return _default_project or "my-personal-hub"


def _read() -> dict:
    if not STATE_FILE.exists():
        return {"chats": {}}
    try:
        data = json.loads(STATE_FILE.read_text())
    except json.JSONDecodeError:
        return {"chats": {}}

    if isinstance(data, dict) and isinstance(data.get("chats"), dict):
        return data

    # Legacy Phase 2/3/4 format: {"sessions": {chat_id: uuid}}.
    if isinstance(data, dict) and isinstance(data.get("sessions"), dict):
        default = _effective_default()
        chats: dict[str, dict] = {}
        for chat_id, uuid_str in data["sessions"].items():
            if not isinstance(uuid_str, str):
                continue
            chats[str(chat_id)] = {
                "active_project": default,
                "sessions": {default: uuid_str},
            }
        migrated = {"chats": chats}
        _write(migrated)
        return migrated

    return {"chats": {}}


def _write(data: dict) -> None:
    tmp = STATE_FILE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, indent=2))
    tmp.replace(STATE_FILE)


def _chat_entry(data: dict, chat_id: int) -> dict:
    """Return the chat's entry, creating a fresh one if missing/malformed."""
    key = str(chat_id)
    entry = data["chats"].get(key)
    if not isinstance(entry, dict):
        entry = {"active_project": _effective_default(), "sessions": {}}
        data["chats"][key] = entry
        return entry
    if not isinstance(entry.get("active_project"), str) or not entry["active_project"]:
        entry["active_project"] = _effective_default()
    if not isinstance(entry.get("sessions"), dict):
        entry["sessions"] = {}
    return entry


def get_session(chat_id: int, project: str) -> str:
    """Return the session UUID for ``(chat_id, project)``.

    - Default project with no entry → ``TG_DEFAULT_UUID`` (not persisted).
    - Non-default project with no entry → fresh ``uuid4`` persisted now.
    """
    default = _effective_default()
    with _lock:
        data = _read()
        entry = data["chats"].get(str(chat_id))
        if isinstance(entry, dict):
            sessions = entry.get("sessions")
            if isinstance(sessions, dict):
                val = sessions.get(project)
                if isinstance(val, str):
                    return val
        if project == default:
            return TG_DEFAULT_UUID
        entry = _chat_entry(data, chat_id)
        new_uuid = str(uuid.uuid4())
        entry["sessions"][project] = new_uuid
        _write(data)
        return new_uuid


def new_session(chat_id: int, project: str) -> str:
    """Assign a fresh ``uuid4`` to ``(chat_id, project)`` and persist it."""
    new_uuid = str(uuid.uuid4())
    with _lock:
        data = _read()
        entry = _chat_entry(data, chat_id)
        entry["sessions"][project] = new_uuid
        _write(data)
    return new_uuid


def get_active_project(chat_id: int, default: str) -> str:
    """Return the chat's active project, or ``default`` if none is set.

    The default is NOT persisted — only an explicit ``set_active_project``
    writes, which keeps the file empty for chats that never switched.
    """
    with _lock:
        data = _read()
        entry = data["chats"].get(str(chat_id))
        if isinstance(entry, dict):
            name = entry.get("active_project")
            if isinstance(name, str) and name:
                return name
        return default


def set_active_project(chat_id: int, project: str) -> None:
    with _lock:
        data = _read()
        entry = _chat_entry(data, chat_id)
        entry["active_project"] = project
        _write(data)
