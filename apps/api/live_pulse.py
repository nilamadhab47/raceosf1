"""F1 Live Pulse API client — RapidAPI integration.

Provides real-time race data from the F1 Live Motorsport Data API on RapidAPI.
All calls go through the shared rate limiter to stay within the free-tier
limit of 18 requests / 60 seconds.

Enable by setting RAPIDAPI_KEY and LIVE_MODE_ENABLED=true in .env.
"""

import os
import logging
from typing import Optional

import httpx

from rate_limiter import RateLimiter

logger = logging.getLogger(__name__)

RAPIDAPI_HOST = "f1-live-motorsport-data.p.rapidapi.com"
BASE_URL = f"https://{RAPIDAPI_HOST}"

# Shared rate limiter — 18 req / 60 s (free tier default)
rate_limiter = RateLimiter(max_requests=18, window_seconds=60.0)


def _headers() -> dict[str, str]:
    key = os.getenv("RAPIDAPI_KEY", "")
    return {
        "x-rapidapi-host": RAPIDAPI_HOST,
        "x-rapidapi-key": key,
    }


def is_enabled() -> bool:
    """Check whether live mode is configured and enabled."""
    return (
        os.getenv("LIVE_MODE_ENABLED", "").lower() in ("true", "1", "yes")
        and bool(os.getenv("RAPIDAPI_KEY", ""))
    )


async def _get(path: str, params: Optional[dict] = None) -> Optional[dict]:
    """Rate-limited GET against the RapidAPI F1 endpoint."""
    if not is_enabled():
        return None

    allowed = await rate_limiter.acquire()
    if not allowed:
        logger.warning("Rate limit exceeded — skipping %s", path)
        return None

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{BASE_URL}{path}",
                headers=_headers(),
                params=params or {},
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        # 403/429 are expected when no live session is active — log at debug level
        if e.response.status_code in (403, 429):
            logger.debug("Live Pulse HTTP %s: %s (no active session?)", e.response.status_code, path)
        else:
            logger.error("Live Pulse HTTP %s: %s", e.response.status_code, path)
        return None
    except Exception as e:
        logger.error("Live Pulse request failed: %s", e)
        return None


# ─── Public API Wrappers ─────────────────────────────────────────────

async def get_live_timing() -> Optional[dict]:
    """Current timing data for all drivers."""
    return await _get("/api/v1/timingData")


async def get_live_positions() -> Optional[dict]:
    """Live driver positions on track."""
    return await _get("/api/v1/position")


async def get_live_drivers() -> Optional[dict]:
    """Driver list for the current session."""
    return await _get("/api/v1/drivers")


async def get_pit_stops() -> Optional[dict]:
    """Pit stop events in the current session."""
    return await _get("/api/v1/pitStops")


async def get_tyre_stints() -> Optional[dict]:
    """Tyre stint data for all drivers."""
    return await _get("/api/v1/tyreStints")


async def get_team_radio() -> Optional[dict]:
    """Recent team radio messages."""
    return await _get("/api/v1/teamRadio")


async def get_race_control_messages() -> Optional[dict]:
    """Official race control messages (flags, penalties, etc.)."""
    return await _get("/api/v1/raceControlMessages")


async def get_weather_data() -> Optional[dict]:
    """Current weather at the circuit."""
    return await _get("/api/v1/weatherData")


async def get_session_info() -> Optional[dict]:
    """Session metadata (name, status, etc.)."""
    return await _get("/api/v1/sessionInfo")
