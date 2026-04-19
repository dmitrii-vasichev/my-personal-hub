import asyncio
import json
import logging
import re
import signal
from dataclasses import dataclass
from pathlib import Path
from typing import Awaitable, Callable, Optional

log = logging.getLogger(__name__)

# Callback invoked as soon as the CC subprocess is alive. The queue worker
# uses this to stash the Process handle so ``/cancel`` can SIGINT it.
SpawnCallback = Callable[[asyncio.subprocess.Process], None]
EventLineCallback = Callable[[str], Awaitable[None]]


@dataclass
class RunResult:
    stdout: str
    stderr: str
    returncode: int
    timed_out: bool


_NON_ALNUM = re.compile(r"[^a-zA-Z0-9-]")


def _session_file(workdir: str, session_id: str) -> Path:
    """Path to Claude CLI's persisted session file for (workdir, UUID).

    Claude stores sessions at
    ``~/.claude/projects/<encoded-absolute-workdir>/<uuid>.jsonl`` where
    every character that is not ``[a-zA-Z0-9-]`` is replaced by ``-``.
    Examples observed: ``/``, ``.``, ``_`` all become ``-``.
    """
    encoded = _NON_ALNUM.sub("-", str(Path(workdir).absolute()))
    return Path.home() / ".claude" / "projects" / encoded / f"{session_id}.jsonl"


