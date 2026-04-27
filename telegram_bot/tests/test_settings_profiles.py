"""Tests for per-project settings profile merging."""
from __future__ import annotations

import json
from pathlib import Path

import settings_profiles


def _write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data), encoding="utf-8")


def test_resolve_profile_without_project_settings_returns_base(tmp_path):
    base = tmp_path / "locked.settings.json"
    _write_json(base, {"permissions": {"deny": ["Read(~/secret/**)"]}})
    project = tmp_path / "project"
    project.mkdir()

    assert (
        settings_profiles.resolve_profile(
            base_profile=str(base),
            project_name="project",
            workdir=str(project),
        )
        == str(base)
    )


def test_resolve_profile_merges_deny_lists_without_dropping_base(
    tmp_path, monkeypatch
):
    generated = tmp_path / "generated"
    monkeypatch.setattr(settings_profiles, "GENERATED_DIR", generated)
    base = tmp_path / "locked.settings.json"
    _write_json(
        base,
        {
            "permissions": {
                "deny": [
                    "Read(~/Documents/Notes/Personal/**)",
                    "Bash(rm -rf*)",
                ]
            }
        },
    )
    project = tmp_path / "project"
    _write_json(
        project / ".claude" / "settings.json",
        {"permissions": {"deny": ["Read(./private/**)"]}},
    )

    resolved = settings_profiles.resolve_profile(
        base_profile=str(base),
        project_name="project",
        workdir=str(project),
    )

    assert resolved != str(base)
    merged = json.loads(Path(resolved).read_text(encoding="utf-8"))
    deny = merged["permissions"]["deny"]
    assert "Read(~/Documents/Notes/Personal/**)" in deny
    assert "Bash(rm -rf*)" in deny
    assert "Read(./private/**)" in deny


def test_resolve_profile_appends_hooks(tmp_path, monkeypatch):
    generated = tmp_path / "generated"
    monkeypatch.setattr(settings_profiles, "GENERATED_DIR", generated)
    base = tmp_path / "unlocked.settings.json"
    _write_json(base, {"hooks": {"PreToolUse": [{"matcher": "Bash"}]}})
    project = tmp_path / "project"
    _write_json(
        project / ".claude" / "settings.json",
        {"hooks": {"PreToolUse": [{"matcher": "Read"}]}},
    )

    resolved = settings_profiles.resolve_profile(
        base_profile=str(base),
        project_name="project",
        workdir=str(project),
    )

    merged = json.loads(Path(resolved).read_text(encoding="utf-8"))
    assert merged["hooks"]["PreToolUse"] == [
        {"matcher": "Bash"},
        {"matcher": "Read"},
    ]


def test_invalid_project_settings_falls_back_to_base(tmp_path):
    base = tmp_path / "locked.settings.json"
    _write_json(base, {"permissions": {"deny": ["Bash(rm -rf*)"]}})
    project = tmp_path / "project"
    project_settings = project / ".claude" / "settings.json"
    project_settings.parent.mkdir(parents=True)
    project_settings.write_text("[not-an-object]", encoding="utf-8")

    assert (
        settings_profiles.resolve_profile(
            base_profile=str(base),
            project_name="project",
            workdir=str(project),
        )
        == str(base)
    )
