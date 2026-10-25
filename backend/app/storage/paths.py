"""Tenant path resolver for ScribeX.

Ensures that all Markdown files, SQLite databases, and LanceDB tables
are isolated per user from Day 1 to support seamless SaaS scaling.
"""

from pathlib import Path
from app.core.config import settings


def get_tenant_dir(user_id: str = settings.default_user_id) -> Path:
    """Return the root data directory for a specific tenant."""
    tenant_dir = settings.data_dir / "tenants" / user_id
    tenant_dir.mkdir(parents=True, exist_ok=True)
    return tenant_dir


def get_vault_path(user_id: str = settings.default_user_id) -> Path:
    """Return the Git-backed Markdown vault directory for a tenant."""
    vault_path = get_tenant_dir(user_id) / "vault"
    vault_path.mkdir(parents=True, exist_ok=True)
    return vault_path


def get_sqlite_dir(user_id: str = settings.default_user_id) -> Path:
    """Return the directory containing SQLite databases for a tenant."""
    sqlite_dir = get_tenant_dir(user_id) / "sqlite"
    sqlite_dir.mkdir(parents=True, exist_ok=True)
    return sqlite_dir


def get_sqlite_path(user_id: str = settings.default_user_id) -> Path:
    """Return the full file path to the operational SQLite database."""
    return get_sqlite_dir(user_id) / "scribex.db"


def get_lancedb_path(user_id: str = settings.default_user_id) -> Path:
    """Return the embedded LanceDB directory for a tenant."""
    lancedb_path = get_tenant_dir(user_id) / "lancedb"
    lancedb_path.mkdir(parents=True, exist_ok=True)
    return lancedb_path


def ensure_tenant_directories(user_id: str = settings.default_user_id) -> dict[str, Path]:
    """Ensure all required directories for a tenant exist and return their paths."""
    return {
        "tenant_root": get_tenant_dir(user_id),
        "vault": get_vault_path(user_id),
        "sqlite_dir": get_sqlite_dir(user_id),
        "sqlite_db": get_sqlite_path(user_id),
        "lancedb": get_lancedb_path(user_id),
    }
