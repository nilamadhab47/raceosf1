"""F1 Intelligence Studio — FastAPI Backend."""

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional

from config import settings
from f1_data import (
    load_session,
    get_session_info,
    get_drivers,
    get_laps,
    get_telemetry,
    get_race_leaderboard,
    get_weather,
    get_track_map,
    get_driver_positions_at_lap,
    get_race_control_at_lap,
    get_stints,
    get_gap_evolution,
)
from insights import insight_engine
from strategy import simulate_strategy
from simulation import race_simulator
from voice import synthesize_speech
from ws import manager, start_live_broadcast, stop_live_broadcast
from ai_insights import generate_ai_insights, chat_with_ai
import live_pulse
from live_pulse import rate_limiter
import openf1_client
import database as db
import data_sync

app = FastAPI(
    title="F1 Intelligence Studio API",
    version="2.0.0",
    description="AI-powered F1 race insights backend with real-time WebSocket pipeline",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Initialize database and start background sync."""
    await db.get_db()
    # Start background sync every 5 minutes
    data_sync.start_background_sync(interval_seconds=300)


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up on shutdown."""
    data_sync.stop_background_sync()
    await db.close_db()


# ─── State ───────────────────────────────────────────────────────────
_current_session = None
_current_year = 2024
_current_gp = "Bahrain"
_current_session_type = "R"
_mode = "simulation"  # "simulation" | "live"


def _get_session():
    global _current_session
    if _current_session is None:
        _current_session = load_session(_current_year, _current_gp, _current_session_type)
    return _current_session


# ─── Session Endpoints ───────────────────────────────────────────────

@app.get("/api/session")
def api_session_info():
    """Get current session info."""
    session = _get_session()
    return get_session_info(session)


@app.post("/api/session/load")
def api_load_session(
    year: int = Query(default=2024),
    gp: str = Query(default="Bahrain"),
    session_type: str = Query(default="R"),
):
    """Load a different session."""
    global _current_session, _current_year, _current_gp, _current_session_type
    try:
        _current_session = load_session(year, gp, session_type)
        _current_year = year
        _current_gp = gp
        _current_session_type = session_type
        return get_session_info(_current_session)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── Driver Endpoints ────────────────────────────────────────────────

@app.get("/api/drivers")
def api_drivers():
    """Get list of drivers."""
    session = _get_session()
    return get_drivers(session)


# ─── Lap Endpoints ───────────────────────────────────────────────────

@app.get("/api/laps")
def api_laps(driver: Optional[str] = Query(default=None)):
    """Get lap data, optionally filtered by driver abbreviation."""
    session = _get_session()
    return get_laps(session, driver)


# ─── Telemetry Endpoints ─────────────────────────────────────────────

@app.get("/api/telemetry")
def api_telemetry(
    driver: str = Query(..., description="Driver abbreviation (e.g., VER)"),
    lap: int = Query(..., description="Lap number"),
):
    """Get telemetry data for a specific driver and lap."""
    session = _get_session()
    result = get_telemetry(session, driver, lap)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


# ─── Leaderboard Endpoint ────────────────────────────────────────────

@app.get("/api/leaderboard")
def api_leaderboard(lap: Optional[int] = Query(default=None)):
    """Get race leaderboard at a given lap."""
    session = _get_session()
    return get_race_leaderboard(session, lap)


# ─── Track Map Endpoints ─────────────────────────────────────────────

@app.get("/api/track-map")
def api_track_map():
    """Get circuit outline coordinates for track map rendering."""
    session = _get_session()
    result = get_track_map(session)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@app.get("/api/driver-positions")
def api_driver_positions(lap: int = Query(..., description="Lap number")):
    """Get driver X/Y positions at a specific lap."""
    session = _get_session()
    return get_driver_positions_at_lap(session, lap)


# ─── Race Control Endpoint ───────────────────────────────────────────

@app.get("/api/race-control")
def api_race_control(lap: Optional[int] = Query(default=None)):
    """Get race control messages and current flag mode at a given lap."""
    session = _get_session()
    target_lap = lap if lap else (session.laps["LapNumber"].max() if not session.laps.empty else 1)
    flag_mode, messages = get_race_control_at_lap(session, int(target_lap))
    return {"flag": flag_mode, "race_control": messages}


# ─── Stints Endpoint ─────────────────────────────────────────────────

@app.get("/api/stints")
def api_stints():
    """Get tyre stint summaries for all drivers."""
    session = _get_session()
    return get_stints(session)


# ─── Gap Evolution Endpoint ──────────────────────────────────────────

@app.get("/api/gap-evolution")
def api_gap_evolution(top_n: int = Query(default=5, ge=2, le=10)):
    """Get gap-to-leader evolution for top N drivers across all laps."""
    session = _get_session()
    return get_gap_evolution(session, top_n=top_n)


# ─── Weather Endpoint ────────────────────────────────────────────────

@app.get("/api/weather")
def api_weather():
    """Get weather data for the session."""
    session = _get_session()
    return get_weather(session)


# ─── Insights Endpoint ───────────────────────────────────────────────

@app.get("/api/insights")
def api_insights(lap: Optional[int] = Query(default=None)):
    """Get AI-generated insights for the race at a given lap."""
    session = _get_session()
    return insight_engine.generate(session, lap)


# ─── AI-Enhanced Insights & Chat ─────────────────────────────────────

@app.get("/api/ai/insights")
async def api_ai_insights(lap: Optional[int] = Query(default=None)):
    """Get Claude-enhanced insights (rule-based + AI analysis)."""
    session = _get_session()
    rule_insights = insight_engine.generate(session, lap)
    return await generate_ai_insights(session, lap, rule_insights)


class ChatRequest(BaseModel):
    question: str
    history: Optional[list[dict]] = None


@app.post("/api/ai/chat")
async def api_ai_chat(req: ChatRequest, lap: Optional[int] = Query(default=None)):
    """Interactive AI chat about the current race."""
    session = _get_session()
    reply = await chat_with_ai(req.question, session, lap, req.history)
    return {"reply": reply}


# ─── YouTube Highlights Search ────────────────────────────────────────

from youtube_search import search_highlights, get_stream_url

@app.get("/api/highlights/search")
async def api_highlights_search(year: int = Query(...), gp: str = Query(...)):
    """Search YouTube for F1 race highlights (yt-dlp → Anthropic fallback)."""
    results = await search_highlights(year, gp)
    return {"results": results}


@app.get("/api/highlights/stream")
async def api_highlights_stream(v: str = Query(..., min_length=11, max_length=11)):
    """Proxy a YouTube video stream. Returns a redirect to the direct CDN URL."""
    import re
    from fastapi.responses import RedirectResponse

    # Validate video ID format (alphanumeric + dash + underscore only)
    if not re.match(r'^[a-zA-Z0-9_-]{11}$', v):
        return JSONResponse({"error": "Invalid video ID"}, status_code=400)

    url = await get_stream_url(v)
    if not url:
        return JSONResponse({"error": "Could not extract stream"}, status_code=502)

    # Redirect client directly to the CDN URL (saves backend bandwidth)
    return RedirectResponse(url=url, status_code=302)


# ─── Strategy Simulator ──────────────────────────────────────────────

class StrategyRequest(BaseModel):
    driver: str
    pit_lap: int
    compound: str = "MEDIUM"


@app.post("/api/simulate-strategy")
def api_simulate_strategy(req: StrategyRequest):
    """Simulate a pit stop strategy."""
    session = _get_session()
    result = simulate_strategy(session, req.driver, req.pit_lap, req.compound)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# ─── Live Simulation ─────────────────────────────────────────────────

@app.get("/api/live")
def api_live():
    """Get current simulated race state."""
    return race_simulator.get_state()


@app.post("/api/live/start")
async def api_live_start(speed: float = Query(default=3.0)):
    """Start race simulation and begin WebSocket broadcast."""
    session = _get_session()
    total_laps = int(session.laps["LapNumber"].max())
    race_simulator.start(total_laps, speed, _current_year, _current_gp)
    await start_live_broadcast(lambda: _get_session(), race_simulator, insight_engine)
    return race_simulator.get_state()


@app.post("/api/live/stop")
async def api_live_stop():
    """Stop race simulation and broadcast."""
    race_simulator.stop()
    await stop_live_broadcast()
    return race_simulator.get_state()


@app.post("/api/live/reset")
def api_live_reset():
    """Reset race simulation."""
    race_simulator.reset()
    return race_simulator.get_state()


# ─── Voice Endpoint ──────────────────────────────────────────────────

class VoiceRequest(BaseModel):
    text: str


@app.post("/api/voice/synthesize")
async def api_voice_synthesize(req: VoiceRequest):
    """Convert text to speech via ElevenLabs."""
    audio = await synthesize_speech(req.text)
    if audio is None:
        raise HTTPException(
            status_code=503,
            detail="Voice synthesis unavailable. Set ELEVENLABS_API_KEY in .env",
        )
    return Response(content=audio, media_type="audio/mpeg")


# ─── Available Sessions ──────────────────────────────────────────────

@app.get("/api/available-sessions")
def api_available_sessions():
    """Return a curated list of interesting sessions to explore."""
    return [
        # 2026 Season (fetched via RapidAPI/OpenF1 → DB)
        {"year": 2026, "gp": "Australia", "name": "2026 Australian Grand Prix"},
        {"year": 2026, "gp": "China", "name": "2026 Chinese Grand Prix"},
        {"year": 2026, "gp": "Bahrain", "name": "2026 Bahrain Grand Prix"},
        {"year": 2026, "gp": "Saudi Arabia", "name": "2026 Saudi Arabian Grand Prix"},
        # 2025 Season
        {"year": 2025, "gp": "Australia", "name": "2025 Australian Grand Prix"},
        {"year": 2025, "gp": "China", "name": "2025 Chinese Grand Prix"},
        {"year": 2025, "gp": "Japan", "name": "2025 Japanese Grand Prix"},
        {"year": 2025, "gp": "Bahrain", "name": "2025 Bahrain Grand Prix"},
        {"year": 2025, "gp": "Saudi Arabia", "name": "2025 Saudi Arabian Grand Prix"},
        {"year": 2025, "gp": "Miami", "name": "2025 Miami Grand Prix"},
        {"year": 2025, "gp": "Emilia Romagna", "name": "2025 Emilia Romagna Grand Prix"},
        {"year": 2025, "gp": "Monaco", "name": "2025 Monaco Grand Prix"},
        {"year": 2025, "gp": "Spain", "name": "2025 Spanish Grand Prix"},
        {"year": 2025, "gp": "Canada", "name": "2025 Canadian Grand Prix"},
        {"year": 2025, "gp": "Austria", "name": "2025 Austrian Grand Prix"},
        {"year": 2025, "gp": "Great Britain", "name": "2025 British Grand Prix"},
        {"year": 2025, "gp": "Hungary", "name": "2025 Hungarian Grand Prix"},
        {"year": 2025, "gp": "Belgium", "name": "2025 Belgian Grand Prix"},
        {"year": 2025, "gp": "Netherlands", "name": "2025 Dutch Grand Prix"},
        {"year": 2025, "gp": "Italy", "name": "2025 Italian Grand Prix"},
        {"year": 2025, "gp": "Azerbaijan", "name": "2025 Azerbaijan Grand Prix"},
        {"year": 2025, "gp": "Singapore", "name": "2025 Singapore Grand Prix"},
        {"year": 2025, "gp": "United States", "name": "2025 United States Grand Prix"},
        {"year": 2025, "gp": "Mexico", "name": "2025 Mexico City Grand Prix"},
        {"year": 2025, "gp": "Brazil", "name": "2025 São Paulo Grand Prix"},
        {"year": 2025, "gp": "Las Vegas", "name": "2025 Las Vegas Grand Prix"},
        {"year": 2025, "gp": "Qatar", "name": "2025 Qatar Grand Prix"},
        {"year": 2025, "gp": "Abu Dhabi", "name": "2025 Abu Dhabi Grand Prix"},
        # 2024 Season  
        {"year": 2024, "gp": "Bahrain", "name": "2024 Bahrain Grand Prix"},
        {"year": 2024, "gp": "Saudi Arabia", "name": "2024 Saudi Arabian Grand Prix"},
        {"year": 2024, "gp": "Japan", "name": "2024 Japanese Grand Prix"},
        {"year": 2024, "gp": "Monaco", "name": "2024 Monaco Grand Prix"},
        {"year": 2024, "gp": "Canada", "name": "2024 Canadian Grand Prix"},
        {"year": 2024, "gp": "Spain", "name": "2024 Spanish Grand Prix"},
        {"year": 2024, "gp": "Great Britain", "name": "2024 British Grand Prix"},
        {"year": 2024, "gp": "Hungary", "name": "2024 Hungarian Grand Prix"},
        {"year": 2024, "gp": "Italy", "name": "2024 Italian Grand Prix"},
        {"year": 2024, "gp": "Singapore", "name": "2024 Singapore Grand Prix"},
        {"year": 2024, "gp": "Abu Dhabi", "name": "2024 Abu Dhabi Grand Prix"},
    ]


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ─── Database-backed Endpoints ────────────────────────────────────────

@app.post("/api/db/sync-session")
async def api_db_sync_session(
    year: int = Query(default=2026),
    gp: str = Query(..., description="Grand Prix name e.g. 'Bahrain'"),
):
    """Fetch race data from APIs and store in database."""
    session_id = await data_sync.fetch_and_store_session(year, gp)
    if session_id is None:
        raise HTTPException(status_code=500, detail="Failed to sync session data")
    return {"session_id": session_id, "status": "synced"}


@app.post("/api/db/sync-season")
async def api_db_sync_season(year: int = Query(default=2026)):
    """Sync all available race sessions for an entire season (with timeout)."""
    import asyncio
    try:
        count = await asyncio.wait_for(data_sync.sync_season(year), timeout=30)
        return {"year": year, "sessions_synced": count}
    except asyncio.TimeoutError:
        return {"year": year, "sessions_synced": 0, "status": "timeout", "message": "Sync taking too long — try syncing individual sessions"}


@app.post("/api/db/sync-latest")
async def api_db_sync_latest():
    """Sync the most recent session (with timeout)."""
    import asyncio
    try:
        session_id = await asyncio.wait_for(data_sync.sync_latest(), timeout=30)
        return {"session_id": session_id, "status": "synced" if session_id else "no data"}
    except asyncio.TimeoutError:
        return {"session_id": None, "status": "timeout", "message": "Sync timed out"}


@app.get("/api/db/sessions")
async def api_db_sessions(year: Optional[int] = Query(default=None)):
    """Get all stored sessions from the database."""
    sessions = await db.get_all_sessions(year)
    return sessions


@app.get("/api/db/session/{session_id}/drivers")
async def api_db_drivers(session_id: int):
    """Get drivers for a stored session."""
    return await db.get_drivers_for_session(session_id)


@app.get("/api/db/session/{session_id}/leaderboard")
async def api_db_leaderboard(session_id: int, lap: int = Query(default=0)):
    """Get leaderboard at a specific lap from stored data."""
    return await db.get_leaderboard_at_lap(session_id, lap)


@app.get("/api/db/session/{session_id}/laps")
async def api_db_laps(session_id: int, driver: Optional[str] = Query(default=None)):
    """Get lap times from stored data."""
    if driver:
        return await db.get_laps_for_driver(session_id, driver)
    return await db.get_all_laps(session_id)


@app.get("/api/db/session/{session_id}/stints")
async def api_db_stints(session_id: int):
    """Get stints from stored data."""
    return await db.get_stints_for_session(session_id)


@app.get("/api/db/session/{session_id}/race-control")
async def api_db_race_control(session_id: int, lap: Optional[int] = Query(default=None)):
    """Get race control messages from stored data."""
    return await db.get_race_control_for_session(session_id, lap)


@app.get("/api/db/session/{session_id}/weather")
async def api_db_weather(session_id: int):
    """Get weather data from stored data."""
    return await db.get_weather_for_session(session_id)


@app.get("/api/db/session/{session_id}/pit-stops")
async def api_db_pit_stops(session_id: int):
    """Get pit stops from stored data."""
    return await db.get_pit_stops_for_session(session_id)


@app.get("/api/db/has-data")
async def api_db_has_data(
    year: int = Query(...), gp: str = Query(...),
):
    """Check if we have data for a specific session."""
    has = await db.session_has_data(year, gp)
    return {"has_data": has, "year": year, "gp": gp}


# ─── Mode & Rate Limit ───────────────────────────────────────────────

@app.get("/api/mode")
def api_get_mode():
    """Get current data mode."""
    return {"mode": _mode, "live_available": live_pulse.is_enabled()}


@app.post("/api/mode")
def api_set_mode(mode: str = Query(..., pattern="^(simulation|live)$")):
    """Switch between simulation and live data mode."""
    global _mode
    if mode == "live" and not live_pulse.is_enabled():
        raise HTTPException(
            status_code=400,
            detail="Live mode unavailable — set RAPIDAPI_KEY and LIVE_MODE_ENABLED=true",
        )
    _mode = mode
    return {"mode": _mode}


@app.get("/api/rate-limit")
def api_rate_limit():
    """Current API rate limit status."""
    return rate_limiter.status


# ─── Live Pulse Data ─────────────────────────────────────────────────

@app.get("/api/live-pulse/timing")
async def api_live_timing():
    """Fetch real-time timing data from F1 Live Pulse API."""
    data = await live_pulse.get_live_timing()
    if data is None:
        raise HTTPException(status_code=503, detail="Live data unavailable")
    return data


@app.get("/api/live-pulse/positions")
async def api_live_positions():
    """Fetch real-time driver positions from F1 Live Pulse API."""
    data = await live_pulse.get_live_positions()
    if data is None:
        raise HTTPException(status_code=503, detail="Live data unavailable")
    return data


@app.get("/api/live-pulse/race-control")
async def api_live_race_control():
    """Fetch race control messages from F1 Live Pulse API."""
    data = await live_pulse.get_race_control_messages()
    if data is None:
        raise HTTPException(status_code=503, detail="Live data unavailable")
    return data


@app.get("/api/live-pulse/weather")
async def api_live_weather():
    """Fetch live weather data from F1 Live Pulse API."""
    data = await live_pulse.get_weather_data()
    if data is None:
        raise HTTPException(status_code=503, detail="Live data unavailable")
    return data


@app.get("/api/live-pulse/pit-stops")
async def api_live_pit_stops():
    """Fetch pit stop events from F1 Live Pulse API."""
    data = await live_pulse.get_pit_stops()
    if data is None:
        raise HTTPException(status_code=503, detail="Live data unavailable")
    return data


@app.get("/api/live-pulse/team-radio")
async def api_live_team_radio():
    """Fetch team radio messages from F1 Live Pulse API."""
    data = await live_pulse.get_team_radio()
    if data is None:
        raise HTTPException(status_code=503, detail="Live data unavailable")
    return data


# ─── OpenF1 Free API Endpoints ────────────────────────────────────────

@app.get("/api/openf1/sessions")
async def api_openf1_sessions(year: int = Query(default=2025)):
    """Get available sessions from OpenF1 (free, no API key needed)."""
    try:
        return await openf1_client.get_available_sessions_by_year(year)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"OpenF1 API error: {e}")


