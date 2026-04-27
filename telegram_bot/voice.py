"""faster-whisper wrapper for voice-message transcription.

The whisper model is lazy-loaded on first voice message — the ``small``
weights are ~460 MB and loading on bot startup would delay ``/help`` for
no benefit. Once loaded, the model is retained in memory across
invocations.

Language is auto-detected (``ru`` / ``en``) from the audio; no forced
language. Per PRD decision Q4 the full transcript is echoed back to the
user regardless of length — short voice commands with misrecognitions are
the dangerous case, so the user always sees what CC will actually act on.

CPU int8 remains the default. ``WHISPER_DEVICE=auto`` is available for
benchmarking on the target Mac before changing the production env.
"""

import asyncio
import logging
import tempfile
import time
from pathlib import Path
from typing import Optional

log = logging.getLogger(__name__)

_model = None
_model_key = None
_model_lock = asyncio.Lock()


async def _get_model(model_size: str, compute_type: str, device: str):
    """Return the singleton ``WhisperModel``, constructing it on first call.

    The lock prevents two concurrent voice messages from loading the
    weights twice (rare in practice, single-user bot, but cheap to get
    right).
    """
    global _model, _model_key
    key = (model_size, compute_type, device)
    async with _model_lock:
        if _model is None or _model_key != key:
            log.info(
                "loading faster-whisper model=%s device=%s compute=%s",
                model_size,
                device,
                compute_type,
            )
            # Import deferred so unit tests can monkeypatch _get_model
            # without having to pull the heavy dependency.
            from faster_whisper import WhisperModel

            _model = await asyncio.to_thread(
                WhisperModel,
                model_size,
                device=device,
                compute_type=compute_type,
            )
            _model_key = key
            log.info("faster-whisper ready")
    return _model


async def transcribe_bytes(
    audio_bytes: bytes,
    *,
    model_size: str = "small",
    compute_type: str = "int8",
    device: str = "cpu",
    audio_duration_s: float | None = None,
) -> str:
    """Transcribe an Opus ``.ogg`` blob to text.

    The bytes are spilled to a NamedTemporaryFile so faster-whisper's
    file-based API can ingest them; the temp file is deleted in a
    ``finally`` block whether transcription succeeds or raises.

    Returns the concatenated transcript across all detected segments,
    whitespace-normalised. Returns an empty string if whisper yields no
    segments (silent recording, noise-only, etc.).
    """
    started = time.perf_counter()
    model = await _get_model(model_size, compute_type, device)
    tmp_path: Optional[Path] = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".ogg", delete=False) as f:
            f.write(audio_bytes)
            tmp_path = Path(f.name)

        def _run() -> str:
            segments, _info = model.transcribe(str(tmp_path), beam_size=5)
            return " ".join(seg.text.strip() for seg in segments).strip()

        transcript = await asyncio.to_thread(_run)
        elapsed = time.perf_counter() - started
        if audio_duration_s and audio_duration_s > 0:
            rtf = elapsed / audio_duration_s
            log.info(
                "voice transcription complete model=%s device=%s compute=%s elapsed=%.2fs audio=%.2fs rtf=%.2f text_len=%d",
                model_size,
                device,
                compute_type,
                elapsed,
                audio_duration_s,
                rtf,
                len(transcript),
            )
        else:
            log.info(
                "voice transcription complete model=%s device=%s compute=%s elapsed=%.2fs text_len=%d",
                model_size,
                device,
                compute_type,
                elapsed,
                len(transcript),
            )
        return transcript
    finally:
        if tmp_path is not None:
            try:
                tmp_path.unlink(missing_ok=True)
            except OSError:
                log.warning("failed to delete voice temp file %s", tmp_path)


def _reset_for_tests() -> None:
    global _model, _model_key
    _model = None
    _model_key = None
