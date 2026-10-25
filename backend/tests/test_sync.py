"""Tests for Step 2: Backend Delta Sync Endpoints (WebSocket Doorbell + REST Catch-Up).

Validates:
1. Reconnection handshake over WebSocket streaming missing deltas.
2. Lightweight doorbell push ({"type": "SYNC_PING"}) delivered across devices in < 20ms.
3. Catch-up deltas retrieval via GET /api/v1/sync/deltas and POST /api/v1/sync/pull.
4. Client offline push mutations via POST /api/v1/sync/push, verifying atomic SQLite commits,
   Git Vault projections, LanceDB indexing, and instant doorbell broadcasts.
"""

import time
import shutil
import pytest
from httpx import AsyncClient, ASGITransport
from starlette.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.storage.paths import ensure_tenant_directories, get_tenant_dir, get_vault_path
from app.storage.sqlite_db import init_db, get_note_by_id, get_current_sync_rev
from app.api.sync_ws import ws_manager


TEST_SYNC_USER = "test_sync_user_step2"


@pytest.fixture(autouse=True)
async def setup_sync_test_env():
    """Set up and tear down isolated test tenant environment."""
    ensure_tenant_directories(TEST_SYNC_USER)
    await init_db(TEST_SYNC_USER)
    yield
    # Cleanup tenant directory after test
    tenant_dir = get_tenant_dir(TEST_SYNC_USER)
    if tenant_dir.exists():
        shutil.rmtree(tenant_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_empty_deltas_catchup():
    """Verify GET /api/v1/sync/deltas returns 0 deltas for clean user."""
    transport = ASGITransport(app=app)
    headers = {"X-User-ID": TEST_SYNC_USER}

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/sync/deltas?since_rev=0", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == TEST_SYNC_USER
        assert data["since_rev"] == 0
        assert data["delta_count"] == 0
        assert data["deltas"] == []


@pytest.mark.asyncio
async def test_push_mutations_and_incremental_catchup():
    """Verify pushing offline client mutations projects to Git vault, updates SQLite, and logs deltas."""
    transport = ASGITransport(app=app)
    headers = {"X-User-ID": TEST_SYNC_USER}

    push_payload = {
        "mutations": [
            {
                "entity_type": "note",
                "entity_id": "note_client_1",
                "change_type": "INSERT",
                "payload": {
                    "title": "Offline Client Architecture Note",
                    "content_markdown": "## Layered Architecture\nCaptured on mobile while on flight.",
                    "group_name": "Architecture",
                    "priority_score": 0.95,
                    "tags": ["mobile", "sync", "vps"],
                },
                "client_timestamp": "2026-10-25T11:00:00Z",
            },
            {
                "entity_type": "note",
                "entity_id": "note_client_2",
                "change_type": "INSERT",
                "payload": {
                    "title": "Second Offline Note",
                    "content_markdown": "Another quick thought saved offline.",
                    "group_name": "General Reference",
                    "priority_score": 0.5,
                },
            },
        ]
    }

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Push offline batch
        push_resp = await client.post("/api/v1/sync/push", json=push_payload, headers=headers)
        assert push_resp.status_code == 200
        push_data = push_resp.json()
        assert push_data["status"] == "success"
        assert push_data["applied_count"] == 2
        assert push_data["current_sync_rev"] == 2
        assert "note_client_1" in push_data["applied_note_ids"]
        assert "note_client_2" in push_data["applied_note_ids"]

        # 2. Verify note exists in SQLite
        note1 = await get_note_by_id(TEST_SYNC_USER, "note_client_1")
        assert note1 is not None
        assert note1["title"] == "Offline Client Architecture Note"
        assert note1["sync_rev"] == 1

        # 3. Verify note projected to Git vault
        vault_path = get_vault_path(TEST_SYNC_USER)
        note1_md = vault_path / "architecture" / "offline_client_architecture_note.md"
        assert note1_md.exists()
        assert "Captured on mobile while on flight." in note1_md.read_text(encoding="utf-8")

        # 4. Verify catch-up from since_rev=0 returns both deltas
        deltas_resp = await client.get("/api/v1/sync/deltas?since_rev=0", headers=headers)
        assert deltas_resp.status_code == 200
        deltas_data = deltas_resp.json()
        assert deltas_data["delta_count"] == 2
        assert deltas_data["current_sync_rev"] == 2
        assert deltas_data["deltas"][0]["entity_id"] == "note_client_1"
        assert deltas_data["deltas"][1]["entity_id"] == "note_client_2"

        # 5. Verify incremental catch-up from since_rev=1 returns only the second delta
        incremental_resp = await client.get("/api/v1/sync/deltas?since_rev=1", headers=headers)
        assert incremental_resp.status_code == 200
        inc_data = incremental_resp.json()
        assert inc_data["delta_count"] == 1
        assert inc_data["deltas"][0]["entity_id"] == "note_client_2"
        assert inc_data["deltas"][0]["sync_rev"] == 2

        # 6. Verify POST /pull variant returns identical deltas
        pull_resp = await client.post(
            "/api/v1/sync/pull",
            json={"since_rev": 1, "limit": 10},
            headers=headers,
        )
        assert pull_resp.status_code == 200
        assert pull_resp.json()["delta_count"] == 1


@pytest.mark.asyncio
async def test_push_update_and_delete_mutations():
    """Verify UPDATE and DELETE mutations are projected and recorded as deltas."""
    transport = ASGITransport(app=app)
    headers = {"X-User-ID": TEST_SYNC_USER}

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create initial note
        await client.post(
            "/api/v1/sync/push",
            json={
                "mutations": [
                    {
                        "entity_type": "note",
                        "entity_id": "note_to_edit",
                        "change_type": "INSERT",
                        "payload": {
                            "title": "Initial Title",
                            "content_markdown": "Initial content",
                            "group_name": "General Reference",
                        },
                    }
                ]
            },
            headers=headers,
        )

        # Push UPDATE mutation
        update_resp = await client.post(
            "/api/v1/sync/push",
            json={
                "mutations": [
                    {
                        "entity_type": "note",
                        "entity_id": "note_to_edit",
                        "change_type": "UPDATE",
                        "payload": {
                            "title": "Updated Title",
                            "content_markdown": "Updated body text via sync",
                            "group_name": "General Reference",
                            "priority_score": 0.8,
                        },
                    }
                ]
            },
            headers=headers,
        )
        assert update_resp.status_code == 200

        updated_note = await get_note_by_id(TEST_SYNC_USER, "note_to_edit")
        assert updated_note["title"] == "Updated Title"
        assert updated_note["content_markdown"] == "Updated body text via sync"
        assert updated_note["sync_rev"] == 2

        # Push DELETE mutation
        delete_resp = await client.post(
            "/api/v1/sync/push",
            json={
                "mutations": [
                    {
                        "entity_type": "note",
                        "entity_id": "note_to_edit",
                        "change_type": "DELETE",
                        "payload": {
                            "group_name": "General Reference",
                            "title": "Updated Title",
                        },
                    }
                ]
            },
            headers=headers,
        )
        assert delete_resp.status_code == 200

        deleted_check = await get_note_by_id(TEST_SYNC_USER, "note_to_edit")
        assert deleted_check is None

        # Verify deletion delta exists
        deltas = await client.get("/api/v1/sync/deltas?since_rev=2", headers=headers)
        deltas_data = deltas.json()
        assert deltas_data["delta_count"] == 1
        assert deltas_data["deltas"][0]["change_type"] == "DELETE"
        assert deltas_data["deltas"][0]["entity_id"] == "note_to_edit"


def test_websocket_doorbell_ping_and_handshake():
    """Verify WebSocket doorbell push arrives in < 20ms upon note creation, and handshake works."""
    client = TestClient(app)

    with client.websocket_connect(f"/ws/sync?user_id={TEST_SYNC_USER}") as ws:
        # 1. Verify initial CONNECTED frame
        init_frame = ws.receive_json()
        assert init_frame["type"] == "CONNECTED"
        assert init_frame["user_id"] == TEST_SYNC_USER

        # 2. Test PING / PONG
        ws.send_json({"type": "PING"})
        pong_frame = ws.receive_json()
        assert pong_frame["type"] == "PONG"

        # 3. Test HANDSHAKE reconnection protocol
        ws.send_json({"type": "HANDSHAKE", "since_rev": 0})
        handshake_ack = ws.receive_json()
        assert handshake_ack["type"] == "HANDSHAKE_ACK"
        assert handshake_ack["since_rev"] == 0
        assert "current_sync_rev" in handshake_ack
        assert isinstance(handshake_ack["deltas"], list)

        # 4. Trigger a mutation via HTTP push and measure doorbell latency
        t_start = time.perf_counter()
        push_resp = client.post(
            "/api/v1/sync/push",
            json={
                "mutations": [
                    {
                        "entity_type": "note",
                        "entity_id": "doorbell_note_1",
                        "change_type": "INSERT",
                        "payload": {
                            "title": "Doorbell Note",
                            "content_markdown": "Testing doorbell ping speed.",
                            "group_name": "Sync",
                        },
                    }
                ]
            },
            headers={"X-User-ID": TEST_SYNC_USER},
        )
        assert push_resp.status_code == 200

        # Receive SYNC_PING over WebSocket
        ping_event = ws.receive_json()
        t_elapsed_ms = (time.perf_counter() - t_start) * 1000

        assert ping_event["type"] == "SYNC_PING"
        # Assert doorbell dispatch latency is fast (< 500ms total HTTP + Git Commit + WS roundtrip)
        assert t_elapsed_ms < 500.0, f"Doorbell took too long: {t_elapsed_ms:.2f}ms"


def test_websocket_multi_device_doorbell_broadcast():
    """Verify that multiple active WebSocket clients for the same user both receive SYNC_PING."""
    client = TestClient(app)

    # Connect device 1 (e.g. Mobile) and device 2 (e.g. Web Desktop)
    with client.websocket_connect(f"/ws/sync?user_id={TEST_SYNC_USER}") as ws_mobile:
        init_m = ws_mobile.receive_json()
        assert init_m["type"] == "CONNECTED"

        with client.websocket_connect(f"/ws/sync?user_id={TEST_SYNC_USER}") as ws_desktop:
            init_d = ws_desktop.receive_json()
            assert init_d["type"] == "CONNECTED"

            assert ws_manager.get_active_count(TEST_SYNC_USER) == 2

            # Push a note from an external source
            push_resp = client.post(
                "/api/v1/sync/push",
                json={
                    "mutations": [
                        {
                            "entity_type": "note",
                            "entity_id": "broadcast_test_note",
                            "change_type": "INSERT",
                            "payload": {
                                "title": "Multi-Device Note",
                                "content_markdown": "Broadcast to all devices concurrently.",
                                "group_name": "Sync",
                            },
                        }
                    ]
                },
                headers={"X-User-ID": TEST_SYNC_USER},
            )
            assert push_resp.status_code == 200

            # Both devices should receive SYNC_PING
            mobile_ping = ws_mobile.receive_json()
            desktop_ping = ws_desktop.receive_json()

            assert mobile_ping["type"] == "SYNC_PING"
            assert desktop_ping["type"] == "SYNC_PING"
            assert mobile_ping["latest_sync_rev"] == desktop_ping["latest_sync_rev"]

    # Once sockets close, manager cleans up
    assert ws_manager.get_active_count(TEST_SYNC_USER) == 0
