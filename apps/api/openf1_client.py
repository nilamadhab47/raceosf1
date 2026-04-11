"""OpenF1 API client — free, no API key required.

Docs: https://openf1.org

Provides real-time and historical F1 data including:
- Driver positions (location telemetry)
- Timing data 
- Session info
- Race control messages
- Team radio metadata
- Weather
- Car data (speed, throttle, brake, DRS)
"""

import asyncio
import logging

import httpx
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)

BASE_URL = "https://api.openf1.org/v1"

_client: httpx.AsyncClient | None = None

# Simple rate limiter: minimum seconds between requests
_MIN_INTERVAL = 1.0
_last_request_time: float = 0.0
_lock = asyncio.Lock()

MAX_RETRIES = 3
RETRY_BACKOFF = [2, 5, 15]  # seconds to wait after each 429


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(base_url=BASE_URL, timeout=30.0)
    return _client


async def _throttled_get(path: str, params: dict | None = None) -> list | dict:
    """GET with rate-throttling and retry on 429."""
    import time
    global _last_request_time

    for attempt in range(MAX_RETRIES + 1):
        # Throttle: ensure minimum interval between requests
        async with _lock:
            now = time.monotonic()
            wait = _MIN_INTERVAL - (now - _last_request_time)
            if wait > 0:
                await asyncio.sleep(wait)
            _last_request_time = time.monotonic()

        r = await _get_client().get(path, params=params or {})
        if r.status_code == 429:
            if attempt < MAX_RETRIES:
                delay = RETRY_BACKOFF[attempt]
                logger.warning("OpenF1 429 on %s — retrying in %ds (attempt %d/%d)",
                               path, delay, attempt + 1, MAX_RETRIES)
                await asyncio.sleep(delay)
                continue
            else:
                logger.error("OpenF1 429 on %s — exhausted retries", path)
                r.raise_for_status()
        # 404 means no data for this resource (e.g. future session)
        if r.status_code == 404:
            return []
        r.raise_for_status()
        return r.json()

    return []  # unreachable but keeps type checker happy


async def get_sessions(year: Optional[int] = None, country: Optional[str] = None):
    """Get F1 sessions. Filter by year and/or country."""
    params = {}
    if year:
        params["year"] = year
    if country:
        params["country_name"] = country
    return await _throttled_get("/sessions", params)


async def get_latest_session():
    """Get the most recent session."""
    data = await _throttled_get("/sessions", {"session_key": "latest"})
    return data[0] if data else None


async def get_drivers(session_key: int | str = "latest"):
    """Get drivers for a session."""
    return await _throttled_get("/drivers", {"session_key": session_key})


async def get_position(
    session_key: int | str = "latest",
    driver_number: Optional[int] = None,
):
    """Get position data (rankings, not location)."""
    params: dict = {"session_key": session_key}
    if driver_number:
        params["driver_number"] = driver_number
    return await _throttled_get("/position", params)


async def get_location(
    session_key: int | str = "latest",
    driver_number: Optional[int] = None,
):
    """Get car location telemetry (x, y, z coordinates)."""
    params: dict = {"session_key": session_key}
    if driver_number:
        params["driver_number"] = driver_number
    return await _throttled_get("/location", params)


async def get_car_data(
    session_key: int | str = "latest",
    driver_number: Optional[int] = None,
):
    """Get car telemetry (speed, RPM, gear, throttle, brake, DRS)."""
    params: dict = {"session_key": session_key}
    if driver_number:
        params["driver_number"] = driver_number
    return await _throttled_get("/car_data", params)


async def get_laps(
    session_key: int | str = "latest",
    driver_number: Optional[int] = None,
    lap_number: Optional[int] = None,
):
    """Get lap data (lap times, sectors, etc.)."""
    params: dict = {"session_key": session_key}
    if driver_number:
        params["driver_number"] = driver_number
    if lap_number:
        params["lap_number"] = lap_number
    return await _throttled_get("/laps", params)


async def get_stints(
    session_key: int | str = "latest",
    driver_number: Optional[int] = None,
):
    """Get stint data (tyre compound, stint number, laps)."""
    params: dict = {"session_key": session_key}
    if driver_number:
        params["driver_number"] = driver_number
    return await _throttled_get("/stints", params)


async def get_race_control(session_key: int | str = "latest"):
    """Get race control messages (flags, penalties, etc.)."""
    return await _throttled_get("/race_control", {"session_key": session_key})


async def get_team_radio(
    session_key: int | str = "latest",
    driver_number: Optional[int] = None,
):
    """Get team radio recordings metadata."""
    params: dict = {"session_key": session_key}
    if driver_number:
        params["driver_number"] = driver_number
    return await _throttled_get("/team_radio", params)


async def get_weather(session_key: int | str = "latest"):
    """Get weather data for session."""
    return await _throttled_get("/weather", {"session_key": session_key})


async def get_intervals(
    session_key: int | str = "latest",
    driver_number: Optional[int] = None,
):
    """Get interval data (gap to leader and gap to car ahead)."""
    params: dict = {"session_key": session_key}
    if driver_number:
        params["driver_number"] = driver_number
    return await _throttled_get("/intervals", params)


# ─── Convenience / Combined ─────────────────────────────────────────

async def get_available_sessions_by_year(year: int):
    """Get all race sessions for a year, sorted by date."""
    sessions = await get_sessions(year=year)
    # Filter to races only (session_type = 'Race')
    races = [
        s for s in sessions
        if s.get("session_type") == "Race"
    ]
    races.sort(key=lambda s: s.get("date_start", ""))
    return [
        {
            "year": year,
            "gp": s.get("country_name", "Unknown"),
            "name": f"{year} {s.get('meeting_name', s.get('country_name', 'Unknown'))}",
            "session_key": s.get("session_key"),
            "circuit": s.get("circuit_short_name", ""),
            "date": s.get("date_start", ""),
        }
        for s in races
    ]
