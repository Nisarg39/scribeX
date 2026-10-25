"""Master End-to-End Integration Test Suite for Phase 1.

Validates the full unified lifecycle of a ScribeX user across all Phase 1 components:
1. Operational SQLite Engine & Schema in WAL mode.
2. Git-Backed Markdown Vault with author attribution.
3. Embedded LanceDB Vector Indexing.
4. Cognitive Memory Engine (Layer 1 Identity & Layer 2 Triple Hybrid Context).
5. Universal Intake Router guarded by the Ask-Before-Write Ambiguity Gate.
6. Multi-turn Conversational Onboarding Interview Flow.
7. Event-sourced Delta Sync Changelog with monotonic sync_rev increments.
"""

import pytest
import shutil
from pathlib import Path
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.storage.paths import ensure_tenant_directories, get_vault_path
from app.storage.sqlite_db import (
    init_db,
    list_notes,
    get_deltas_since,
    get_staging_intake,
    get_connected_edges,
)
from app.storage.git_vault import get_vault_repo
from app.memory.layer1_identity import build_layer1_prompt, load_core_profile, invalidate_layer1_cache
from app.memory.layer2_vault import retrieve_hybrid_context

TEST_E2E_USER = "test_e2e_user"


@pytest.fixture(autouse=True)
async def setup_and_teardown_e2e():
    """Ensure clean test environment and SQLite database for master E2E integration."""
    paths = ensure_tenant_directories(TEST_E2E_USER)
    await init_db(TEST_E2E_USER)
    invalidate_layer1_cache(TEST_E2E_USER)
    yield
    if paths["base_root"].exists() and TEST_E2E_USER in str(paths["base_root"]):
        shutil.rmtree(paths["base_root"])
    invalidate_layer1_cache(TEST_E2E_USER)


