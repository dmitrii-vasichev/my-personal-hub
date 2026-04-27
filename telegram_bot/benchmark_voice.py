"""Benchmark local faster-whisper transcription for a voice note file.

Examples:
    python benchmark_voice.py sample.ogg --duration 12 --device cpu
    python benchmark_voice.py sample.ogg --duration 12 --device auto
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import time
from pathlib import Path

import voice


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("audio_path", type=Path)
    parser.add_argument("--duration", type=float, default=None)
    parser.add_argument(
        "--model-size",
        default=os.getenv("WHISPER_MODEL_SIZE", "small"),
    )
    parser.add_argument(
        "--compute-type",
        default=os.getenv("WHISPER_COMPUTE_TYPE", "int8"),
    )
    parser.add_argument(
        "--device",
        default=os.getenv("WHISPER_DEVICE", "cpu"),
        help="faster-whisper device, for example cpu or auto",
    )
    return parser.parse_args()


async def _run(args: argparse.Namespace) -> dict:
    audio = args.audio_path.read_bytes()
    started = time.perf_counter()
    transcript = await voice.transcribe_bytes(
        audio,
        model_size=args.model_size,
        compute_type=args.compute_type,
        device=args.device,
        audio_duration_s=args.duration,
    )
    elapsed = time.perf_counter() - started
    return {
        "audio_path": str(args.audio_path),
        "audio_bytes": len(audio),
        "model_size": args.model_size,
        "compute_type": args.compute_type,
        "device": args.device,
        "elapsed_seconds": round(elapsed, 3),
        "audio_duration_seconds": args.duration,
        "real_time_factor": round(elapsed / args.duration, 3)
        if args.duration and args.duration > 0
        else None,
        "transcript_chars": len(transcript),
        "transcript_preview": transcript[:240],
    }


def main() -> None:
    args = _parse_args()
    result = asyncio.run(_run(args))
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
