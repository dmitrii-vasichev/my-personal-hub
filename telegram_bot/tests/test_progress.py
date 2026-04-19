"""Tests for ``progress`` — stream-json parser + throttled status edits.

The event shapes under test mirror what the Task 0 spike captured against
CC CLI 2.1.114 on 2026-04-19: ``tool_use`` blocks are nested inside
``assistant.message.content[]``, and the terminal event is ``result`` with
the final reply in ``result.result``.
"""

import progress


def _assistant_with_tool_use(name: str, **input_kwargs) -> dict:
    return {
        "type": "assistant",
        "message": {
            "content": [
                {"type": "tool_use", "name": name, "input": input_kwargs}
            ]
        },
    }


# --- format_event ---------------------------------------------------------


def test_format_event_read():
    evt = _assistant_with_tool_use("Read", file_path="/Users/x/notes/a.md")
    assert progress.format_event(evt) == "📖 reading a.md"


def test_format_event_edit_uses_writing_emoji():
    evt = _assistant_with_tool_use("Edit", file_path="/Users/x/main.py")
    assert progress.format_event(evt) == "✏️ writing main.py"


def test_format_event_write_uses_writing_emoji():
    evt = _assistant_with_tool_use("Write", file_path="/Users/x/new.py")
    assert progress.format_event(evt) == "✏️ writing new.py"


def test_format_event_bash_truncates_to_60_chars():
    long_cmd = "echo " + "x" * 100
    evt = _assistant_with_tool_use("Bash", command=long_cmd)
    status = progress.format_event(evt)
    assert status.startswith("🔧 running: ")
    # Prefix "🔧 running: " + 60-char command.
    assert len(status) == len("🔧 running: ") + 60


def test_format_event_grep_and_glob():
    evt_grep = _assistant_with_tool_use("Grep", pattern="foo")
    evt_glob = _assistant_with_tool_use("Glob", pattern="**/*.py")
    assert progress.format_event(evt_grep) == "🔍 searching files"
    assert progress.format_event(evt_glob) == "🔍 searching files"


def test_format_event_task_uses_subagent_type():
    evt = _assistant_with_tool_use("Task", subagent_type="Explore")
    assert progress.format_event(evt) == "🧩 using skill: Explore"


def test_format_event_unknown_tool_returns_none():
    evt = _assistant_with_tool_use("MysteryTool", foo="bar")
    assert progress.format_event(evt) is None


def test_format_event_thinking_block_returns_none():
    evt = {
        "type": "assistant",
        "message": {"content": [{"type": "thinking", "thinking": "..."}]},
    }
    assert progress.format_event(evt) is None


def test_format_event_text_block_returns_none():
    # Final reply text should not trigger a status edit — that's the
    # terminal ✅/❌ edit's job.
    evt = {
        "type": "assistant",
        "message": {"content": [{"type": "text", "text": "hello"}]},
    }
    assert progress.format_event(evt) is None


def test_format_event_non_assistant_returns_none():
    for evt in [
        {"type": "system", "subtype": "init"},
        {"type": "user", "message": {"content": [{"type": "tool_result"}]}},
        {"type": "rate_limit_event"},
        {"type": "result", "subtype": "success", "result": "hi"},
    ]:
        assert progress.format_event(evt) is None, evt


def test_format_event_prefers_first_renderable_tool_use():
    """Multiple tool_use blocks in one event → report the first one."""
    evt = {
        "type": "assistant",
        "message": {
            "content": [
                {"type": "thinking", "thinking": "..."},
                {"type": "tool_use", "name": "Read",
                 "input": {"file_path": "/a/x.md"}},
                {"type": "tool_use", "name": "Bash",
                 "input": {"command": "ls"}},
            ]
        },
    }
    assert progress.format_event(evt) == "📖 reading x.md"


# --- extract_final_text ---------------------------------------------------


def test_extract_final_text_from_result_event():
    evt = {"type": "result", "subtype": "success", "result": "hi there"}
    assert progress.extract_final_text(evt) == "hi there"


def test_extract_final_text_none_for_non_result():
    evt = {"type": "assistant", "message": {"content": []}}
    assert progress.extract_final_text(evt) is None


def test_extract_final_text_none_when_result_missing():
    evt = {"type": "result", "subtype": "success"}
    assert progress.extract_final_text(evt) is None


# --- is_result_error -------------------------------------------------------


def test_is_result_error_success():
    assert progress.is_result_error({"type": "result", "subtype": "success", "is_error": False}) is False


def test_is_result_error_is_error_flag():
    assert progress.is_result_error({"type": "result", "subtype": "success", "is_error": True}) is True


def test_is_result_error_non_success_subtype():
    assert progress.is_result_error({"type": "result", "subtype": "error"}) is True


def test_is_result_error_non_result_event_returns_false():
    assert progress.is_result_error({"type": "assistant"}) is False


# --- should_edit / mark_edited throttle -----------------------------------


def test_should_edit_blocks_before_interval():
    state = progress.StatusState(last_edit_ts=100.0)
    assert progress.should_edit(state, now=109.999) is False


def test_should_edit_allows_after_interval():
    state = progress.StatusState(last_edit_ts=100.0)
    assert progress.should_edit(state, now=110.01) is True


def test_should_edit_allows_on_first_call():
    # Default last_edit_ts=0 means any now>=10 permits an edit.
    state = progress.StatusState()
    assert progress.should_edit(state, now=10.0) is True


def test_mark_edited_explicit_timestamp():
    state = progress.StatusState()
    progress.mark_edited(state, now=42.0)
    assert state.last_edit_ts == 42.0


# --- parse_line resilience ------------------------------------------------


def test_parse_line_happy_path():
    state = progress.StatusState()
    line = '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Read","input":{"file_path":"/a/b.md"}}]}}'
    assert progress.parse_line(line, state) == "📖 reading b.md"
    assert state.parse_disabled is False


def test_parse_line_empty_returns_none_and_stays_active():
    state = progress.StatusState()
    assert progress.parse_line("", state) is None
    assert progress.parse_line("   ", state) is None
    assert state.parse_disabled is False


def test_parse_line_disables_after_bad_json():
    state = progress.StatusState()
    assert progress.parse_line("not json at all {", state) is None
    assert state.parse_disabled is True
    # Subsequent valid lines are ignored — no spinner fallback, per PRD.
    good = '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Read","input":{"file_path":"/x.md"}}]}}'
    assert progress.parse_line(good, state) is None


def test_parse_line_ignores_non_object_json():
    state = progress.StatusState()
    # JSON array at top level — not an event shape we know.
    assert progress.parse_line("[1,2,3]", state) is None
    # But the parser is still live: a subsequent valid object parses fine.
    good = '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash","input":{"command":"ls"}}]}}'
    assert progress.parse_line(good, state) == "🔧 running: ls"


def test_parse_line_noise_events_return_none():
    state = progress.StatusState()
    for raw in [
        '{"type":"system","subtype":"init"}',
        '{"type":"rate_limit_event"}',
        '{"type":"user","message":{"content":[{"type":"tool_result"}]}}',
    ]:
        assert progress.parse_line(raw, state) is None
    assert state.parse_disabled is False
