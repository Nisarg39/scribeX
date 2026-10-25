"""Tests for Step 1: Scaffolding, Configuration, and Path Resolution."""

import pytest
from httpx import AsyncClient, ASGITransport
import shutil

from app.main import app
from app.core.config import settings
from app.storage.paths import (
    get_tenant_dir,
    get_vault_path,
    get_sqlite_path,
    get_lancedb_path,
    ensure_tenant_directories,
)
from app.api.deps import get_current_user_id


@pytest.mark.asyncio
async def test_health_check_endpoint():
    """Verify the /health endpoint responds with expected status and service name."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "ScribeX Core VPS"
        assert data["default_user"] == settings.default_user_id


@pytest.mark.asyncio
async def test_root_endpoint():
    """Verify the root info endpoint."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "ScribeX Core VPS API" in data["name"]


def test_tenant_path_resolution():
    """Verify default user flat layout matching Technical_System_Architecture.md and custom tenant isolation."""
    # 1. Default user should use clean top-level data/ paths
    default_paths = ensure_tenant_directories(settings.default_user_id)
    assert default_paths["vault"] == settings.data_dir / "vault"
    assert default_paths["sqlite_db"] == settings.data_dir / "sqlite" / "scribex.db"
    assert default_paths["lancedb"] == settings.data_dir / "lancedb"

    # 2. Custom tenant should be isolated under data/tenants/
    test_user = "test_user_42"
    paths = ensure_tenant_directories(test_user)

    assert paths["base_root"].exists()
    assert paths["vault"].exists()
    assert paths["sqlite_dir"].exists()
    assert paths["lancedb"].exists()

    assert paths["vault"] == get_vault_path(test_user)
    assert paths["sqlite_db"] == get_sqlite_path(test_user)
    assert paths["lancedb"] == get_lancedb_path(test_user)

    # Clean up test user directory
    if paths["base_root"].exists() and "test_user_42" in str(paths["base_root"]):
        shutil.rmtree(paths["base_root"])


@pytest.mark.asyncio
async def test_user_id_dependency():
    """Verify get_current_user_id resolves default and custom user headers."""
    # Default case
    user_id = await get_current_user_id(x_user_id=None, authorization=None)
    assert user_id == settings.default_user_id

    # Header override case
    custom_user = "custom_tenant_99"
    user_id = await get_current_user_id(x_user_id=custom_user, authorization=None)
    assert user_id == custom_user
