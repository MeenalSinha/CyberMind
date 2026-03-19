"""
config.py — Single source of truth for all environment configuration.
Pydantic-settings validates types and raises clear errors at startup
if required values are missing, rather than silently using None.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import List
import os


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Auth ──────────────────────────────────────────────────────────────────
    secret_key: str = ""
    environment: str = "development"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # ── Database ──────────────────────────────────────────────────────────────
    database_url: str = "sqlite+aiosqlite:///./cybermind.db"
    db_echo: bool = False

    # ── CORS ──────────────────────────────────────────────────────────────────
    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @field_validator("secret_key")
    @classmethod
    def require_secret_key_in_prod(cls, v: str, info) -> str:
        env = (info.data or {}).get("environment", "development")
        if env == "production" and not v:
            raise ValueError("SECRET_KEY must be set in production.")
        if not v:
            import logging
            logging.getLogger(__name__).warning(
                "SECRET_KEY not set — using insecure dev default. "
                "Set SECRET_KEY env var before deploying."
            )
            return "dev-only-insecure-key-do-not-use-in-production"
        return v

    @field_validator("database_url")
    @classmethod
    def fix_postgres_url(cls, v: str) -> str:
        # Render injects postgres:// — SQLAlchemy needs postgresql+asyncpg://
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+asyncpg://", 1)
        return v


# Module-level singleton — import this everywhere instead of os.getenv()
settings = Settings()
