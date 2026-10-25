"""Automated Test Suite for Step 7: Interactive Onboarding Interview Flow API."""

import pytest
import shutil
from pathlib import Path
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.storage.paths import ensure_tenant_directories, get_vault_path
from app.storage.sqlite_db import init_db, list_notes, get_connected_edges
from app.storage.git_vault import get_vault_repo
from app.memory.layer1_identity import build_layer1_prompt, load_core_profile, invalidate_layer1_cache

TEST_ONBOARDING_USER = "test_onboard_user"


@pytest.fixture(autouse=True)
async def setup_and_teardown_onboarding():
    """Ensure clean test environment and SQLite database for onboarding tests."""
    paths = ensure_tenant_directories(TEST_ONBOARDING_USER)
    await init_db(TEST_ONBOARDING_USER)
    invalidate_layer1_cache(TEST_ONBOARDING_USER)
    yield
    if paths["base_root"].exists() and TEST_ONBOARDING_USER in str(paths["base_root"]):
        shutil.rmtree(paths["base_root"])
    invalidate_layer1_cache(TEST_ONBOARDING_USER)


@pytest.mark.asyncio
async def test_full_onboarding_interview_flow():
    """Verify multi-turn 6-pillar interview synthesis and vault seeding."""
    transport = ASGITransport(app=app)
    headers = {"X-User-Id": TEST_ONBOARDING_USER}

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Start Onboarding Session
        start_res = await client.post("/api/v1/onboarding/start", headers=headers)
        assert start_res.status_code == 200
        start_data = start_res.json()

        session_id = start_data["session_id"]
        assert start_data["current_pillar_index"] == 0
        assert "Welcome to ScribeX" in start_data["question"]
        assert start_data["is_complete"] is False

        # 2. Complete the 6 Pillars sequentially
        turns = [
            # Pillar 0: Personal Identity & Mindset
            "My name is Bruce Wayne. I am an industrialist and systems architect driven by precision and vigilance.",
            # Pillar 1: Career Journey & Milestones
            "Trained across global disciplines, returned to lead Wayne Enterprises R&D into cutting-edge applied technologies.",
            # Pillar 2: Long-Term Life Vision
            "Create an autonomous, resilient security network that safeguards Gotham City for generations.",
            # Pillar 3: Short-Term Active Goals
            "Deploy autonomous surveillance drone, Upgrade Batcave mainframe",
            # Pillar 4: Current Active Projects & Obligations
            "Batmobile Armor Overhaul, Wayne Foundation Clean Tech Initiative",
            # Pillar 5: Daily Checklists & Habits
            "5am tactical training, 8pm patrol briefing, 11pm systems telemetry audit",
        ]

        for idx, user_input in enumerate(turns):
            turn_res = await client.post(
                "/api/v1/onboarding/message",
                json={"session_id": session_id, "message": user_input},
                headers=headers,
            )
            assert turn_res.status_code == 200
            turn_data = turn_res.json()
            assert turn_data["session_id"] == session_id

            if idx < len(turns) - 1:
                assert turn_data["current_pillar_index"] == idx + 1
                assert turn_data["is_complete"] is False
            else:
                # Last pillar should mark complete
                assert turn_data["is_complete"] is True
                assert "covered all 6" in turn_data["question"]

        # 3. Check Session Status endpoint
        status_res = await client.get(f"/api/v1/onboarding/session/{session_id}")
        assert status_res.status_code == 200
        session_state = status_res.json()
        assert session_state["is_complete"] is True
        assert len(session_state["answers"]) == 6

        # 4. Finalize Onboarding
        finalize_res = await client.post(
            "/api/v1/onboarding/finalize",
            json={"session_id": session_id},
            headers=headers,
        )
        assert finalize_res.status_code == 200
        final_data = finalize_res.json()

        assert final_data["status"] == "ONBOARDING_COMPLETED"
        assert final_data["created_notes_count"] >= 2
        assert "Bruce Wayne" in final_data["profile"]["full_name"]

        # 5. Verify _core/identity.md exists in Git vault and parses correctly
        vault_path = get_vault_path(TEST_ONBOARDING_USER)
        identity_md = vault_path / "_core" / "identity.md"
        assert identity_md.exists()

        loaded_profile = load_core_profile(TEST_ONBOARDING_USER)
        assert "Bruce Wayne" in loaded_profile.full_name
        assert len(loaded_profile.short_term_goals) >= 1

        # 6. Verify seed notes in SQLite & Git Vault
        notes = await list_notes(user_id=TEST_ONBOARDING_USER)
        assert len(notes) >= 2
        groups = {n["group_name"] for n in notes}
        assert "Goals" in groups or "Projects" in groups

        # 7. Verify Git commit history and author tagging
        repo = get_vault_repo(TEST_ONBOARDING_USER)
        commits = list(repo.iter_commits())
        # Should have: Init + Identity + Seeded notes commits
        assert len(commits) >= 3
        # Check author of recent commits
        assert commits[0].author.name == "ScribeX-AI"

        # 8. Verify Graph Edge linking Project to Goal
        project_notes = [n for n in notes if n["group_name"] == "Projects"]
        if project_notes:
            edges = await get_connected_edges(TEST_ONBOARDING_USER, project_notes[0]["id"])
            assert len(edges) >= 1
            assert edges[0]["relation_type"] == "SERVES_GOAL"

        # 9. Verify Layer 1 prompt generation includes Bruce Wayne
        prompt = await build_layer1_prompt(TEST_ONBOARDING_USER)
        assert "Bruce Wayne" in prompt
        assert "Goals" in prompt or "Projects" in prompt
