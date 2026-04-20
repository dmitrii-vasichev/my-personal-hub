import json
import uuid

import pytest

import state


DEFAULT = "my-personal-hub"


@pytest.fixture
def isolated_state(tmp_path, monkeypatch):
    """Point ``state.STATE_FILE`` at a tmp path and reset the module-level
    default project name so each test starts from a known baseline.
    """
    monkeypatch.setattr(state, "STATE_FILE", tmp_path / ".state.json")
    monkeypatch.setattr(state, "_default_project", None)
    state.configure(DEFAULT)
    yield tmp_path / ".state.json"


def test_get_session_default_when_no_file(isolated_state):
    assert not isolated_state.exists()
    result = state.get_session(12345, DEFAULT)
    assert result == state.TG_DEFAULT_UUID
    # Reading the default must not create the file on disk.
    assert not isolated_state.exists()


def test_new_session_persists_uuid4_and_get_returns_it(isolated_state):
    new_uuid = state.new_session(12345, DEFAULT)
    parsed = uuid.UUID(new_uuid)
    assert parsed.version == 4
    data = json.loads(isolated_state.read_text())
    assert data == {
        "chats": {
            "12345": {
                "active_project": DEFAULT,
                "sessions": {DEFAULT: new_uuid},
            }
        }
    }
    assert state.get_session(12345, DEFAULT) == new_uuid


def test_new_session_isolated_per_chat(isolated_state):
    uuid_a = state.new_session(111, DEFAULT)
    assert state.get_session(111, DEFAULT) == uuid_a
    # Chat 222 never got a new_session — still falls back to TG_DEFAULT_UUID.
    assert state.get_session(222, DEFAULT) == state.TG_DEFAULT_UUID


def test_corrupt_state_file_returns_default(isolated_state):
    isolated_state.write_text("{ not valid json")
    result = state.get_session(12345, DEFAULT)
    assert result == state.TG_DEFAULT_UUID


@pytest.mark.parametrize("content", ["{}", '{"chats": null}', '{"sessions": null}'])
def test_wrong_shape_state_file_returns_default(isolated_state, content):
    isolated_state.write_text(content)
    result = state.get_session(12345, DEFAULT)
    assert result == state.TG_DEFAULT_UUID


def test_new_session_twice_replaces_uuid(isolated_state):
    first = state.new_session(12345, DEFAULT)
    second = state.new_session(12345, DEFAULT)
    assert first != second
    assert state.get_session(12345, DEFAULT) == second


def test_legacy_format_migrates_on_first_read(isolated_state):
    legacy = {"sessions": {"12345": "legacy-uuid", "67890": "another"}}
    isolated_state.write_text(json.dumps(legacy))

    result = state.get_session(12345, DEFAULT)
    assert result == "legacy-uuid"

    disk = json.loads(isolated_state.read_text())
    assert disk == {
        "chats": {
            "12345": {
                "active_project": DEFAULT,
                "sessions": {DEFAULT: "legacy-uuid"},
            },
            "67890": {
                "active_project": DEFAULT,
                "sessions": {DEFAULT: "another"},
            },
        }
    }


def test_legacy_format_migrates_before_configure_uses_fallback_name(tmp_path, monkeypatch):
    monkeypatch.setattr(state, "STATE_FILE", tmp_path / ".state.json")
    monkeypatch.setattr(state, "_default_project", None)
    # Intentionally do not call configure() — migration must still work,
    # using the module's built-in fallback name.
    (tmp_path / ".state.json").write_text(json.dumps({"sessions": {"1": "u"}}))
    state.get_session(1, "my-personal-hub")
    disk = json.loads((tmp_path / ".state.json").read_text())
    assert disk["chats"]["1"]["active_project"] == "my-personal-hub"


def test_non_default_project_persists_fresh_uuid_on_first_read(isolated_state):
    first = state.get_session(12345, "market-pulse-dashboard")
    # Must be a valid uuid4, not TG_DEFAULT_UUID.
    parsed = uuid.UUID(first)
    assert parsed.version == 4
    assert first != state.TG_DEFAULT_UUID
    # Second read returns the same UUID — it was persisted on the first.
    second = state.get_session(12345, "market-pulse-dashboard")
    assert second == first


def test_set_active_project_persists(isolated_state):
    state.set_active_project(12345, "mestnie")
    assert state.get_active_project(12345, DEFAULT) == "mestnie"
    disk = json.loads(isolated_state.read_text())
    assert disk["chats"]["12345"]["active_project"] == "mestnie"


def test_get_active_project_default_when_no_entry(isolated_state):
    # No entry → fallback returned, file NOT created (keeps Phase 1 compat).
    assert state.get_active_project(12345, DEFAULT) == DEFAULT
    assert not isolated_state.exists()


def test_active_project_is_per_chat_not_global(isolated_state):
    state.set_active_project(111, "moving")
    state.set_active_project(222, "portfolio-site")
    assert state.get_active_project(111, DEFAULT) == "moving"
    assert state.get_active_project(222, DEFAULT) == "portfolio-site"
    # Chat that never set anything falls back to the default.
    assert state.get_active_project(333, DEFAULT) == DEFAULT


def test_sessions_isolated_per_project_same_chat(isolated_state):
    u_hub = state.new_session(12345, DEFAULT)
    u_mpd = state.new_session(12345, "market-pulse-dashboard")
    assert u_hub != u_mpd
    assert state.get_session(12345, DEFAULT) == u_hub
    assert state.get_session(12345, "market-pulse-dashboard") == u_mpd


def test_new_session_preserves_other_project_sessions(isolated_state):
    u_hub = state.new_session(12345, DEFAULT)
    state.new_session(12345, "moving")
    # Creating the second project's session must not disturb the first.
    assert state.get_session(12345, DEFAULT) == u_hub


def test_set_active_project_preserves_sessions(isolated_state):
    u_hub = state.new_session(12345, DEFAULT)
    state.set_active_project(12345, "moving")
    # Active project changed but the Hub session UUID is still there.
    assert state.get_session(12345, DEFAULT) == u_hub
    assert state.get_active_project(12345, DEFAULT) == "moving"
