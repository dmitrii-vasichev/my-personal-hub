import logging
import sys
from logging.handlers import RotatingFileHandler

import pytest

from log_setup import setup_logging


@pytest.fixture(autouse=True)
def restore_root_logger():
    root = logging.getLogger()
    saved_handlers = root.handlers[:]
    saved_level = root.level
    yield
    for h in root.handlers:
        h.close()
    root.handlers = saved_handlers
    root.level = saved_level


def test_file_handler_always_attached(monkeypatch):
    monkeypatch.setattr(sys.stderr, "isatty", lambda: False)
    setup_logging("INFO")
    root = logging.getLogger()
    assert any(isinstance(h, RotatingFileHandler) for h in root.handlers)


def test_stream_handler_attached_under_tty(monkeypatch):
    monkeypatch.setattr(sys.stderr, "isatty", lambda: True)
    setup_logging("INFO")
    root = logging.getLogger()
    stream_handlers = [
        h
        for h in root.handlers
        if isinstance(h, logging.StreamHandler)
        and not isinstance(h, RotatingFileHandler)
    ]
    assert len(stream_handlers) == 1


def test_stream_handler_absent_under_launchd(monkeypatch):
    monkeypatch.setattr(sys.stderr, "isatty", lambda: False)
    setup_logging("INFO")
    root = logging.getLogger()
    stream_handlers = [
        h
        for h in root.handlers
        if isinstance(h, logging.StreamHandler)
        and not isinstance(h, RotatingFileHandler)
    ]
    assert stream_handlers == []


def test_level_applied(monkeypatch):
    monkeypatch.setattr(sys.stderr, "isatty", lambda: False)
    setup_logging("DEBUG")
    assert logging.getLogger().level == logging.DEBUG
