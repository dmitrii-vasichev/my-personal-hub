"""Tests for cc_runner.run_cc argv construction.

The production subprocess is never spawned here — tests patch
``asyncio.create_subprocess_exec`` with a fake that records argv and returns
a mock process with the minimum surface ``run_cc`` consumes
(``communicate()`` and ``.returncode``).
"""

import asyncio
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

import cc_runner
import main
import unlock


class _FakeStream:
    """Minimal asyncio.StreamReader stand-in for stream-json draining."""

    def __init__(self, lines: list[bytes]):
        self._lines = list(lines)

    async def readline(self) -> bytes:
        if not self._lines:
            return b""
        return self._lines.pop(0)

    async def read(self) -> bytes:
        out = b"".join(self._lines)
        self._lines = []
        return out


class _FakeProcess:
    """Minimal stand-in for ``asyncio.subprocess.Process``.

    ``run_cc`` only calls ``communicate()`` and reads ``.returncode`` on the
    happy path, so the fake surface stays deliberately small.
    """

    def __init__(self, stdout: bytes = b"", stderr: bytes = b"", returncode: int = 0):
        self._stdout = stdout
        self._stderr = stderr
        self.returncode = returncode
        self.communicate = AsyncMock(return_value=(self._stdout, self._stderr))


@pytest.fixture
def fake_spawn(monkeypatch):
    """Patch ``create_subprocess_exec`` and expose the captured argv."""
    captured: dict = {"args": None, "kwargs": None}

    async def fake(*args, **kwargs):
        captured["args"] = args
        captured["kwargs"] = kwargs
        return _FakeProcess(stdout=b"ok", stderr=b"", returncode=0)

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake)
    return captured


@pytest.fixture(autouse=True)
def _force_new_session(monkeypatch, tmp_path):
    """Force ``_session_file`` to resolve under a clean tmp dir so the
    resume/new branch never depends on the developer's real ``~/.claude``
    state. Default to the "new session" path (file missing)."""
    def fake_session_file(workdir: str, session_id: str) -> Path:
        return tmp_path / f"{session_id}.jsonl"

    monkeypatch.setattr(cc_runner, "_session_file", fake_session_file)


# --- run_cc argv ----------------------------------------------------------


def test_run_cc_without_settings_omits_flag(fake_spawn):
    result = asyncio.run(
        cc_runner.run_cc(
            "hello",
            binary_path="/fake/claude",
            workdir="/tmp",
            session_id="abc-123",
            timeout=30,
        )
    )
    assert result.returncode == 0
    argv = list(fake_spawn["args"])
    assert "--settings" not in argv
    # Backwards-compatible Phase 1 argv.
    assert argv == ["/fake/claude", "-p", "--session-id", "abc-123", "hello"]


def test_run_cc_with_settings_injects_flag_before_p(fake_spawn):
    result = asyncio.run(
        cc_runner.run_cc(
            "hello",
            binary_path="/fake/claude",
            workdir="/tmp",
            session_id="abc-123",
            timeout=30,
            settings_path="/tmp/foo.json",
        )
    )
    assert result.returncode == 0
    argv = list(fake_spawn["args"])
    # --settings must appear before -p and be immediately followed by the path.
    assert "--settings" in argv
    i = argv.index("--settings")
    assert argv[i + 1] == "/tmp/foo.json"
    assert argv.index("--settings") < argv.index("-p")
    assert argv == [
        "/fake/claude",
        "--settings",
        "/tmp/foo.json",
        "-p",
        "--session-id",
        "abc-123",
        "hello",
    ]


def test_run_cc_settings_none_equivalent_to_omitted(fake_spawn):
    """Explicit ``settings_path=None`` must behave exactly like omission."""
    asyncio.run(
        cc_runner.run_cc(
            "hello",
            binary_path="/fake/claude",
            workdir="/tmp",
            session_id="abc-123",
            timeout=30,
            settings_path=None,
        )
    )
    argv = list(fake_spawn["args"])
    assert "--settings" not in argv


