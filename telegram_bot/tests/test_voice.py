"""Tests for ``voice.transcribe_bytes``.

The real ``faster_whisper.WhisperModel`` is never instantiated — tests
monkeypatch ``voice._get_model`` with an AsyncMock returning a fake
model. The fake's ``transcribe`` method is a synchronous stub that
mimics the real API (``(segments_iterable, info)`` tuple).

Test functions are sync wrappers around ``asyncio.run`` to stay
consistent with the rest of the suite; this avoids depending on
``pytest-asyncio`` which is not in ``requirements.txt``.

The integration-level test that actually loads the model is gated by a
``@pytest.mark.voice_real`` marker and skipped by default — run it
manually during Phase 3 smoke with ``-m voice_real``.
"""

import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

import voice


@pytest.fixture(autouse=True)
def _reset_model():
    voice._reset_for_tests()
    yield
    voice._reset_for_tests()


class _FakeSegment:
    def __init__(self, text):
        self.text = text


def _patch_model(monkeypatch, segments):
    fake = MagicMock()
    fake.transcribe.return_value = (segments, None)
    monkeypatch.setattr(voice, "_get_model", AsyncMock(return_value=fake))
    return fake


def test_transcribe_returns_concatenated_segments(monkeypatch):
    _patch_model(
        monkeypatch,
        [_FakeSegment("привет "), _FakeSegment(" мир")],
    )
    transcript = asyncio.run(voice.transcribe_bytes(b"fake ogg bytes"))
    # Each segment is individually stripped, then joined with a single space.
    assert transcript == "привет мир"


def test_transcribe_strips_outer_whitespace(monkeypatch):
    _patch_model(monkeypatch, [_FakeSegment("  hello world  ")])
    transcript = asyncio.run(voice.transcribe_bytes(b"fake"))
    assert transcript == "hello world"


def test_transcribe_empty_segments_yield_empty_string(monkeypatch):
    _patch_model(monkeypatch, [])
    assert asyncio.run(voice.transcribe_bytes(b"silent")) == ""


def test_transcribe_deletes_temp_file_on_success(monkeypatch):
    """The .ogg tempfile must be cleaned up after a successful transcription."""
    captured_paths: list[Path] = []

    def side_effect(path, beam_size=5):
        captured_paths.append(Path(path))
        assert Path(path).exists(), "tmp file must exist during transcribe"
        return ([_FakeSegment("ok")], None)

    fake = MagicMock()
    fake.transcribe.side_effect = side_effect
    monkeypatch.setattr(voice, "_get_model", AsyncMock(return_value=fake))

    asyncio.run(voice.transcribe_bytes(b"fake"))

    assert captured_paths, "transcribe should have been called"
    assert not captured_paths[0].exists(), "tmp file must be cleaned up after"


def test_transcribe_deletes_temp_file_on_error(monkeypatch):
    """finally-block cleanup invariant — errors must not leak tempfiles."""
    captured_paths: list[Path] = []

    def side_effect(path, beam_size=5):
        captured_paths.append(Path(path))
        raise RuntimeError("whisper exploded")

    fake = MagicMock()
    fake.transcribe.side_effect = side_effect
    monkeypatch.setattr(voice, "_get_model", AsyncMock(return_value=fake))

    with pytest.raises(RuntimeError, match="whisper exploded"):
        asyncio.run(voice.transcribe_bytes(b"fake"))

    assert captured_paths, "transcribe should have been called"
    assert not captured_paths[0].exists(), "tmp file must be cleaned up on error"


def test_transcribe_forwards_model_size_and_compute(monkeypatch):
    get_model_mock = AsyncMock(
        return_value=MagicMock(
            transcribe=MagicMock(return_value=([_FakeSegment("x")], None))
        )
    )
    monkeypatch.setattr(voice, "_get_model", get_model_mock)

    asyncio.run(
        voice.transcribe_bytes(
            b"fake", model_size="tiny", compute_type="int8_float16"
        )
    )

    get_model_mock.assert_awaited_once_with("tiny", "int8_float16")
