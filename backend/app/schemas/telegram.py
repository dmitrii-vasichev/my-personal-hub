from datetime import datetime
from typing import Optional

from pydantic import BaseModel


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
