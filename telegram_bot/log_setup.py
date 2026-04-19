import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path


def setup_logging(level: str) -> None:
    log_dir = Path.home() / "Library" / "Logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / "com.my-personal-hub.telegram-bot.log"

    formatter = logging.Formatter(
        "%(asctime)s %(levelname)s %(name)s: %(message)s"
    )
    file_handler = RotatingFileHandler(
        log_file, maxBytes=5 * 1024 * 1024, backupCount=5
    )
    file_handler.setFormatter(formatter)

    handlers: list[logging.Handler] = [file_handler]

    # Only attach the stderr stream handler when running interactively.
    # Under launchd, stderr is a plain file and duplicating every INFO
    # line into it would turn the crash-only *.launchd.log into an
    # unrotated shadow copy of the primary RotatingFileHandler output.
    if sys.stderr.isatty():
        stream_handler = logging.StreamHandler()
        stream_handler.setFormatter(formatter)
        handlers.append(stream_handler)

    root = logging.getLogger()
    root.setLevel(level.upper())
    root.handlers = handlers
