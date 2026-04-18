from datetime import datetime
from typing import Literal, Optional
from zoneinfo import available_timezones

from pydantic import BaseModel, EmailStr, field_validator

# IANA timezone names available on this interpreter. Used to reject bogus
# values at the schema layer so callers get a 422/400 rather than a runtime
# ZoneInfoNotFoundError deeper in the stack.
_VALID_TIMEZONES = available_timezones()


def _validate_tz(v: str) -> str:
    if v not in _VALID_TIMEZONES:
        raise ValueError(f"Invalid IANA timezone: {v!r}")
    return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    must_change_password: bool


class RegisterRequest(BaseModel):
    email: EmailStr
    display_name: str
    role: str = "member"


class RegisterResponse(BaseModel):
    id: int
    email: str
    display_name: str
    role: str
    temporary_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UserResponse(BaseModel):
    id: int
    email: str
    display_name: str
    role: str
    must_change_password: bool
    is_blocked: bool
    theme: str
    timezone: str
    last_login_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# --- User CRUD schemas (Task 1) ---

class CreateUserRequest(BaseModel):
    email: EmailStr
    display_name: str
    role: str = "member"
    timezone: str = "UTC"

    @field_validator("timezone")
    @classmethod
    def _check_timezone(cls, v: str) -> str:
        return _validate_tz(v)


class UpdateUserRequest(BaseModel):
    role: Optional[str] = None
    is_blocked: Optional[bool] = None
    timezone: Optional[str] = None

    @field_validator("timezone")
    @classmethod
    def _check_timezone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return _validate_tz(v)


class ResetPasswordResponse(BaseModel):
    temporary_password: str
    must_change_password: bool = True


# --- Profile schemas (Task 2) ---

class ProfileResponse(BaseModel):
    id: int
    email: str
    display_name: str
    role: str
    theme: str
    timezone: str
    is_blocked: bool
    must_change_password: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    display_name: Optional[str] = None
    theme: Optional[Literal["light", "dark"]] = None
    timezone: Optional[str] = None

    @field_validator("timezone")
    @classmethod
    def _check_timezone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return _validate_tz(v)
