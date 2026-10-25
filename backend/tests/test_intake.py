"""Automated Test Suite for Step 6: Universal Intake & Ask-Before-Write Gate."""

import pytest
import shutil
from pathlib import Path
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.config import settings
from app.storage.paths import ensure_tenant_directories, get_vault_path
from app.storage.sqlite_db import init_db, get_staging_intake, list_staging_intakes
from app.storage.git_vault import get_vault_repo

TEST_INTAKE_USER = "test_intake_user"


@pytest.fixture(autouse=True)
async def setup_and_teardown_intake():
    """Ensure clean test environment and SQLite database for intake tests."""
    paths = ensure_tenant_directories(TEST_INTAKE_USER)
    await init_db(TEST_INTAKE_USER)
    yield
    if paths["base_root"].exists() and TEST_INTAKE_USER in str(paths["base_root"]):
        shutil.rmtree(paths["base_root"])


@pytest.mark.asyncio
async def test_ambiguous_intake_triggers_ask_before_write_gate():
    """Verify that a vague prompt triggers clarification and does not touch the vault."""
    transport = ASGITransport(app=app)
    headers = {"X-User-Id": TEST_INTAKE_USER}

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Send vague/ambiguous input
        response = await client.post(
            "/api/v1/intake",
            json={"raw_input": "Update the specs", "source_type": "text"},
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Gate must hold the write and ask clarifying questions
        assert data["status"] == "NEEDS_CLARIFICATION"
        assert data["clarity_score"] < 0.85
        assert len(data["clarifying_questions"]) > 0
        assert data["staging_id"] is not None
        assert data["note"] is None

        staging_id = data["staging_id"]

        # Verify record exists in SQLite staging_intake table
        staged = await get_staging_intake(TEST_INTAKE_USER, staging_id)
        assert staged is not None
        assert staged["raw_input"] == "Update the specs"
        assert staged["status"] == "PENDING_CLARIFICATION"

        # Verify Git vault was NOT touched (no notes committed)
        repo = get_vault_repo(TEST_INTAKE_USER)
        commits = list(repo.iter_commits())
        # Only the initial init commit exists
        assert len(commits) == 1


@pytest.mark.asyncio
async def test_resolve_clarification_flow():
    """Verify that answering clarifying questions cleanly completes the atomic write."""
    transport = ASGITransport(app=app)
    headers = {"X-User-Id": TEST_INTAKE_USER}

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Submit ambiguous input
        res1 = await client.post(
            "/api/v1/intake",
            json={"raw_input": "Update it", "source_type": "text"},
            headers=headers,
        )
        assert res1.status_code == 200
        staging_id = res1.json()["staging_id"]

        # 2. Check staging listing endpoint
        res_list = await client.get("/api/v1/intake/staging", headers=headers)
        assert res_list.status_code == 200
        items = res_list.json()
        assert any(i["id"] == staging_id for i in items)

        # 3. Submit detailed clarification
        clarification = "For Project Friday: updated memory layer TTL to 300s and added FTS5 BM25 ranking."
        res2 = await client.post(
            f"/api/v1/intake/{staging_id}/clarify",
            json={"answers": clarification},
            headers=headers,
        )

        assert res2.status_code == 200
        data = res2.json()

        assert data["status"] == "PROCESSED"
        assert data["clarity_score"] >= 0.85
        assert data["note"] is not None
        assert "Friday" in data["note"]["title"] or "Friday" in data["note"]["content_markdown"]

        # Verify staging status is updated to RESOLVED
        staged = await get_staging_intake(TEST_INTAKE_USER, staging_id)
        assert staged["status"] == "RESOLVED"

        # Verify Git vault received the commit
        repo = get_vault_repo(TEST_INTAKE_USER)
        latest_commit = repo.head.commit
        assert "[AI] Intake:" in latest_commit.message


@pytest.mark.asyncio
async def test_unambiguous_intake_direct_processing():
    """Verify that clear, specific input passes the gate and commits atomically."""
    transport = ASGITransport(app=app)
    headers = {"X-User-Id": TEST_INTAKE_USER}

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        clear_input = (
            "Finished client onboarding checklist for Acme Corp:\n"
            "- Verified production API keys\n"
            "- Set up webhook receiver\n"
            "- Delivered credentials to Alice"
        )

        response = await client.post(
            "/api/v1/intake",
            json={"raw_input": clear_input, "source_type": "text"},
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert data["status"] == "PROCESSED"
        assert data["clarity_score"] >= 0.85
        assert data["note"] is not None
        assert "Acme Corp" in data["note"]["title"]
        assert data["note"]["sync_rev"] >= 1

        # Check physical file in Git vault
        vault_path = get_vault_path(TEST_INTAKE_USER)
        note_files = list(vault_path.glob("**/*.md"))
        # Exclude _core files
        user_notes = [f for f in note_files if "_core" not in str(f)]
        assert len(user_notes) >= 1

        # Check author tagging in git commit
        repo = get_vault_repo(TEST_INTAKE_USER)
        assert repo.head.commit.author.name == "ScribeX-AI"


@pytest.mark.asyncio
async def test_file_upload_intake(tmp_path: Path):
    """Verify that uploading a markdown/text file routes cleanly through intake."""
    transport = ASGITransport(app=app)
    headers = {"X-User-Id": TEST_INTAKE_USER}

    # Create dummy upload file
    test_file = tmp_path / "research_summary.md"
    test_file.write_text(
        "# Quantum Computing Telemetry\n\nHigh precision sensor log and calibration metrics.",
        encoding="utf-8",
    )

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with open(test_file, "rb") as f:
            response = await client.post(
                "/api/v1/intake/upload",
                files={"file": ("research_summary.md", f, "text/markdown")},
                headers=headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "PROCESSED"
        assert data["note"] is not None
        assert "Quantum Computing" in data["note"]["title"]
