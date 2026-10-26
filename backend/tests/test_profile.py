"""Automated Test Suite for Layer 1 Profile API."""

import shutil
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.storage.paths import ensure_tenant_directories
from app.storage.sqlite_db import init_db

TEST_PROFILE_USER = "test_profile_user"


@pytest.fixture(autouse=True)
async def setup_and_teardown_profile():
    paths = ensure_tenant_directories(TEST_PROFILE_USER)
    await init_db(TEST_PROFILE_USER)
    yield
    if paths["base_root"].exists() and TEST_PROFILE_USER in str(paths["base_root"]):
        shutil.rmtree(paths["base_root"])


@pytest.mark.asyncio
async def test_get_and_update_profile_lifecycle():
    transport = ASGITransport(app=app)
    headers = {"X-User-Id": TEST_PROFILE_USER}

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Get initial default profile
        get_res = await client.get("/api/v1/profile", headers=headers)
        assert get_res.status_code == 200
        data = get_res.json()
        assert "profile" in data
        assert "layer1_prompt" in data
        assert data["profile"]["full_name"] == "User"

        # 2. Update profile with custom goals and mindset
        update_payload = {
            "full_name": "Tony Stark",
            "role_and_mindset": "Visionary Engineer & Builder",
            "short_term_goals": ["Build ScribeX Phase 2", "Optimize offline sync"],
            "core_values": ["Extreme ownership", "Radical focus"],
            "daily_routines": ["Morning coffee and review", "Evening commit sync"],
        }
        put_res = await client.put("/api/v1/profile", json=update_payload, headers=headers)
        assert put_res.status_code == 200
        put_data = put_res.json()

        assert put_data["profile"]["full_name"] == "Tony Stark"
        assert put_data["profile"]["role_and_mindset"] == "Visionary Engineer & Builder"
        assert len(put_data["profile"]["short_term_goals"]) == 2
        assert "Tony Stark" in put_data["layer1_prompt"]

        # 3. Check timeline
        timeline_res = await client.get("/api/v1/profile/timeline", headers=headers)
        assert timeline_res.status_code == 200
        timeline = timeline_res.json()
        assert len(timeline) >= 1
        assert timeline[0]["attribute"] == "role_and_mindset"
        assert timeline[0]["new_value"] == "Visionary Engineer & Builder"