def test_run_cc_passes_cwd_and_pipes(fake_spawn):
    """Regression: ``cwd``/pipe kwargs survive the argv refactor."""
    asyncio.run(
        cc_runner.run_cc(
            "hello",
            binary_path="/fake/claude",
            workdir="/some/workdir",
            session_id="abc-123",
            timeout=30,
            settings_path="/tmp/foo.json",
        )
    )
    kwargs = fake_spawn["kwargs"]
    assert kwargs["cwd"] == "/some/workdir"
    assert kwargs["stdout"] == asyncio.subprocess.PIPE
    assert kwargs["stderr"] == asyncio.subprocess.PIPE


# --- on_spawn callback ----------------------------------------------------


def test_run_cc_invokes_on_spawn_with_process_handle(fake_spawn):
    """The queue worker relies on this to stash the Process for /cancel."""
    captured: list = []

    asyncio.run(
        cc_runner.run_cc(
            "hello",
            binary_path="/fake/claude",
            workdir="/tmp",
            session_id="abc-123",
            timeout=30,
            on_spawn=lambda p: captured.append(p),
        )
    )
    # The fake_spawn fixture returns a _FakeProcess; on_spawn must receive
    # that same instance before communicate() resolves.
    assert len(captured) == 1
    assert captured[0] is not None
    assert hasattr(captured[0], "communicate")


def test_run_cc_absorbs_on_spawn_exception(fake_spawn):
    """An on_spawn bug must not abort the CC run."""
    def boom(_proc):
        raise RuntimeError("on_spawn bug")

    result = asyncio.run(
        cc_runner.run_cc(
            "hello",
            binary_path="/fake/claude",
            workdir="/tmp",
            session_id="abc-123",
            timeout=30,
            on_spawn=boom,
        )
    )
    assert result.returncode == 0
    assert result.stdout == "ok"


# --- run_cc_streaming -----------------------------------------------------


@pytest.fixture
def fake_stream_spawn(monkeypatch):
    """Patch ``create_subprocess_exec`` with a streaming-aware fake.

    The fake returns a process whose ``stdout`` yields the supplied lines
    and then EOF, and whose ``wait()`` resolves immediately with
    ``returncode=0``. Tests can override ``lines``, ``stderr``, ``returncode``
    before awaiting the call.
    """

    class _FakeProc:
        def __init__(self, lines, stderr_bytes, returncode):
            self.stdout = _FakeStream(lines)
            self.stderr = _FakeStream([stderr_bytes] if stderr_bytes else [])
            self.returncode = returncode
            self._signals: list[int] = []
            self._wait_delay: float = 0.0

        async def wait(self):
            if self._wait_delay:
                await asyncio.sleep(self._wait_delay)
            return self.returncode

        def send_signal(self, sig):
            self._signals.append(sig)

        def kill(self):
            self._signals.append("KILL")

    captured: dict = {"args": None, "kwargs": None, "proc": None}
    # Tests can mutate this slot to customise the next spawn.
    config: dict = {"lines": [], "stderr": b"", "returncode": 0}

    async def fake(*args, **kwargs):
        captured["args"] = args
        captured["kwargs"] = kwargs
        proc = _FakeProc(config["lines"], config["stderr"], config["returncode"])
        captured["proc"] = proc
        return proc

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake)
    return captured, config


def test_run_cc_streaming_argv_has_required_flags(fake_stream_spawn):
    captured, config = fake_stream_spawn
    config["lines"] = [b'{"type":"result","subtype":"success","result":"hi"}\n']

    asyncio.run(
        cc_runner.run_cc_streaming(
            "hello",
            binary_path="/fake/claude",
            workdir="/tmp",
            session_id="abc-123",
            timeout=30,
        )
    )
    argv = list(captured["args"])
    # Per the Task 0 spike: --verbose is required together with
    # --output-format stream-json when using -p.
    assert "--output-format" in argv
    assert argv[argv.index("--output-format") + 1] == "stream-json"
    assert "--verbose" in argv
    assert argv[argv.index("--verbose") - 1] == "stream-json"
    assert "-p" in argv
    # stdin=DEVNULL suppresses the CLI's "no stdin data in 3s" wait.
    assert captured["kwargs"]["stdin"] == asyncio.subprocess.DEVNULL


