"""Storage path resolver for ScribeX.

Provides clean, standardized paths matching Technical_System_Architecture.md:
- Default / Single-User mode: backend/data/{vault, sqlite, lancedb}
- Multi-Tenant SaaS mode: backend/data/tenants/{user_id}/{vault, sqlite, lancedb}
"""

from pathlib import Path
from app.core.config import settings


def get_base_storage_dir(user_id: str = settings.default_user_id) -> Path:
    """Return the base storage directory for the given user.

    For the default user, uses the clean top-level data directory.
    For custom tenant IDs (SaaS mode), isolates under data/tenants/{user_id}.
    """
    resolved_data_dir = settings.data_dir.resolve()
    if user_id == settings.default_user_id:
        base_dir = resolved_data_dir
    else:
        base_dir = resolved_data_dir / "tenants" / user_id

    base_dir.mkdir(parents=True, exist_ok=True)
    return base_dir


# Alias for backward compatibility
get_tenant_dir = get_base_storage_dir


def get_vault_path(user_id: str = settings.default_user_id) -> Path:
    """Return the Git-backed Markdown vault directory (data/vault)."""
    vault_path = get_base_storage_dir(user_id) / "vault"
    vault_path.mkdir(parents=True, exist_ok=True)
    return vault_path


def get_sqlite_dir(user_id: str = settings.default_user_id) -> Path:
    """Return the directory containing SQLite databases (data/sqlite)."""
    sqlite_dir = get_base_storage_dir(user_id) / "sqlite"
    sqlite_dir.mkdir(parents=True, exist_ok=True)
    return sqlite_dir


def get_sqlite_path(user_id: str = settings.default_user_id) -> Path:
    """Return the file path to the operational SQLite database (data/sqlite/scribex.db)."""
    return get_sqlite_dir(user_id) / "scribex.db"


def get_lancedb_path(user_id: str = settings.default_user_id) -> Path:
    """Return the embedded LanceDB directory (data/lancedb)."""
    lancedb_path = get_base_storage_dir(user_id) / "lancedb"
    lancedb_path.mkdir(parents=True, exist_ok=True)
    return lancedb_path


def ensure_tenant_directories(user_id: str = settings.default_user_id) -> dict[str, Path]:
    """Ensure all required directories exist and return their paths."""
    return {
        "base_root": get_base_storage_dir(user_id),
        "vault": get_vault_path(user_id),
        "sqlite_dir": get_sqlite_dir(user_id),
        "sqlite_db": get_sqlite_path(user_id),
        "lancedb": get_lancedb_path(user_id),
    }
