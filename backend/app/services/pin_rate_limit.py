"""In-memory PIN-verify rate limiter.

State is per-process (single-tenant, single-backend). A failing PIN
attempt appends the current timestamp to a deque per user_id; once the
deque contains >= MAX_ATTEMPTS entries within WINDOW_S, a lockout
timestamp is set LOCKOUT_S seconds in the future. Callers should invoke
``is_locked_out()`` first (returns True + seconds remaining if locked),
``record_failure()`` on a bad PIN, and ``record_success()`` on a good PIN
to clear both the failure counter and any active lockout. State resets
on process restart.
"""
from __future__ import annotations

import time
from collections import defaultdict, deque
from threading import Lock

MAX_ATTEMPTS = 5
WINDOW_S = 600  # 10 minutes
LOCKOUT_S = 900  # 15 minutes

_failures: dict[int, deque[float]] = defaultdict(
    lambda: deque(maxlen=MAX_ATTEMPTS)
)
_lockout_until: dict[int, float] = {}
_lock = Lock()


def is_locked_out(
    user_id: int, now: float | None = None
) -> tuple[bool, float]:
    """Return (locked, seconds_until_unlock). Clears expired lockout entries as a side effect."""
    now = now if now is not None else time.time()
    with _lock:
        until = _lockout_until.get(user_id)
        if until is None or until <= now:
            _lockout_until.pop(user_id, None)
            return False, 0.0
        return True, until - now


def record_failure(user_id: int, now: float | None = None) -> None:
    """Record a failed PIN attempt. Triggers lockout at the threshold.

    Only failures within the trailing ``WINDOW_S`` seconds count; older
    entries naturally fall out of the ``maxlen=MAX_ATTEMPTS`` deque and
    are additionally filtered before the threshold comparison so that a
    stale deque (e.g. four-old + one-new) cannot trigger a lockout.
    """
    now = now if now is not None else time.time()
    with _lock:
        dq = _failures[user_id]
        dq.append(now)
        recent = [t for t in dq if now - t <= WINDOW_S]
        if len(recent) >= MAX_ATTEMPTS:
            _lockout_until[user_id] = now + LOCKOUT_S
            dq.clear()


def record_success(user_id: int) -> None:
    """Clear all failure / lockout state for the user on successful PIN."""
    with _lock:
        _failures.pop(user_id, None)
        _lockout_until.pop(user_id, None)


def _reset_for_tests() -> None:
    """Test helper — wipes module state. Not for production use."""
    with _lock:
        _failures.clear()
        _lockout_until.clear()
