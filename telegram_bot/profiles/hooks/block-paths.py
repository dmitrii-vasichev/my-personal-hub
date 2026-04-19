#!/usr/bin/env python3
"""PreToolUse hook for Bash — block commands that touch protected Notes/ folders.

Configured via Claude Code `--settings` profile. The CC file tools
(Read/Edit/Write/Glob/Grep) are already deny-listed in the profile for
protected paths; this hook closes the Bash bypass — otherwise a skill
following the "check Personal/ before asking" rule could do
`cat ~/Documents/Notes/Personal/car.md` and extract the data.

Stdin: JSON dict with ``tool_input.command`` (the Bash command line).
CLI args: one or more folder names under ``Notes/`` to protect
(e.g. ``Personal``, ``Personal-mobile``).

Exit codes:
    0 — allow the tool call.
    2 — block the tool call and surface the stderr message to the user.

Matcher uses a substring anchored to ``Notes/<name>`` and a negative
lookahead for an identifier-continuation character, so:
    Notes/Personal/       → match (file inside Personal/)
    Notes/Personal        → match (ls ~/.../Notes/Personal)
    Notes/Personal-mobile → NO match under the ``Personal`` rule
                            (the ``-mobile`` suffix exits the identifier)

Known limitation: this is not adversarial-hardened. A skill that
deliberately obfuscates the path (glob expansion, encoded strings,
symlinks) could still exfiltrate. The threat model covered is
"well-behaved skill follows the global CLAUDE.md rule and issues a
literal path" — not a hostile skill. True defense-in-depth requires
subprocess sandboxing, out of scope here.
"""

from __future__ import annotations

import json
import re
import sys


def _build_pattern(names: list[str]) -> re.Pattern[str]:
    # (?<![A-Za-z0-9_-]) rejects prefix matches like ``Notes/XPersonal``
    # (never occurs in practice, but cheap to guard against).
    # (?![A-Za-z0-9_-]) rejects suffix continuation like ``Personal-mobile``
    # so the ``Personal`` rule does not swallow the ``Personal-mobile`` folder.
    alternation = "|".join(re.escape(n) for n in names)
    return re.compile(rf"(?<![A-Za-z0-9_-])Notes/({alternation})(?![A-Za-z0-9_-])")


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("usage: block-paths.py <folder-name> [<folder-name> ...]", file=sys.stderr)
        return 1

    protected = argv[1:]
    pattern = _build_pattern(protected)

    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        # Malformed hook payload from CC — fail open (exit 0) rather than
        # block all Bash calls. CC will log the error separately.
        return 0

    command = ""
    tool_input = payload.get("tool_input")
    if isinstance(tool_input, dict):
        command = tool_input.get("command") or ""

    if not isinstance(command, str):
        return 0

    if pattern.search(command):
        print(
            f"Blocked: command references ~/Documents/Notes/{{{','.join(protected)}}}/ "
            f"which is protected by the Telegram bridge security profile.",
            file=sys.stderr,
        )
        return 2

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
