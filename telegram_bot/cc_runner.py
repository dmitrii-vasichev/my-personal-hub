import asyncio
import logging
import re
from dataclasses import dataclass
from pathlib import Path

log = logging.getLogger(__name__)


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
) -> RunResult:
    resume = _session_file(workdir, session_id).is_file()
    log.info(
        "cc_run session=%s prompt_len=%d mode=%s",
        session_id,
        len(prompt),
        "resume" if resume else "new",
    )
    # claude -p --session-id <uuid> creates a fresh session and rejects
    # UUIDs already on disk ("Session ID X is already in use"); --resume
    # picks up the existing conversation. Pick the flag by probing the
    # on-disk file so the bot continues the same conversation across restarts.
    session_flag = "--resume" if resume else "--session-id"
    try:
        proc = await asyncio.create_subprocess_exec(
            binary_path,
            "-p",
            session_flag,
            session_id,
            prompt,
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
