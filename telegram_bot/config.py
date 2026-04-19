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
    # Phase 3 grace-period kill-switch for intermediate status edits.
    # Default False → bot behaves exactly like Phase 2 (single start + final
    # edit). The owner flips this on via .env only after ~48h of clean traffic
    # on the bot token; rationale in telegram_bot/README.md.
    progress_enabled: bool = Field(default=False, alias="TELEGRAM_PROGRESS_ENABLED")
    # faster-whisper knobs. ``small`` is ~460 MB; ``int8`` quantisation gives
    # ~3x speed vs float32 on CPU with negligible WER loss on short voice
    # notes. Per PRD decision Q3, Metal acceleration is deferred — the MVP
    # is CPU-only.
    whisper_model_size: str = Field(default="small", alias="WHISPER_MODEL_SIZE")
    whisper_compute_type: str = Field(default="int8", alias="WHISPER_COMPUTE_TYPE")


def load_settings() -> Settings:
    return Settings()