@pytest.mark.asyncio
async def test_complete_phase1_user_lifecycle(tmp_path: Path):
    """Execute end-to-end user lifecycle verifying all Phase 1 systems work together."""
    transport = ASGITransport(app=app)
    headers = {"X-User-Id": TEST_E2E_USER}

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # ======================================================================
        # 1. Healthcheck & Baseline API Verification
        # ======================================================================
        health_res = await client.get("/health")
        assert health_res.status_code == 200
        assert health_res.json()["status"] == "healthy"

        root_res = await client.get("/")
        assert root_res.status_code == 200
        assert "ScribeX Core VPS API" in root_res.json()["name"]

        # ======================================================================
        # 2. Interactive Onboarding Interview Flow (6 Pillars)
        # ======================================================================
        # Start onboarding
        start_res = await client.post("/api/v1/onboarding/start", headers=headers)
        assert start_res.status_code == 200
        session_id = start_res.json()["session_id"]

        # Complete all 6 interview turns
        interview_answers = [
            # Pillar 0: Identity
            "My name is Diana Prince. I am a strategic diplomat, researcher, and archivist focused on global peace.",
            # Pillar 1: Career
            "Centuries of diplomatic, antiquities preservation, and defense intelligence leadership.",
            # Pillar 2: Vision
            "Create an open, unified global knowledge archive immune to censorship and decay.",
            # Pillar 3: Active Goals
            "Complete antiquities telemetry digitization, Deploy ScribeX autonomous archivist",
            # Pillar 4: Active Projects
            "Amazonian Artifacts Catalog, Embassy Protocol System",
            # Pillar 5: Daily Routines
            "Morning meditation, archival review, evening training",
        ]

        for ans in interview_answers:
            turn_res = await client.post(
                "/api/v1/onboarding/message",
                json={"session_id": session_id, "message": ans},
                headers=headers,
            )
            assert turn_res.status_code == 200

        # Finalize onboarding
        finalize_res = await client.post(
            "/api/v1/onboarding/finalize",
            json={"session_id": session_id},
            headers=headers,
        )
        assert finalize_res.status_code == 200
        final_data = finalize_res.json()
        assert final_data["status"] == "ONBOARDING_COMPLETED"
        assert "Diana Prince" in final_data["profile"]["full_name"]

        # Verify Layer 1 identity profile in Git vault
        vault_path = get_vault_path(TEST_E2E_USER)
        assert (vault_path / "_core" / "identity.md").exists()
        core_profile = load_core_profile(TEST_E2E_USER)
        assert "Diana Prince" in core_profile.full_name
        assert len(core_profile.short_term_goals) >= 1

        # Verify Layer 1 prompt generation includes Diana Prince and seeded groups
        l1_prompt = await build_layer1_prompt(TEST_E2E_USER)
        assert "Diana Prince" in l1_prompt
        assert "Goals" in l1_prompt or "Projects" in l1_prompt

        # ======================================================================
        # 3. Universal Intake - Ask-Before-Write Ambiguity Gate
        # ======================================================================
        # Ambiguous intake: should trigger clarifying questions
        vague_res = await client.post(
            "/api/v1/intake",
            json={"raw_input": "Update the specs", "source_type": "text"},
            headers=headers,
        )
        assert vague_res.status_code == 200
        vague_data = vague_res.json()
        assert vague_data["status"] == "NEEDS_CLARIFICATION"
        assert vague_data["clarity_score"] < 0.85
        assert len(vague_data["clarifying_questions"]) > 0
        staging_id = vague_data["staging_id"]

        # Verify held in staging
        staged_item = await get_staging_intake(TEST_E2E_USER, staging_id)
        assert staged_item["status"] == "PENDING_CLARIFICATION"

        # Resolve clarification
        clarify_res = await client.post(
            f"/api/v1/intake/{staging_id}/clarify",
            json={"answers": "For the Embassy Protocol System: updated encrypted channel cipher to ChaCha20."},
            headers=headers,
        )
        assert clarify_res.status_code == 200
        clarify_data = clarify_res.json()
        assert clarify_data["status"] == "PROCESSED"
        assert clarify_data["note"] is not None

        # Verify staging status is now RESOLVED
        updated_staged = await get_staging_intake(TEST_E2E_USER, staging_id)
        assert updated_staged["status"] == "RESOLVED"

        # ======================================================================
        # 4. Direct Unambiguous Intake
        # ======================================================================
        direct_res = await client.post(
            "/api/v1/intake",
            json={
                "raw_input": (
                    "Finished Archival Audit for Louvre Antiquities:\n"
                    "- Scanned 45 ancient pottery fragments\n"
                    "- Cross-checked radiometric dating metrics\n"
                    "- Uploaded high-resolution point clouds"
                ),
                "source_type": "text",
            },
            headers=headers,
        )
        assert direct_res.status_code == 200
        direct_data = direct_res.json()
        assert direct_data["status"] == "PROCESSED"
        assert "Louvre Antiquities" in direct_data["note"]["title"]

        # ======================================================================
        # 5. Document Upload Ingestion
        # ======================================================================
        doc_file = tmp_path / "diplomatic_accord.md"
        doc_file.write_text(
            "# Mediterranean Cultural Accords\n\n"
            "**Document ID:** MCA-2026-ARCHIVE\n\n"
            "### 1. Purpose & Scope\n"
            "This treaty outlines archaeological preservation and telemetry cooperation across maritime heritage sites.\n\n"
            "### 2. Operational Terms\n"
            "- All digital scans must maintain 0.1mm accuracy\n"
            "- Artifact metadata is archived into the decentralized repository\n",
            encoding="utf-8",
        )
        with open(doc_file, "rb") as f:
            upload_res = await client.post(
                "/api/v1/intake/upload",
                files={"file": ("diplomatic_accord.md", f, "text/markdown")},
                headers=headers,
            )
        assert upload_res.status_code == 200
        upload_data = upload_res.json()
        assert upload_data["status"] == "PROCESSED"
        assert "Mediterranean Cultural Accords" in upload_data["note"]["title"]

        # ======================================================================
        # 6. Cognitive Memory Engine (Layer 2 Triple Hybrid Context Retrieval)
        # ======================================================================
        hybrid_context = await retrieve_hybrid_context(
            user_id=TEST_E2E_USER,
            query="encrypted channel cipher ChaCha20",
            limit=5,
        )
        assert len(hybrid_context["matched_notes"]) >= 1
        assert "ChaCha20" in hybrid_context["formatted_context"]

        # ======================================================================
        # 7. Operational SQLite & Event-Sourced Delta Sync Changelog
        # ======================================================================
        all_notes = await list_notes(TEST_E2E_USER)
        assert len(all_notes) >= 3

        deltas = await get_deltas_since(TEST_E2E_USER, since_rev=0)
        assert len(deltas) >= 3
        # Monotonically increasing sync revisions
        sync_revs = [d["sync_rev"] for d in deltas]
        assert sync_revs == sorted(sync_revs)
        assert all(isinstance(r, int) for r in sync_revs)

        # ======================================================================
        # 8. Git-Backed Markdown Vault & Author Attribution
        # ======================================================================
        repo = get_vault_repo(TEST_E2E_USER)
        commits = list(repo.iter_commits())
        # All autonomous system operations must be tagged as ScribeX-AI
        assert len(commits) >= 4
        assert commits[0].author.name == "ScribeX-AI"
        assert commits[0].author.email == "ai@assistant.local"

        # Verify physical markdown files exist on disk
        md_files = list(vault_path.glob("**/*.md"))
        assert len(md_files) >= 4
