"""Parse stream-json events from ``claude -p --output-format stream-json``
and render throttled status updates to Telegram.

Anti-abuse guard rails (PRD NFR "Anti-abuse hygiene", enforced after the
2026-04-18 freeze incident):

* Minimum 10 seconds between consecutive edits of the same status message.
* Never edit on a timer; only on real ``tool_use`` events surfaced by CC.
* If stream-json is malformed for a given invocation, silently disable
  progress for the rest of that invocation — do NOT fall back to a spinner
  animation. The terminal edit still renders ``✅ done`` / ``❌ failed``.

Event shape notes (pinned against CC CLI 2.1.114 via Task 0 spike,
2026-04-19). Events are line-delimited JSON objects with a top-level
``type`` field. ``tool_use`` and ``text`` are **nested content blocks**
inside ``assistant.message.content[]`` — they are not top-level event
types. Relevant shapes::

    {"type": "assistant", "message": {"content": [
        {"type": "thinking", "thinking": "..."},
        {"type": "tool_use", "name": "Read",
         "input": {"file_path": "/abs/path.md"}},
        {"type": "text", "text": "final reply"}
    ]}}
    {"type": "result", "subtype": "success", "result": "final reply text"}

Terminal detection: ``{"type": "result"}`` carries the final plain-text
reply in ``result.result`` — simpler than walking content blocks to
assemble it. We use that field as the canonical final stdout.
"""

import json
import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

log = logging.getLogger(__name__)

MIN_EDIT_INTERVAL_S = 10.0


@dataclass
class StatusState:
    last_edit_ts: float = 0.0
    # Flipped True after the first JSONDecodeError in this invocation so
    # subsequent malformed lines stay silent rather than retry-parsing.
    parse_disabled: bool = False


def _format_tool_use(block: dict) -> Optional[str]:
    """Map one ``tool_use`` content block to a human status line.

    Returns ``None`` for tools we don't surface (the caller should then
    skip the edit entirely — not render a default).
    """
    name = block.get("name", "")
    inp = block.get("input") or {}
    if name == "Read":
        path = inp.get("file_path", "")
        return f"📖 reading {Path(path).name or 'file'}"
    if name in {"Edit", "Write"}:
        path = inp.get("file_path", "")
        return f"✏️ writing {Path(path).name or 'file'}"
    if name == "Bash":
        cmd = (inp.get("command") or "")[:60]
        return f"🔧 running: {cmd}"
    if name in {"Grep", "Glob"}:
        return "🔍 searching files"
    if name == "Task":
        sub = inp.get("subagent_type") or name
        return f"🧩 using skill: {sub}"
    return None


def format_event(evt: dict) -> Optional[str]:
    """Walk an event and return a status string for the first interesting
    content block, or ``None`` if nothing renderable is present.

    We only surface assistant-side ``tool_use`` blocks. ``thinking``,
    ``text``, ``user.content.tool_result``, ``system.*``, ``rate_limit_event``
    and ``result`` are all noise from the status-message point of view.
    """
    if evt.get("type") != "assistant":
        return None
    message = evt.get("message") or {}
    content = message.get("content") or []
    for block in content:
        if not isinstance(block, dict):
            continue
        if block.get("type") != "tool_use":
            continue
        status = _format_tool_use(block)
        if status is not None:
            return status
    return None


def extract_final_text(evt: dict) -> Optional[str]:
    """If ``evt`` is the terminal ``result`` event, return its plain-text
    reply. Returns ``None`` for every other event type.

    Using ``result.result`` as the canonical final stdout avoids having
    to concatenate ``assistant.content[text]`` blocks across multiple
    turns — the CLI already does that assembly for us.
    """
    if evt.get("type") != "result":
        return None
    text = evt.get("result")
    return text if isinstance(text, str) else None


def is_result_error(evt: dict) -> bool:
    """True if this is a terminal ``result`` event signalling an error."""
    if evt.get("type") != "result":
        return False
    return bool(evt.get("is_error")) or evt.get("subtype") not in (None, "success")


def should_edit(state: StatusState, now: float) -> bool:
    """Apply the ≥10 s edit throttle."""
    return (now - state.last_edit_ts) >= MIN_EDIT_INTERVAL_S


def mark_edited(state: StatusState, now: Optional[float] = None) -> None:
    state.last_edit_ts = now if now is not None else time.monotonic()


def parse_line(line: str, state: StatusState) -> Optional[str]:
    """Parse one stream-json line into a status string (or ``None``).

    Once ``state.parse_disabled`` flips True (first JSONDecodeError), every
    subsequent call returns ``None`` without attempting to parse — the PRD
    forbids spinner fallbacks, so we just stop updating and let the final
    terminal edit carry the outcome.
    """
    if state.parse_disabled:
        return None
    line = line.strip()
    if not line:
        return None
    try:
        evt = json.loads(line)
    except json.JSONDecodeError:
        log.warning("stream-json parse failed, disabling progress for this invocation")
        state.parse_disabled = True
        return None
    if not isinstance(evt, dict):
        # Defensive: stream-json always emits objects at top level, but if
        # the CLI ever ships an array or bare value we treat it as noise.
        return None
    return format_event(evt)
