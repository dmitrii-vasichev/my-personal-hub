"""Pydantic schemas for the Telegram→Claude-Code bridge (Phase 2).

These request/response bodies are consumed by the auth endpoints
(``check-sender``, ``verify-pin``) that back the bot, and by the Settings
UI endpoints that manage the owner's ``users.telegram_user_id`` /
``users.telegram_pin_hash`` columns.

The PIN is validated at the schema layer as 4–8 ASCII digits so the
endpoint never sees an obviously malformed value — bcrypt remains a
fixed-cost check only for well-formed PINs. Telegram user ids are
signed 64-bit integers in the Telegram Bot API, but the owner's account
id is always positive; ``gt=0`` rejects zero/negative inputs early.
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class CheckSenderRequest(BaseModel):
    telegram_user_id: int = Field(..., gt=0)


class CheckSenderResponse(BaseModel):
    hub_user_id: int


class VerifyPinRequest(BaseModel):
    pin: str = Field(..., pattern=r"^\d{4,8}$")


class VerifyPinResponse(BaseModel):
    ok: bool


class TelegramPinUpdateRequest(BaseModel):
    pin: str = Field(..., pattern=r"^\d{4,8}$")


class TelegramUserIdUpdateRequest(BaseModel):
    telegram_user_id: int = Field(..., gt=0)
