"""Automated Test Suite for Step 8: Multi-Modal Asset Pipeline & Ambiguity Gate."""

import hashlib
import io
import shutil
from pathlib import Path
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.storage.paths import ensure_tenant_directories, get_vault_path
from app.storage.sqlite_db import init_db, get_asset_record, get_staging_intake

TEST_ASSET_USER = "test_asset_user"


@pytest.fixture(autouse=True)
async def setup_and_teardown_assets():
    """Ensure clean test environment and SQLite database for asset tests."""
    paths = ensure_tenant_directories(TEST_ASSET_USER)
    await init_db(TEST_ASSET_USER)
    yield
    if paths["base_root"].exists() and TEST_ASSET_USER in str(paths["base_root"]):
        shutil.rmtree(paths["base_root"])


@pytest.mark.asyncio
async def test_upload_text_and_markdown_asset():
    """Verify multipart file upload, storage in vault/_assets/, text extraction, and status."""
    transport = ASGITransport(app=app)
    headers = {"X-User-Id": TEST_ASSET_USER}

    file_content = b"# Architecture Overview\nThis is a test architecture document for ScribeX."
    file_io = io.BytesIO(file_content)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Upload asset
        response = await client.post(
            "/api/v1/assets/upload",
            files={"file": ("architecture.md", file_io, "text/markdown")},
            data={"note_id": "note_123"},
            headers=headers,
        )

        assert response.status_code == 201
        data = response.json()

        assert data["id"].startswith("ast_")
        assert data["file_name"] == "architecture.md"
        assert data["mime_type"] == "text/markdown"
        assert data["size_bytes"] == len(file_content)
        assert data["processing_status"] == "completed"
        assert "Architecture Overview" in (data["extracted_text"] or "")

        asset_id = data["id"]
        storage_key = data["storage_key"]

        # 2. Verify file was saved in tenant's vault/_assets/
        vault_path = get_vault_path(TEST_ASSET_USER)
        disk_file = vault_path / storage_key
        assert disk_file.exists()
        assert disk_file.read_bytes() == file_content

        # 3. Verify SQLite asset record
        record = await get_asset_record(TEST_ASSET_USER, asset_id)
        assert record is not None
        assert record["sha256_hash"] == hashlib.sha256(file_content).hexdigest()

        # 4. Check GET /api/v1/assets/{asset_id}/status
        status_res = await client.get(f"/api/v1/assets/{asset_id}/status", headers=headers)
        assert status_res.status_code == 200
        status_data = status_res.json()
        assert status_data["id"] == asset_id
        assert status_data["processing_status"] == "completed"

        # 5. Check GET /api/v1/assets/{asset_id}/file download
        file_res = await client.get(f"/api/v1/assets/{asset_id}/file", headers=headers)
        assert file_res.status_code == 200
        assert file_res.content == file_content


@pytest.mark.asyncio
async def test_discard_staging_intake():
    """Verify that DELETE /api/v1/intake/{staging_id} removes staged ambiguous input cleanly."""
    transport = ASGITransport(app=app)
    headers = {"X-User-Id": TEST_ASSET_USER}

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Post ambiguous intake to create a staging record
        intake_res = await client.post(
            "/api/v1/intake",
            json={"raw_input": "Change things", "source_type": "text"},
            headers=headers,
        )
        assert intake_res.status_code == 200
        staging_id = intake_res.json()["staging_id"]
        assert staging_id is not None

        # Confirm it exists in SQLite
        staged = await get_staging_intake(TEST_ASSET_USER, staging_id)
        assert staged is not None

        # 2. Discard via DELETE endpoint
        delete_res = await client.delete(f"/api/v1/intake/{staging_id}", headers=headers)
        assert delete_res.status_code == 200
        assert delete_res.json()["status"] == "DISCARDED"

        # Confirm it is marked DISCARDED in SQLite
        staged_after = await get_staging_intake(TEST_ASSET_USER, staging_id)
        assert staged_after is not None
        assert staged_after["status"] == "DISCARDED"


@pytest.mark.asyncio
async def test_upload_image_asset_and_unauthenticated_file_download():
    """Verify that uploading an image does not extract raw binary text, and file download works without auth."""
    transport = ASGITransport(app=app)
    headers = {"X-User-Id": TEST_ASSET_USER}

    fake_png_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00"
    file_io = io.BytesIO(fake_png_content)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Upload image asset
        response = await client.post(
            "/api/v1/assets/upload",
            files={"file": ("screenshot.png", file_io, "image/png")},
            data={"note_id": "note_456"},
            headers=headers,
        )

        assert response.status_code == 201
        data = response.json()

        assert data["id"].startswith("ast_")
        assert data["file_name"] == "screenshot.png"
        assert data["mime_type"] == "image/png"
        assert data["size_bytes"] == len(fake_png_content)
        assert data["processing_status"] == "completed"
        # Must NOT extract raw binary control characters or corrupt strings
        assert data["extracted_text"] is None

        asset_id = data["id"]

        # 2. Check unauthenticated GET /api/v1/assets/{asset_id}/file (simulating browser <img> or RN <Image>)
        no_auth_res = await client.get(f"/api/v1/assets/{asset_id}/file")
        assert no_auth_res.status_code == 200
        assert no_auth_res.content == fake_png_content
        assert "image/png" in no_auth_res.headers.get("content-type", "")
