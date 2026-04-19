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
