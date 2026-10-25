"""Real-Time Multi-Device WebSocket Doorbell & Sync Endpoint.

Provides:
1. In-memory connection manager tracking active client connections per user_id.
2. Lightweight doorbell broadcast trigger: emits {"type": "SYNC_PING", "latest_sync_rev": N}
   in < 20ms whenever any note or entity is mutated.
3. Bidirectional reconnection handshake to stream missing deltas upon wake-up.
"""

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.core.config import settings
from app.storage.sqlite_db import get_current_sync_rev, get_deltas_since

logger = logging.getLogger("scribex.sync_ws")

router = APIRouter(tags=["Sync WebSocket"])


class SyncConnectionManager:
    """Manages active WebSocket client connections isolated by user/tenant."""

    def __init__(self) -> None:
        # Maps user_id -> set of active WebSocket connections
        self._active_connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, websocket: WebSocket, user_id: str) -> None:
        """Accept and register a new client connection."""
        await websocket.accept()
        self._active_connections[user_id].add(websocket)
        logger.info(
            f"WebSocket client connected for user '{user_id}'. "
            f"Total active for user: {len(self._active_connections[user_id])}"
        )

    def disconnect(self, websocket: WebSocket, user_id: str) -> None:
        """Unregister a client connection."""
        if user_id in self._active_connections:
            self._active_connections[user_id].discard(websocket)
            if not self._active_connections[user_id]:
                del self._active_connections[user_id]
        logger.info(
            f"WebSocket client disconnected for user '{user_id}'. "
            f"Remaining active: {len(self._active_connections.get(user_id, set()))}"
        )

    async def broadcast_ping(
        self,
        user_id: str,
        latest_sync_rev: int,
        exclude_ws: WebSocket | None = None,
    ) -> int:
        """Broadcast an instant lightweight doorbell ping to all active devices of a user.

        Returns the number of clients successfully notified.
        Payload size is minimal (< 100 bytes) to guarantee < 20ms delivery.
        """
        connections = list(self._active_connections.get(user_id, set()))
        if not connections:
            return 0

        payload = {
            "type": "SYNC_PING",
            "latest_sync_rev": latest_sync_rev,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        raw_message = json.dumps(payload)

        notified_count = 0
        dead_connections: list[WebSocket] = []

        for ws in connections:
            if ws is exclude_ws:
                continue
            try:
                await ws.send_text(raw_message)
                notified_count += 1
            except Exception as e:
                logger.warning(f"Failed to send SYNC_PING to client for user '{user_id}': {e}")
                dead_connections.append(ws)

        for dead_ws in dead_connections:
            self.disconnect(dead_ws, user_id)

        return notified_count

    def get_active_count(self, user_id: str) -> int:
        """Return the number of active socket connections for a user."""
        return len(self._active_connections.get(user_id, set()))


# Global in-memory connection manager instance
ws_manager = SyncConnectionManager()


async def handle_sync_websocket(
    websocket: WebSocket,
    user_id: str,
) -> None:
    """Core WebSocket event loop handling connections, handshakes, and doorbells."""
    await ws_manager.connect(websocket, user_id)

    try:
        # Send initial connection confirmation with current sync_rev
        current_rev = await get_current_sync_rev(user_id)
        await websocket.send_json({
            "type": "CONNECTED",
            "user_id": user_id,
            "current_sync_rev": current_rev,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "ERROR", "message": "Invalid JSON format"})
                continue

            msg_type = message.get("type", "").upper()

            if msg_type == "PING":
                await websocket.send_json({
                    "type": "PONG",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })

            elif msg_type == "HANDSHAKE":
                # Reconnection catch-up handshake: client sends since_rev
                since_rev = int(message.get("since_rev", 0))
                current_rev = await get_current_sync_rev(user_id)
                deltas = await get_deltas_since(user_id, since_rev)

                await websocket.send_json({
                    "type": "HANDSHAKE_ACK",
                    "since_rev": since_rev,
                    "current_sync_rev": current_rev,
                    "delta_count": len(deltas),
                    "deltas": deltas,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })

            else:
                await websocket.send_json({
                    "type": "ACK",
                    "received_type": msg_type,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id)
    except Exception as e:
        logger.error(f"Unexpected error in WebSocket loop for user '{user_id}': {e}", exc_info=True)
        ws_manager.disconnect(websocket, user_id)


@router.websocket("/ws/sync")
async def websocket_sync_endpoint(
    websocket: WebSocket,
    user_id: str = Query(default=settings.default_user_id),
) -> None:
    """WebSocket sync doorbell endpoint at /ws/sync."""
    await handle_sync_websocket(websocket, user_id)


@router.websocket("/api/v1/ws/sync")
async def websocket_sync_api_v1_endpoint(
    websocket: WebSocket,
    user_id: str = Query(default=settings.default_user_id),
) -> None:
    """WebSocket sync doorbell endpoint alias at /api/v1/ws/sync."""
    await handle_sync_websocket(websocket, user_id)