async def run_cc(
    prompt: str,
    *,
    binary_path: str,
    workdir: str,
    session_id: str,
    timeout: int,
    settings_path: str | None = None,
    on_spawn: Optional[SpawnCallback] = None,
) -> RunResult:
    resume = _session_file(workdir, session_id).is_file()
    log.info(
        "cc_run session=%s prompt_len=%d mode=%s settings=%s",
        session_id,
        len(prompt),
        "resume" if resume else "new",
        settings_path or "-",
    )
    # claude -p --session-id <uuid> creates a fresh session and rejects
    # UUIDs already on disk ("Session ID X is already in use"); --resume
    # picks up the existing conversation. Pick the flag by probing the
    # on-disk file so the bot continues the same conversation across restarts.
    session_flag = "--resume" if resume else "--session-id"
    # Inject deny-list profile via --settings <path> before -p so the Task 0
    # spike's proven argv order is preserved. Keep Phase 1 behaviour intact
    # when no profile is supplied.
    args: list[str] = [binary_path]
    if settings_path:
        args += ["--settings", settings_path]
    args += ["-p", session_flag, session_id, prompt]
    try:
        proc = await asyncio.create_subprocess_exec(
            *args,
            cwd=workdir,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except (FileNotFoundError, PermissionError, NotADirectoryError) as exc:
        # Spawn-time failure (bad CC_BINARY_PATH, missing CC_WORKDIR, etc.)
        # must surface through RunResult so the Telegram error relay kicks in
        # instead of bubbling an unhandled exception into the PTB handler.
        log.error("cc_run spawn failed: %s", exc)
        return RunResult(
            stdout="",
            stderr=f"spawn failed: {exc}",
            returncode=-1,
            timed_out=False,
        )
    if on_spawn is not None:
        # Invoked synchronously so the queue worker can stash the handle
        # before the subprocess has a chance to finish on ultra-fast paths.
        try:
            on_spawn(proc)
        except Exception:  # noqa: BLE001 — callback errors must not abort CC
            log.exception("on_spawn callback raised, ignoring")
    try:
        stdout_b, stderr_b = await asyncio.wait_for(
            proc.communicate(), timeout=timeout
        )
        return RunResult(
            stdout=stdout_b.decode(errors="replace"),
            stderr=stderr_b.decode(errors="replace"),
            returncode=proc.returncode or 0,
            timed_out=False,
        )
    except asyncio.TimeoutError:
        log.warning("cc_run timeout after %ds, sending SIGINT", timeout)
        proc.send_signal(2)  # SIGINT
        try:
            stdout_b, stderr_b = await asyncio.wait_for(
                proc.communicate(), timeout=10
            )
        except asyncio.TimeoutError:
            proc.kill()
            stdout_b, stderr_b = b"", b"killed after SIGINT timeout"
        return RunResult(
            stdout=stdout_b.decode(errors="replace"),
            stderr=stderr_b.decode(errors="replace"),
            returncode=proc.returncode or -1,
            timed_out=True,
        )


async def run_cc_streaming(
    prompt: str,
    *,
    binary_path: str,
    workdir: str,
    session_id: str,
    timeout: int,
    settings_path: str | None = None,
    on_spawn: Optional[SpawnCallback] = None,
    on_event_line: Optional[EventLineCallback] = None,
) -> RunResult:
    """Run ``claude -p --output-format stream-json --verbose`` and stream
    events line-by-line to ``on_event_line`` as they arrive.

    The ``--verbose`` flag is REQUIRED by CC CLI 2.1.114 when
    ``--output-format stream-json`` is used with ``-p`` (verified in the
    Phase 3 Task 0 spike). Omitting it causes the CLI to reject the flag.

    ``stdin`` is redirected to ``DEVNULL`` so the CLI's "no stdin data
    received in 3s" wait short-circuits to EOF immediately — the spike
    reproduced that warning when the parent had an unclosed stdin.

    The final ``RunResult.stdout`` is sourced from the ``result.result``
    field of the terminal ``{"type":"result"}`` event emitted by the CLI.
    """
    resume = _session_file(workdir, session_id).is_file()
    log.info(
        "cc_run_streaming session=%s prompt_len=%d mode=%s settings=%s",
        session_id,
        len(prompt),
        "resume" if resume else "new",
        settings_path or "-",
    )
    session_flag = "--resume" if resume else "--session-id"
    args: list[str] = [binary_path]
    if settings_path:
        args += ["--settings", settings_path]
    args += [
        "-p",
        "--output-format",
        "stream-json",
        "--verbose",
        session_flag,
        session_id,
        prompt,
    ]
    try:
        proc = await asyncio.create_subprocess_exec(
            *args,
            cwd=workdir,
            stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except (FileNotFoundError, PermissionError, NotADirectoryError) as exc:
        log.error("cc_run_streaming spawn failed: %s", exc)
        return RunResult(
            stdout="",
            stderr=f"spawn failed: {exc}",
            returncode=-1,
            timed_out=False,
        )
    if on_spawn is not None:
        try:
            on_spawn(proc)
        except Exception:  # noqa: BLE001 — callback errors must not abort CC
            log.exception("on_spawn callback raised, ignoring")

    final_text = ""

    async def _drain_stdout() -> None:
        nonlocal final_text
        assert proc.stdout is not None
        while True:
            line_b = await proc.stdout.readline()
            if not line_b:
                return
            line = line_b.decode(errors="replace").rstrip("\n")
            if on_event_line is not None:
                try:
                    await on_event_line(line)
                except Exception:  # noqa: BLE001 — status edits must not abort CC
                    log.exception("on_event_line callback raised, continuing")
            # Sniff the terminal event for the canonical final text. The
            # CLI already assembles it across turns for us, so we do not
            # need to walk assistant.content[text] blocks.
            stripped = line.strip()
            if not stripped:
                continue
            try:
                evt = json.loads(stripped)
            except json.JSONDecodeError:
                continue
            if isinstance(evt, dict) and evt.get("type") == "result":
                r = evt.get("result")
                if isinstance(r, str):
                    final_text = r

    drain_task = asyncio.create_task(_drain_stdout())
    try:
        await asyncio.wait_for(proc.wait(), timeout=timeout)
        await drain_task
        stderr_b = await proc.stderr.read() if proc.stderr is not None else b""
        return RunResult(
            stdout=final_text,
            stderr=stderr_b.decode(errors="replace"),
            returncode=proc.returncode or 0,
            timed_out=False,
        )
    except asyncio.TimeoutError:
        log.warning("cc_run_streaming timeout after %ds, sending SIGINT", timeout)
        proc.send_signal(signal.SIGINT)
        try:
            await asyncio.wait_for(proc.wait(), timeout=10)
        except asyncio.TimeoutError:
            proc.kill()
        # Let the drain task finish reading whatever was already buffered,
        # so on_event_line sees the full stream up to the cut-off.
        try:
            await asyncio.wait_for(drain_task, timeout=2)
        except asyncio.TimeoutError:
            drain_task.cancel()
            try:
                await drain_task
            except (asyncio.CancelledError, Exception):  # noqa: BLE001
                pass
        stderr_b = await proc.stderr.read() if proc.stderr is not None else b""
        return RunResult(
            stdout=final_text,
            stderr=stderr_b.decode(errors="replace") or "timed out",
            returncode=proc.returncode if proc.returncode is not None else -1,
            timed_out=True,
        )
