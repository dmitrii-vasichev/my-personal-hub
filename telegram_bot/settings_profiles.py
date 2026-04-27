"""Runtime profile merging for per-project Claude Code settings.

The bot always starts from the global locked/unlocked profile, then
optionally layers ``<project>/.claude/settings.json`` on top. List values
are appended with de-duplication, so project-local settings can add rules
without removing the safety-critical global deny entries.
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
from copy import deepcopy
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)

GENERATED_DIR = Path(__file__).parent / "profiles" / "generated"
_SAFE_NAME = re.compile(r"[^a-zA-Z0-9_.-]+")


def _load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return data


def _dedupe_list(values: list[Any]) -> list[Any]:
    result: list[Any] = []
    seen: set[str] = set()
    for value in values:
        key = json.dumps(value, sort_keys=True, ensure_ascii=False)
        if key in seen:
            continue
        seen.add(key)
        result.append(value)
    return result


def merge_settings(base: dict[str, Any], overlay: dict[str, Any]) -> dict[str, Any]:
    """Merge project settings over a base profile without weakening lists."""
    merged = deepcopy(base)
    for key, value in overlay.items():
        if (
            key in merged
            and isinstance(merged[key], dict)
            and isinstance(value, dict)
        ):
            merged[key] = merge_settings(merged[key], value)
        elif (
            key in merged
            and isinstance(merged[key], list)
            and isinstance(value, list)
        ):
            merged[key] = _dedupe_list([*merged[key], *value])
        else:
            merged[key] = deepcopy(value)
    return merged


def _safe_project_name(project_name: str) -> str:
    safe = _SAFE_NAME.sub("-", project_name).strip(".-")
    return safe or "project"


def resolve_profile(
    *,
    base_profile: str,
    project_name: str,
    workdir: str,
) -> str:
    """Return a base or generated settings profile path for a project."""
    project_settings = Path(workdir) / ".claude" / "settings.json"
    if not project_settings.is_file():
        return base_profile

    base_path = Path(base_profile)
    try:
        base = _load_json(base_path)
        overlay = _load_json(project_settings)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        log.warning(
            "project settings ignored project=%s path=%s error=%s",
            project_name,
            project_settings,
            exc,
        )
        return base_profile

    merged = merge_settings(base, overlay)
    payload = json.dumps(merged, sort_keys=True, indent=2, ensure_ascii=False)
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:12]
    generated_name = (
        f"{_safe_project_name(project_name)}.{base_path.stem}.{digest}.json"
    )
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    out_path = GENERATED_DIR / generated_name
    if not out_path.is_file() or out_path.read_text(encoding="utf-8") != payload + "\n":
        tmp_path = out_path.with_suffix(out_path.suffix + ".tmp")
        tmp_path.write_text(payload + "\n", encoding="utf-8")
        tmp_path.replace(out_path)
    return str(out_path)
