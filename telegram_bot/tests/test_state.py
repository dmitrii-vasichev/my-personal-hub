import json
import uuid

import pytest

import state


@pytest.fixture
def isolated_state(tmp_path, monkeypatch):
    """Point ``state.STATE_FILE`` at a tmp path so tests never touch the real
    ``telegram_bot/.state.json``.
    """
    monkeypatch.setattr(state, "STATE_FILE", tmp_path / ".state.json")
    yield tmp_path / ".state.json"


def test_get_session_default_when_no_file(isolated_state):
    assert not isolated_state.exists()
    result = state.get_session(12345)
    assert result == state.TG_DEFAULT_UUID
    # Reading the default must not create the file on disk.
    assert not isolated_state.exists()


def test_new_session_persists_uuid4_and_get_returns_it(isolated_state):
    new_uuid = state.new_session(12345)
    # Must be a valid uuid4 string.
    parsed = uuid.UUID(new_uuid)
    assert parsed.version == 4
    # File exists and contains the mapping.
    data = json.loads(isolated_state.read_text())
    assert data == {"sessions": {"12345": new_uuid}}
    # Subsequent get_session returns the same UUID.
    assert state.get_session(12345) == new_uuid


def test_new_session_isolated_per_chat(isolated_state):
    uuid_a = state.new_session(111)
    # Chat A has a stored UUID; chat B should still fall back to the default.
    assert state.get_session(111) == uuid_a
    assert state.get_session(222) == state.TG_DEFAULT_UUID


def test_corrupt_state_file_returns_default(isolated_state):
    isolated_state.write_text("{ not valid json")
    result = state.get_session(12345)
    assert result == state.TG_DEFAULT_UUID


@pytest.mark.parametrize("content", ["{}", '{"sessions": null}'])
def test_wrong_shape_state_file_returns_default(isolated_state, content):
    # Valid JSON but schema is wrong — _read must harden against missing or
    # non-dict "sessions" keys so get_session never raises KeyError/AttributeError.
    isolated_state.write_text(content)
    result = state.get_session(12345)
    assert result == state.TG_DEFAULT_UUID


def test_new_session_twice_replaces_uuid(isolated_state):
    first = state.new_session(12345)
    second = state.new_session(12345)
    assert first != second
    assert state.get_session(12345) == second
