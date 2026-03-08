from pydantic import BaseModel, EmailStr


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
    role: str = "user"


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

    model_config = {"from_attributes": True}
