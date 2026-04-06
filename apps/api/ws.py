"""WebSocket real-time race data pipeline.

Streams leaderboard, driver positions, and insights to connected clients
during live simulation. Also supports on-demand data push for static browsing.
"""

import asyncio
import json
import logging
from typing import Optional

from fastapi import WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages active WebSocket connections and broadcasts."""

    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)
        logger.info("WS client connected (%d total)", len(self.active))

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)
        logger.info("WS client disconnected (%d total)", len(self.active))

    async def broadcast(self, message: dict):
        """Send a JSON message to all connected clients."""
        payload = json.dumps(message)
        stale: list[WebSocket] = []
        for ws in self.active:
            try:
                if ws.client_state == WebSocketState.CONNECTED:
                    await ws.send_text(payload)
            except Exception:
                stale.append(ws)
        for ws in stale:
            self.disconnect(ws)

    async def send_personal(self, ws: WebSocket, message: dict):
        """Send a JSON message to a single client."""
        try:
            if ws.client_state == WebSocketState.CONNECTED:
                await ws.send_text(json.dumps(message))
        except Exception:
            self.disconnect(ws)


manager = ConnectionManager()

# Background task handle for the live broadcast loop
_broadcast_task: Optional[asyncio.Task] = None


async def start_live_broadcast(get_session_fn, race_simulator, insight_engine):
    """Start the background loop that pushes race data every tick."""
    global _broadcast_task
    if _broadcast_task and not _broadcast_task.done():
        return  # Already running

    async def _loop():
        last_lap = -1
        try:
            while race_simulator.is_running:
                state = race_simulator.get_state()
                lap = state["current_lap"]

                # Only push full data when lap changes
                if lap != last_lap:
                    last_lap = lap
                    session = get_session_fn()
                    if session is None:
                        await asyncio.sleep(0.5)
                        continue

                    # Import data functions here to avoid circular imports
                    from f1_data import get_race_leaderboard, get_driver_positions_at_lap, get_race_control_at_lap
                    leaderboard = get_race_leaderboard(session, lap)
                    positions = get_driver_positions_at_lap(session, lap)
                    insights = insight_engine.generate(session, lap)
                    flag_mode, race_control = get_race_control_at_lap(session, lap)

                    await manager.broadcast({
                        "type": "race_update",
                        "lap": lap,
                        "live": state,
                        "leaderboard": leaderboard,
                        "positions": positions,
                        "insights": insights,
                        "flag": flag_mode,
                        "race_control": race_control,
                    })
                else:
                    # Just push live state between lap changes
                    await manager.broadcast({
                        "type": "live_state",
                        "live": state,
                    })

                await asyncio.sleep(0.8)  # ~1.25 updates/sec

        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error("Broadcast loop error: %s", e)
        finally:
            await manager.broadcast({"type": "live_stopped"})

    _broadcast_task = asyncio.create_task(_loop())


async def stop_live_broadcast():
    """Cancel the broadcast loop."""
    global _broadcast_task
    if _broadcast_task and not _broadcast_task.done():
        _broadcast_task.cancel()
        try:
            await _broadcast_task
        except asyncio.CancelledError:
            pass
    _broadcast_task = None
