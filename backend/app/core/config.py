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
    default_model: str = "openai/gpt-4o-mini"

    # API Keys (handled dynamically by LiteLLM if present in env)
    gemini_api_key: str | None = None
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None

    # Security & CORS (string in env, exposed as list via cors_origins property)
    allowed_origins: str = "*"
    secret_key: str = "dev-insecure-secret-key-change-in-production"

    @property
    def cors_origins(self) -> list[str]:
        """Return allowed origins as a parsed list of string domains for CORS middleware."""
        raw = self.allowed_origins.strip()
        if raw == "*":
            return ["*"]
        if raw.startswith("[") and raw.endswith("]"):
            import json
            try:
                return json.loads(raw)
            except Exception:
                pass
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
