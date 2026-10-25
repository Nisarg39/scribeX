"""Central configuration module for ScribeX Core Backend."""

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable overrides."""

    environment: str = "development"
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "INFO"

    # Base data directory (defaults to backend/data in development)
    data_dir: Path = Path(__file__).resolve().parent.parent.parent / "data"
    default_user_id: str = "default_user"

    # LLM Settings
    default_model: str = "gemini/gemini-1.5-flash"

    # API Keys (handled dynamically by LiteLLM if present in env)
    gemini_api_key: str | None = None
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None

    # Security
    allowed_origins: list[str] = ["*"]
    secret_key: str = "dev-insecure-secret-key-change-in-production"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
