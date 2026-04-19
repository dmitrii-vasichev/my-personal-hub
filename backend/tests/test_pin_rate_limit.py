"""Unit tests for ``app.services.pin_rate_limit``.

Pure in-memory util — no DB, no event loop. Uses a function-scoped
fixture that calls the private ``_reset_for_tests`` helper so state
doesn't leak between cases. Every test injects an explicit ``now=``
value so assertions don't depend on wall-clock time.
"""
from __future__ import annotations

import pytest

from app.services import pin_rate_limit
from app.services.pin_rate_limit import (
    LOCKOUT_S,
    MAX_ATTEMPTS,
    WINDOW_S,
    is_locked_out,
    record_failure,
    record_success,
)


@pytest.fixture(autouse=True)
def _reset_state():
    """Wipe the module-level dicts before and after every test."""
    pin_rate_limit._reset_for_tests()
    yield
    pin_rate_limit._reset_for_tests()


def test_under_threshold_is_not_locked_out():
    """Fewer than ``MAX_ATTEMPTS`` failures → user stays unlocked."""
    now = 1_000_000.0
    user_id = 42
    for i in range(MAX_ATTEMPTS - 1):
        record_failure(user_id, now=now + i)

    locked, remaining = is_locked_out(user_id, now=now + MAX_ATTEMPTS)
    assert locked is False
    assert remaining == 0.0


def test_fifth_failure_within_window_triggers_lockout():
    """Exactly ``MAX_ATTEMPTS`` failures within ``WINDOW_S`` → locked."""
    now = 1_000_000.0
    user_id = 7
    for i in range(MAX_ATTEMPTS):
        record_failure(user_id, now=now + i)

    locked, remaining = is_locked_out(user_id, now=now + MAX_ATTEMPTS)
    assert locked is True
    # Lockout was set to (last_failure_time + LOCKOUT_S); we probed
    # a few seconds after the last failure, so remaining should be
    # close to LOCKOUT_S but strictly positive and ≤ LOCKOUT_S.
    assert 0 < remaining <= LOCKOUT_S


def test_failures_outside_window_do_not_count():
    """Failures older than ``WINDOW_S`` drop out and don't trigger lockout.

    We log 4 failures deep in the past, then a single failure "now". The
    4 old ones are outside the trailing window so the recent-filter keeps
    only 1 entry — below the threshold.
    """
    now = 1_000_000.0
    user_id = 99
    # 4 ancient failures, well beyond WINDOW_S ago.
    ancient = now - (WINDOW_S * 2)
    for i in range(MAX_ATTEMPTS - 1):
        record_failure(user_id, now=ancient + i)
    # One fresh failure — but the window should exclude the ancient ones.
    record_failure(user_id, now=now)

    locked, _ = is_locked_out(user_id, now=now)
    assert locked is False


def test_record_success_clears_failures_and_lockout():
    """After a successful PIN, previous failures and any lockout vanish."""
    now = 1_000_000.0
    user_id = 13
    for i in range(MAX_ATTEMPTS):
        record_failure(user_id, now=now + i)
    # Pre-condition: user is locked out.
    locked_before, _ = is_locked_out(user_id, now=now + MAX_ATTEMPTS)
    assert locked_before is True

    record_success(user_id)

    locked_after, remaining = is_locked_out(user_id, now=now + MAX_ATTEMPTS)
    assert locked_after is False
    assert remaining == 0.0
    # And the failure counter is gone, so a fresh series can't trip the
    # lockout until MAX_ATTEMPTS new failures accumulate.
    for i in range(MAX_ATTEMPTS - 1):
        record_failure(user_id, now=now + 100 + i)
    locked_partial, _ = is_locked_out(user_id, now=now + 100 + MAX_ATTEMPTS)
    assert locked_partial is False


def test_lockout_expires_after_lockout_s():
    """Once ``LOCKOUT_S`` has elapsed, ``is_locked_out`` returns False."""
    now = 1_000_000.0
    user_id = 555
    for i in range(MAX_ATTEMPTS):
        record_failure(user_id, now=now + i)

    # The lockout-until timestamp is set at the moment of the final
    # failure, which happened at ``now + (MAX_ATTEMPTS - 1)``; so the
    # lockout ends at exactly ``now + MAX_ATTEMPTS - 1 + LOCKOUT_S``.
    lockout_end = now + (MAX_ATTEMPTS - 1) + LOCKOUT_S

    # Still locked just before the lockout ends.
    locked_mid, remaining = is_locked_out(user_id, now=lockout_end - 1)
    assert locked_mid is True
    assert remaining > 0

    # Past the expiry → unlocked, entry cleaned up.
    locked_end, remaining_end = is_locked_out(user_id, now=lockout_end + 1)
    assert locked_end is False
    assert remaining_end == 0.0
    # Internal cleanup: the lockout dict should no longer contain the id.
    assert user_id not in pin_rate_limit._lockout_until
