"""Tests for ``request_queue`` — per-chat job queue with backpressure.

The queue's job is to serialise CC dispatch within a single chat and to
expose the active subprocess handle for ``/cancel``. Tests exercise four
invariants:

* ordering — jobs run in enqueue order;
* backpressure — the 6th arrival raises ``QueueFull``;
* crash isolation — one job raising doesn't take the worker down;
* handle lifecycle — ``active_proc`` clears once a job returns.
"""

import asyncio

import pytest

import request_queue


@pytest.fixture(autouse=True)
def _reset_queue_state():
    request_queue._reset_for_tests()
    yield
    request_queue._reset_for_tests()


def test_first_message_runs_immediately():
    ran = []

    async def job(state):
        ran.append("one")

    async def scenario():
        position = await request_queue.enqueue(42, job, label="one")
        assert position == 0
        # Let the worker run.
        await asyncio.sleep(0)
        await asyncio.sleep(0)
        # Wait for the worker task to finish draining.
        state = request_queue._state_for(42)
        if state.worker is not None:
            await state.worker

    asyncio.run(scenario())
    assert ran == ["one"]


def test_sequential_ordering():
    order = []

    async def make_job(tag, delay):
        async def job(state):
            await asyncio.sleep(delay)
            order.append(tag)

        return job

    async def scenario():
        # Stagger the delays so a parallel executor would reorder them; a
        # serial queue must preserve enqueue order regardless.
        j1 = await make_job("a", 0.02)
        j2 = await make_job("b", 0.001)
        j3 = await make_job("c", 0.001)
        await request_queue.enqueue(7, j1, "a")
        await request_queue.enqueue(7, j2, "b")
        await request_queue.enqueue(7, j3, "c")
        state = request_queue._state_for(7)
        await state.worker

    asyncio.run(scenario())
    assert order == ["a", "b", "c"]


def test_backpressure_at_max_inflight():
    async def scenario():
        gate = asyncio.Event()

        async def blocker(state):
            # Hold the worker on the first job so the others truly pile up.
            await gate.wait()

        # Fill capacity: 1 active (blocker) + 4 waiting = 5 in flight.
        for _ in range(request_queue.MAX_INFLIGHT):
            await request_queue.enqueue(9, blocker, label="b")

        # 6th arrival must be rejected.
        with pytest.raises(request_queue.QueueFull):
            await request_queue.enqueue(9, blocker, label="b")

        # Release everything so the event loop can wind down cleanly.
        gate.set()
        state = request_queue._state_for(9)
        await state.worker

    asyncio.run(scenario())


def test_worker_survives_job_crash():
    ran = []

    async def bad(state):
        raise RuntimeError("boom")

    async def good(state):
        ran.append("good")

    async def scenario():
        await request_queue.enqueue(3, bad, "bad")
        await request_queue.enqueue(3, good, "good")
        state = request_queue._state_for(3)
        await state.worker

    asyncio.run(scenario())
    assert ran == ["good"]


def test_active_proc_cleared_after_job():
    class FakeProc:
        pass

    fake = FakeProc()

    async def job(state):
        state.active_proc = fake
        assert request_queue.active_proc(5) is fake

    async def scenario():
        await request_queue.enqueue(5, job, "j")
        state = request_queue._state_for(5)
        await state.worker
        # After the job returns, the handle must be cleared so ``/cancel``
        # does not target a subprocess that has already exited.
        assert request_queue.active_proc(5) is None
        assert request_queue.active_label(5) == ""

    asyncio.run(scenario())


def test_position_reflects_active_plus_waiting():
    """Position = active_count + qsize_before_put, so msgs 2-5 show 1..4."""

    async def scenario():
        gate = asyncio.Event()

        async def blocker(state):
            await gate.wait()

        positions = []
        for _ in range(request_queue.MAX_INFLIGHT):
            positions.append(
                await request_queue.enqueue(11, blocker, label="b")
            )

        gate.set()
        state = request_queue._state_for(11)
        await state.worker
        return positions

    positions = asyncio.run(scenario())
    # First message: nothing in flight, position 0.
    # Subsequent messages: 1 active + N waiting ahead of me.
    assert positions == [0, 1, 2, 3, 4]


def test_queue_depth_and_active_label_before_run():
    async def scenario():
        gate = asyncio.Event()
        started = asyncio.Event()

        async def blocker(state):
            started.set()
            await gate.wait()

        await request_queue.enqueue(21, blocker, label="first")
        await started.wait()
        # While the first job is active, enqueue a second one.
        await request_queue.enqueue(21, blocker, label="second")

        assert request_queue.active_label(21) == "first"
        assert request_queue.queue_depth(21) == 1  # "second" is waiting

        gate.set()
        state = request_queue._state_for(21)
        await state.worker

    asyncio.run(scenario())
