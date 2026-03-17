import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


class TelegramStartAuthRequest(BaseModel):
    phone_number: str


class TelegramVerifyCodeRequest(BaseModel):
    code: str
    password: Optional[str] = None


class TelegramStatusResponse(BaseModel):
    connected: bool
    phone_number: Optional[str] = None
    connected_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TelegramCredentialsSaveRequest(BaseModel):
    api_id: int
    api_hash: str

    @field_validator("api_id")
    @classmethod
    def api_id_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("api_id must be a positive integer")
        return v

    @field_validator("api_hash")
    @classmethod
    def api_hash_hex32(cls, v: str) -> str:
        if not re.fullmatch(r"[0-9a-fA-F]{32}", v):
            raise ValueError("api_hash must be a 32-character hex string")
        return v


class TelegramConfigStatusResponse(BaseModel):
    configured: bool
    api_id: Optional[int] = None
