"""Project discovery for the Telegram bridge.

Scans the sibling-projects directory (by default the parent of
``CC_WORKDIR``) and returns every immediate subdirectory that has a
root-level ``CLAUDE.md`` file and is not listed in the deny-list.

Called once at bot startup. If the set of projects changes, restart the
LaunchAgent (``launchctl kickstart -k gui/$(id -u)/...``).
"""

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Project:
    name: str
    path: str


def discover(base_dir: str, deny: list[str]) -> list[Project]:
    base = Path(base_dir)
    if not base.is_dir():
        return []

    deny_set = {d.strip() for d in deny if d.strip()}

    projects: list[Project] = []
    for child in base.iterdir():
        if not child.is_dir():
            continue
        if child.name in deny_set:
            continue
        if not (child / "CLAUDE.md").is_file():
            continue
        projects.append(Project(name=child.name, path=str(child.resolve())))

    projects.sort(key=lambda p: p.name)
    return projects
