"""Tests for profiles/hooks/block-paths.py — the Bash-bypass closure."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

HOOK = Path(__file__).resolve().parent.parent / "profiles" / "hooks" / "block-paths.py"


def _run(cmd: str, names: list[str]) -> subprocess.CompletedProcess:
    payload = json.dumps({"tool_input": {"command": cmd}})
    return subprocess.run(
        [sys.executable, str(HOOK), *names],
        input=payload,
        capture_output=True,
        text=True,
    )


def test_allows_benign_command():
    result = _run("ls -la /tmp", ["Personal"])
    assert result.returncode == 0
    assert result.stderr == ""


def test_blocks_cat_on_personal_file():
    result = _run("cat ~/Documents/Notes/Personal/car.md", ["Personal"])
    assert result.returncode == 2
    assert "Blocked" in result.stderr


def test_blocks_ls_on_personal_dir_no_trailing_slash():
    result = _run("ls ~/Documents/Notes/Personal", ["Personal"])
    assert result.returncode == 2


def test_blocks_find_under_personal():
    result = _run("find ~/Documents/Notes/Personal/ -type f", ["Personal"])
    assert result.returncode == 2


def test_blocks_head_with_absolute_path():
    result = _run(
        "head /Users/dmitry.vasichev/Documents/Notes/Personal/banking.md",
        ["Personal"],
    )
    assert result.returncode == 2


def test_allows_personal_mobile_when_only_personal_is_protected():
    # This is the whole point of the suffix-boundary regex: the "Personal"
    # rule must NOT swallow the "Personal-mobile" folder, or the unlocked
    # tier-2 slot becomes unreachable even from unlocked mode.
    result = _run(
        "cat ~/Documents/Notes/Personal-mobile/cars.md",
        ["Personal"],
    )
    assert result.returncode == 0, result.stderr


def test_blocks_personal_mobile_when_it_is_also_protected():
    result = _run(
        "cat ~/Documents/Notes/Personal-mobile/cars.md",
        ["Personal", "Personal-mobile"],
    )
    assert result.returncode == 2


def test_blocks_both_under_locked_multi_arg():
    # Locked profile passes both names; either reference must block.
    for cmd in [
        "cat ~/Documents/Notes/Personal/car.md",
        "cat ~/Documents/Notes/Personal-mobile/cars.md",
    ]:
        result = _run(cmd, ["Personal", "Personal-mobile"])
        assert result.returncode == 2, cmd


def test_ignores_unrelated_personal_word_elsewhere():
    # Substring "personal" lowercase somewhere else should not trigger.
    result = _run(
        "grep -r 'personal goals' ~/Documents/my_projects/",
        ["Personal"],
    )
    assert result.returncode == 0


def test_usage_without_args_exits_nonzero():
    result = subprocess.run(
        [sys.executable, str(HOOK)],
        input='{"tool_input":{"command":"ls"}}',
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0
    assert "usage" in result.stderr.lower()


def test_malformed_json_fails_open():
    # If CC ever sends garbage, don't block all Bash — just let it through
    # and let CC's own error logging surface the issue.
    result = subprocess.run(
        [sys.executable, str(HOOK), "Personal"],
        input="not json",
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0


def test_missing_tool_input_fails_open():
    result = subprocess.run(
        [sys.executable, str(HOOK), "Personal"],
        input="{}",
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0


def test_non_string_command_fails_open():
    result = subprocess.run(
        [sys.executable, str(HOOK), "Personal"],
        input='{"tool_input":{"command":12345}}',
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0
