from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).parent / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    telegram_bot_token: str = Field(..., min_length=10)
    whitelist_tg_user_id: int = Field(..., gt=0)
    cc_binary_path: str
    cc_workdir: str
    cc_timeout: int = Field(default=300, gt=0)
    log_level: str = Field(default="INFO")


def load_settings() -> Settings:
    return Settings()