@app.get("/api/openf1/latest-session")
async def api_openf1_latest():
    """Get the most recent F1 session from OpenF1."""
    try:
        return await openf1_client.get_latest_session()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"OpenF1 API error: {e}")


@app.get("/api/openf1/drivers")
async def api_openf1_drivers(session_key: str = Query(default="latest")):
    """Get drivers from OpenF1."""
    try:
        sk = int(session_key) if session_key != "latest" else "latest"
        return await openf1_client.get_drivers(sk)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"OpenF1 API error: {e}")


@app.get("/api/openf1/positions")
async def api_openf1_positions(session_key: str = Query(default="latest")):
    """Get position rankings from OpenF1."""
    try:
        sk = int(session_key) if session_key != "latest" else "latest"
        return await openf1_client.get_position(sk)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"OpenF1 API error: {e}")


@app.get("/api/openf1/laps")
async def api_openf1_laps(
    session_key: str = Query(default="latest"),
    driver_number: Optional[int] = Query(default=None),
):
    """Get lap data from OpenF1."""
    try:
        sk = int(session_key) if session_key != "latest" else "latest"
        return await openf1_client.get_laps(sk, driver_number)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"OpenF1 API error: {e}")


@app.get("/api/openf1/race-control")
async def api_openf1_race_control(session_key: str = Query(default="latest")):
    """Get race control messages from OpenF1."""
    try:
        sk = int(session_key) if session_key != "latest" else "latest"
        return await openf1_client.get_race_control(sk)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"OpenF1 API error: {e}")


