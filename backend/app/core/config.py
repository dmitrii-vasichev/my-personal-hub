from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/personal_hub"

    # JWT
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_DAYS: int = 7

    # Admin seed
    ADMIN_EMAIL: str = "admin@example.com"
    ADMIN_PASSWORD: str = ""

    # Demo seed
    DEMO_PASSWORD: str = "demo2026"

    # Encryption (Fernet key for API keys at rest)
    # Generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    ENCRYPTION_KEY: str = ""

    # Google Calendar OAuth2
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/calendar/oauth/callback"

    # Telegram (Telethon MTProto client)
    TELEGRAM_API_ID: int = 0
    TELEGRAM_API_HASH: str = ""

    # Telegram Bot token — optional override for Mini App initData validation.
    # If empty, the token is read from PulseSettings in the database.
    TELEGRAM_BOT_TOKEN: str = ""

    # Frontend URL for OAuth redirects
    FRONTEND_URL: str = "http://localhost:3000"

    # CORS — comma-separated list of allowed origins
    CORS_ORIGINS: str = "http://localhost:3000"

    # App
    APP_ENV: str = "development"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

if settings.APP_ENV == "production":
    if not settings.JWT_SECRET_KEY:
        raise RuntimeError("JWT_SECRET_KEY must be set in production")
    if not settings.ADMIN_PASSWORD:
        raise RuntimeError("ADMIN_PASSWORD must be set in production")
    if not settings.ENCRYPTION_KEY:
        raise RuntimeError("ENCRYPTION_KEY must be set in production")
