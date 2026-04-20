from pathlib import Path

from projects import Project, discover


def test_discover_returns_projects_with_claude_md(tmp_path: Path):
    (tmp_path / "alpha").mkdir()
    (tmp_path / "alpha" / "CLAUDE.md").write_text("# alpha")
    (tmp_path / "beta").mkdir()
    (tmp_path / "beta" / "CLAUDE.md").write_text("# beta")
    (tmp_path / "no-claude").mkdir()  # no CLAUDE.md — should be filtered

    found = discover(str(tmp_path), deny=[])

    names = {p.name for p in found}
    assert names == {"alpha", "beta"}


def test_discover_sorts_alphabetically(tmp_path: Path):
    for name in ["zeta", "alpha", "mid"]:
        (tmp_path / name).mkdir()
        (tmp_path / name / "CLAUDE.md").write_text("#")
    found = discover(str(tmp_path), deny=[])
    assert [p.name for p in found] == ["alpha", "mid", "zeta"]


def test_discover_applies_deny_list(tmp_path: Path):
    for name in ["keep", "drop", "also-keep"]:
        (tmp_path / name).mkdir()
        (tmp_path / name / "CLAUDE.md").write_text("#")
    found = discover(str(tmp_path), deny=["drop"])
    assert {p.name for p in found} == {"keep", "also-keep"}


def test_discover_deny_list_is_whitespace_tolerant(tmp_path: Path):
    (tmp_path / "hide-me").mkdir()
    (tmp_path / "hide-me" / "CLAUDE.md").write_text("#")
    (tmp_path / "visible").mkdir()
    (tmp_path / "visible" / "CLAUDE.md").write_text("#")
    found = discover(str(tmp_path), deny=[" hide-me ", "", "something-else"])
    assert {p.name for p in found} == {"visible"}


def test_discover_missing_base_dir_returns_empty(tmp_path: Path):
    assert discover(str(tmp_path / "does-not-exist"), deny=[]) == []


def test_discover_skips_non_directories(tmp_path: Path):
    (tmp_path / "real").mkdir()
    (tmp_path / "real" / "CLAUDE.md").write_text("#")
    (tmp_path / "stray-file").write_text("hello")
    found = discover(str(tmp_path), deny=[])
    assert {p.name for p in found} == {"real"}


def test_project_path_is_absolute(tmp_path: Path):
    (tmp_path / "one").mkdir()
    (tmp_path / "one" / "CLAUDE.md").write_text("#")
    found = discover(str(tmp_path), deny=[])
    assert len(found) == 1
    assert Path(found[0].path).is_absolute()


def test_project_is_frozen_dataclass():
    p = Project(name="foo", path="/tmp/foo")
    try:
        p.name = "bar"  # type: ignore[misc]
    except Exception:
        return
    raise AssertionError("Project should be immutable")