@app.get("/api/openf1/weather")
async def api_openf1_weather(session_key: str = Query(default="latest")):
    """Get weather data from OpenF1."""
    try:
        sk = int(session_key) if session_key != "latest" else "latest"
        return await openf1_client.get_weather(sk)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"OpenF1 API error: {e}")


@app.get("/api/openf1/intervals")
async def api_openf1_intervals(session_key: str = Query(default="latest")):
    """Get interval/gap data from OpenF1."""
    try:
        sk = int(session_key) if session_key != "latest" else "latest"
        return await openf1_client.get_intervals(sk)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"OpenF1 API error: {e}")


@app.get("/api/openf1/team-radio")
async def api_openf1_team_radio(
    session_key: str = Query(default="latest"),
    driver_number: Optional[int] = Query(default=None),
):
    """Get team radio metadata from OpenF1."""
    try:
        sk = int(session_key) if session_key != "latest" else "latest"
        return await openf1_client.get_team_radio(sk, driver_number)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"OpenF1 API error: {e}")


# ─── WebSocket Endpoint ──────────────────────────────────────────────

@app.websocket("/ws/race")
async def ws_race(ws: WebSocket):
    """Real-time race data stream.

    Client can send JSON commands:
      {"action": "get_lap", "lap": 10}  — request data for a specific lap
      {"action": "subscribe"}           — subscribe to live broadcast
    """
    await manager.connect(ws)
    try:
        # Send initial state on connect
        state = race_simulator.get_state()
        await manager.send_personal(ws, {"type": "connected", "live": state})

        while True:
            data = await ws.receive_json()
            action = data.get("action")

            if action == "get_lap":
                lap = data.get("lap")
                session = _get_session()
                if session and lap:
                    leaderboard = get_race_leaderboard(session, lap)
                    positions = get_driver_positions_at_lap(session, lap)
                    insights = insight_engine.generate(session, lap)
                    await manager.send_personal(ws, {
                        "type": "race_update",
                        "lap": lap,
                        "leaderboard": leaderboard,
                        "positions": positions,
                        "insights": insights,
                    })

            elif action == "subscribe":
                await manager.send_personal(ws, {
                    "type": "subscribed",
                    "live": race_simulator.get_state(),
                })

    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception:
        manager.disconnect(ws)