def test_run_cc_streaming_forwards_each_line_to_callback(fake_stream_spawn):
    captured, config = fake_stream_spawn
    config["lines"] = [
        b'{"type":"system","subtype":"init"}\n',
        b'{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Read","input":{"file_path":"/a.md"}}]}}\n',
        b'{"type":"result","subtype":"success","result":"done"}\n',
    ]

    received: list[str] = []

    async def on_line(line: str) -> None:
        received.append(line)

    result = asyncio.run(
        cc_runner.run_cc_streaming(
            "hi",
            binary_path="/fake/claude",
            workdir="/tmp",
            session_id="abc-123",
            timeout=30,
            on_event_line=on_line,
        )
    )

    assert len(received) == 3
    assert received[1].startswith('{"type":"assistant"')
    assert result.stdout == "done"
    assert result.returncode == 0
    assert result.timed_out is False


def test_run_cc_streaming_final_text_from_result_event(fake_stream_spawn):
    """stdout comes from result.result, not from concatenated text blocks."""
    captured, config = fake_stream_spawn
    config["lines"] = [
        b'{"type":"assistant","message":{"content":[{"type":"text","text":"partial"}]}}\n',
        b'{"type":"result","subtype":"success","result":"canonical answer"}\n',
    ]

    result = asyncio.run(
        cc_runner.run_cc_streaming(
            "hi",
            binary_path="/fake/claude",
            workdir="/tmp",
            session_id="abc-123",
            timeout=30,
        )
    )
    assert result.stdout == "canonical answer"


def test_run_cc_streaming_callback_error_is_swallowed(fake_stream_spawn):
    """An on_event_line bug must not abort CC or lose the final text."""
    captured, config = fake_stream_spawn
    config["lines"] = [
        b'{"type":"system","subtype":"init"}\n',
        b'{"type":"result","subtype":"success","result":"still ok"}\n',
    ]

    async def flaky(line: str) -> None:
        raise RuntimeError("status edit exploded")

    result = asyncio.run(
        cc_runner.run_cc_streaming(
            "hi",
            binary_path="/fake/claude",
            workdir="/tmp",
            session_id="abc-123",
            timeout=30,
            on_event_line=flaky,
        )
    )
    assert result.stdout == "still ok"
    assert result.returncode == 0


def test_run_cc_streaming_invokes_on_spawn(fake_stream_spawn):
    captured, config = fake_stream_spawn
    config["lines"] = [b'{"type":"result","subtype":"success","result":"x"}\n']

    seen: list = []
    asyncio.run(
        cc_runner.run_cc_streaming(
            "hi",
            binary_path="/fake/claude",
            workdir="/tmp",
            session_id="abc-123",
            timeout=30,
            on_spawn=lambda p: seen.append(p),
        )
    )
    assert len(seen) == 1
    assert seen[0] is captured["proc"]


def test_run_cc_streaming_injects_settings_before_p(fake_stream_spawn):
    captured, config = fake_stream_spawn
    config["lines"] = [b'{"type":"result","subtype":"success","result":"x"}\n']

    asyncio.run(
        cc_runner.run_cc_streaming(
            "hi",
            binary_path="/fake/claude",
            workdir="/tmp",
            session_id="abc-123",
            timeout=30,
            settings_path="/tmp/p.json",
        )
    )
    argv = list(captured["args"])
    assert argv.index("--settings") < argv.index("-p")
    assert argv[argv.index("--settings") + 1] == "/tmp/p.json"


# --- main._profile_for ----------------------------------------------------


@pytest.fixture(autouse=True)
def _reset_unlock_state():
    unlock._reset_for_tests()
    yield
    unlock._reset_for_tests()


def test_profile_for_returns_locked_by_default():
    assert main._profile_for(42) == main.LOCKED_PROFILE


def test_profile_for_returns_unlocked_after_unlock():
    unlock.unlock_chat(42)
    assert main._profile_for(42) == main.UNLOCKED_PROFILE


def test_profile_paths_point_to_existing_files():
    # Sanity: the two profile files must exist on disk next to main.py.
    assert Path(main.LOCKED_PROFILE).is_file()
    assert Path(main.UNLOCKED_PROFILE).is_file()
