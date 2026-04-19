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
    # Optional offline fallback. When the Hub's check-sender endpoint is
    # unreachable (transport error, 5xx, etc.), the bot falls back to this
    # env-based whitelist. In normal operation the owner configures the
    # whitelist via Settings → Telegram Bridge in the Hub UI.
    whitelist_tg_user_id: int | None = Field(default=None, gt=0)
    cc_binary_path: str
    cc_workdir: str
    cc_timeout: int = Field(default=300, gt=0)
    log_level: str = Field(default="INFO")
    hub_api_url: str = Field(..., min_length=1)
    hub_api_token: str = Field(..., min_length=10)


def load_settings() -> Settings:
    return Settings()
