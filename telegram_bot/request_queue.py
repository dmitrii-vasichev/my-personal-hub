"""Per-chat request queue with backpressure and subprocess tracking.

Phase 3 moves CC dispatch off the main handler coroutine into per-chat
queues. This prevents two overlapping messages in the same chat from
spawning parallel ``claude -p`` processes (which would race on the session
file and confuse the user about ordering). It also centralises the active
subprocess handle so ``/cancel`` can SIGINT whatever CC is running right
now.

Capacity semantics (PRD FR-20/FR-21, cross-checked against AC-8):
    At most ``MAX_INFLIGHT`` jobs may be in the system at once — counting
    the currently running job plus the ones waiting in the queue. The
    ``MAX_INFLIGHT + 1``th arrival is rejected with ``QueueFull`` so the
    handler can reply "queue full".
"""

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Awaitable, Callable, Optional

log = logging.getLogger(__name__)

MAX_INFLIGHT = 5


@dataclass
class ChatQueueState:
    queue: asyncio.Queue = field(default_factory=asyncio.Queue)
    worker: Optional[asyncio.Task] = None
    active_proc: Optional[asyncio.subprocess.Process] = None
    # Human-readable description of the job currently being processed.
    # Empty string when idle; also used as the "is there an active job?"
    # signal for backpressure math.
    active_label: str = ""
    # Set by ``/cancel`` right after SIGINT so the job's renderer can skip
    # the CC CLI's interrupted-run stdout ("Execution error") and show a
    # cancelled state instead of a misleading ✅ done. Reset in the worker
    # finally alongside active_proc / active_label.
    cancelled: bool = False


class QueueFull(Exception):
    """Raised when a chat already has ``MAX_INFLIGHT`` jobs in flight."""


_state: dict[int, ChatQueueState] = {}


def _state_for(chat_id: int) -> ChatQueueState:
    if chat_id not in _state:
        _state[chat_id] = ChatQueueState()
    return _state[chat_id]


def _inflight(s: ChatQueueState) -> int:
    """Total jobs in the system for this chat = waiting + (1 if active)."""
    return s.queue.qsize() + (1 if s.active_label else 0)


async def enqueue(
    chat_id: int,
    job: Callable[[ChatQueueState], Awaitable[None]],
    label: str,
) -> int:
    """Schedule ``job`` on ``chat_id``'s queue.

    Returns the user-visible position: ``0`` means the job will start
    immediately (nothing active, nothing queued). A positive value is the
    number of jobs ahead of this one (active + waiting).

    Raises :class:`QueueFull` if the chat already has ``MAX_INFLIGHT`` jobs
    in flight.
    """
    s = _state_for(chat_id)
    if _inflight(s) >= MAX_INFLIGHT:
        raise QueueFull()
    position = _inflight(s)
    await s.queue.put((job, label))
    if s.worker is None or s.worker.done():
        s.worker = asyncio.create_task(_run_worker(chat_id))
    return position


async def _run_worker(chat_id: int) -> None:
    s = _state_for(chat_id)
    while not s.queue.empty():
        job, label = await s.queue.get()
        s.active_label = label
        try:
            await job(s)
        except Exception:  # noqa: BLE001 — worker must survive per-job crashes
            log.exception(
                "queue worker job crashed chat_id=%s label=%s", chat_id, label
            )
        finally:
            s.active_proc = None
            s.active_label = ""
            s.cancelled = False
            s.queue.task_done()


def active_proc(chat_id: int) -> Optional[asyncio.subprocess.Process]:
    s = _state.get(chat_id)
    return s.active_proc if s is not None else None


def mark_cancelled(chat_id: int) -> None:
    """Flag the chat's active job as user-cancelled.

    Called by ``/cancel`` right after SIGINT so the job's renderer can
    distinguish "CC exited cleanly" from "CC was interrupted mid-run". The
    flag is reset in the worker's finally block.
    """
    s = _state.get(chat_id)
    if s is not None:
        s.cancelled = True


def is_cancelled(chat_id: int) -> bool:
    s = _state.get(chat_id)
    return s.cancelled if s is not None else False


def queue_depth(chat_id: int) -> int:
    """Number of jobs waiting. Does NOT include the one currently running."""
    s = _state.get(chat_id)
    return s.queue.qsize() if s is not None else 0


def active_label(chat_id: int) -> str:
    s = _state.get(chat_id)
    return s.active_label if s is not None else ""


def _reset_for_tests() -> None:
    _state.clear()
