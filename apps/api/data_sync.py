"""Data sync service — fetches F1 data from RapidAPI & OpenF1, stores in SQLite.

Provides:
 - fetch_and_store_session()  — Fetch full race data for a year/gp and save to DB
 - sync_current_season()      — Fetch all available races for a year
 - background_sync_loop()     — Periodic background sync during live sessions

Data flow:
  1. Try OpenF1 first (free, more structured)
  2. Supplement with RapidAPI for live/real-time data
  3. Store everything in SQLite via database.py
"""

import asyncio
import logging
from typing import Optional

import database as db
import openf1_client
import live_pulse

logger = logging.getLogger(__name__)


async def fetch_and_store_session(year: int, gp: str, session_type: str = "Race") -> Optional[int]:
    """Fetch full race data from OpenF1 + RapidAPI and store in DB.
    
    Returns the session_id or None on failure.
    """
    logger.info("Syncing data for %d %s (%s)", year, gp, session_type)

    # ── 1. Get session metadata from OpenF1 ──
    session_id = None
    session_key = None

    try:
        sessions = await openf1_client.get_sessions(year=year, country=gp)
        # Find the matching race session
        race_sessions = [
            s for s in sessions
            if s.get("session_type", "").lower() == session_type.lower()
            or (session_type == "Race" and s.get("session_type") == "Race")
            or (session_type == "R" and s.get("session_type") == "Race")
        ]
        if race_sessions:
            s = race_sessions[0]
            session_key = s.get("session_key")
            session_id = await db.upsert_session(
                year=year,
                gp=gp,
                name=s.get("meeting_name", f"{year} {gp} Grand Prix"),
                circuit=s.get("circuit_short_name", ""),
                country=s.get("country_name", gp),
                session_type=session_type,
                date=s.get("date_start", ""),
                total_laps=0,
                session_key=str(session_key) if session_key else "",
                source="openf1",
                raw_data=s,
            )
            logger.info("Session created: id=%d, key=%s", session_id, session_key)
    except Exception as e:
        logger.warning("OpenF1 session lookup failed: %s", e)

    # If OpenF1 didn't find it, create a placeholder session
    if session_id is None:
        session_id = await db.upsert_session(
            year=year, gp=gp,
            name=f"{year} {gp} Grand Prix",
            session_type=session_type,
            source="rapidapi",
        )

    # ── 2. Fetch drivers from OpenF1 ──
    await asyncio.sleep(1)  # respect rate limits
    if session_key:
        try:
            drivers_raw = await openf1_client.get_drivers(session_key)
            drivers = []
            for d in drivers_raw:
                drivers.append({
                    "number": str(d.get("driver_number", "")),
                    "abbreviation": d.get("name_acronym", ""),
                    "full_name": d.get("full_name", ""),
                    "team": d.get("team_name", ""),
                    "team_color": d.get("team_colour", ""),
                    "position": 0,
                    "grid_position": 0,
                    "status": "",
                    "points": 0,
                })
            if drivers:
                await db.save_drivers(session_id, drivers)
                logger.info("Saved %d drivers", len(drivers))
        except Exception as e:
            logger.warning("Failed to fetch drivers: %s", e)

    # ── 3. Fetch lap times from OpenF1 ──
    await asyncio.sleep(1)
    if session_key:
        try:
            laps_raw = await openf1_client.get_laps(session_key)
            laps = []
            for lap in laps_raw:
                duration = lap.get("lap_duration")
                laps.append({
                    "driver": str(lap.get("driver_number", "")),
                    "lap_number": lap.get("lap_number", 0),
                    "lap_time": duration,
                    "sector1": lap.get("duration_sector_1"),
                    "sector2": lap.get("duration_sector_2"),
                    "sector3": lap.get("duration_sector_3"),
                    "compound": None,
                    "tyre_life": None,
                    "stint": None,
                    "is_pit_out_lap": lap.get("is_pit_out_lap", False),
                    "is_pit_in_lap": False,
                    "speed_fl": None,
                    "speed_st": lap.get("st_speed"),
                })
            if laps:
                await db.save_lap_times(session_id, laps)
                logger.info("Saved %d lap records", len(laps))

                # Update total_laps in session
                max_lap = max(l.get("lap_number", 0) for l in laps)
                if max_lap > 0:
                    d = await db.get_db()
                    await d.execute(
                        "UPDATE sessions SET total_laps=? WHERE id=?",
                        (max_lap, session_id)
                    )
                    await d.commit()
        except Exception as e:
            logger.warning("Failed to fetch laps: %s", e)

    # ── 4. Fetch stints from OpenF1 ──
    await asyncio.sleep(1)
    if session_key:
        try:
            stints_raw = await openf1_client.get_stints(session_key)
            stints = []
            for s in stints_raw:
                stints.append({
                    "driver": str(s.get("driver_number", "")),
                    "stint_number": s.get("stint_number", 0),
                    "compound": s.get("compound", ""),
                    "start_lap": s.get("lap_start", 0),
                    "end_lap": s.get("lap_end", 0),
                    "laps": (s.get("lap_end", 0) or 0) - (s.get("lap_start", 0) or 0),
                })
            if stints:
                await db.save_stints(session_id, stints)
                logger.info("Saved %d stint records", len(stints))
        except Exception as e:
            logger.warning("Failed to fetch stints: %s", e)

    # ── 5. Fetch race control from OpenF1 ──
    await asyncio.sleep(1)
    if session_key:
        try:
            rc_raw = await openf1_client.get_race_control(session_key)
            messages = []
            for m in rc_raw:
                messages.append({
                    "lap": m.get("lap_number", 0),
                    "category": m.get("category", "Other"),
                    "flag": m.get("flag", ""),
                    "message": m.get("message", ""),
                    "timestamp": m.get("date", ""),
                })
            if messages:
                await db.save_race_control(session_id, messages)
                logger.info("Saved %d race control messages", len(messages))
        except Exception as e:
            logger.warning("Failed to fetch race control: %s", e)

    # ── 6. Fetch weather from OpenF1 ──
    await asyncio.sleep(1)
    if session_key:
        try:
            weather_raw = await openf1_client.get_weather(session_key)
            weather = []
            for w in weather_raw:
                weather.append({
                    "air_temp": w.get("air_temperature"),
                    "track_temp": w.get("track_temperature"),
                    "humidity": w.get("humidity"),
                    "pressure": w.get("pressure"),
                    "rainfall": w.get("rainfall", 0),
                    "wind_speed": w.get("wind_speed"),
                    "wind_direction": w.get("wind_direction"),
                    "timestamp": w.get("date", ""),
                })
            if weather:
                await db.save_weather(session_id, weather)
                logger.info("Saved %d weather records", len(weather))
        except Exception as e:
            logger.warning("Failed to fetch weather: %s", e)

    # ── 7. Fetch positions/intervals from OpenF1 ──
    await asyncio.sleep(1)
    if session_key:
        try:
            positions_raw = await openf1_client.get_position(session_key)
            # Group by date to get snapshots, then pick latest per driver per lap
            seen = set()
            positions = []
            for p in positions_raw:
                key = (p.get("driver_number"), p.get("position"))
                if key not in seen:
                    seen.add(key)
                    positions.append({
                        "driver": str(p.get("driver_number", "")),
                        "lap": 0,
                        "position": p.get("position", 0),
                        "gap_to_leader": None,
                        "interval_to_ahead": None,
                        "last_lap_time": None,
                        "compound": None,
                        "tyre_life": None,
                        "timestamp": p.get("date", ""),
                    })
            if positions:
                await db.save_positions(session_id, positions)
                logger.info("Saved %d position records", len(positions))
        except Exception as e:
            logger.warning("Failed to fetch positions: %s", e)

    # ── 8. Supplement with RapidAPI if available ──
    if live_pulse.is_enabled():
        await _supplement_from_rapidapi(session_id)

    return session_id


async def _supplement_from_rapidapi(session_id: int):
    """Pull extra data from RapidAPI to supplement OpenF1 data."""
    try:
        # Timing data
        timing = await live_pulse.get_live_timing()
        if timing and isinstance(timing, dict):
            lines = timing.get("Lines", timing.get("lines", {}))
            if isinstance(lines, dict):
                positions = []
                for driver_num, data in lines.items():
                    if isinstance(data, dict):
                        positions.append({
                            "driver": str(driver_num),
                            "lap": 0,
                            "position": data.get("Position", data.get("position", 0)),
                            "gap_to_leader": _parse_gap(data.get("GapToLeader", data.get("TimeDiffToFastest"))),
                            "interval_to_ahead": _parse_gap(data.get("IntervalToPositionAhead", data.get("TimeDiffToPositionAhead"))),
                            "last_lap_time": _parse_time(data.get("LastLapTime", {}).get("Value")),
                            "compound": None,
                            "tyre_life": None,
                            "timestamp": "",
                        })
                if positions:
                    await db.save_positions(session_id, positions)
                    logger.info("RapidAPI: saved %d timing entries", len(positions))
    except Exception as e:
        logger.warning("RapidAPI supplement failed: %s", e)

    try:
        # Pit stops
        pits = await live_pulse.get_pit_stops()
        if pits and isinstance(pits, dict):
            pit_list = pits.get("PitStops", pits.get("pitStops", []))
            if isinstance(pit_list, list):
                stops = []
                for p in pit_list:
                    stops.append({
                        "driver": str(p.get("RacingNumber", p.get("driver", ""))),
                        "lap": p.get("Lap", p.get("lap", 0)),
                        "duration": _parse_time(p.get("Duration", p.get("duration"))),
                        "compound_from": "",
                        "compound_to": "",
                        "timestamp": p.get("Time", ""),
                    })
                if stops:
                    await db.save_pit_stops(session_id, stops)
                    logger.info("RapidAPI: saved %d pit stops", len(stops))
    except Exception as e:
        logger.warning("RapidAPI pit stops failed: %s", e)


def _parse_gap(val) -> Optional[float]:
    """Parse a gap string like '+1.234' or '1 LAP' to float seconds."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip().lstrip("+")
    if "LAP" in s.upper():
        return None
    try:
        return float(s)
    except (ValueError, TypeError):
        return None


def _parse_time(val) -> Optional[float]:
    """Parse a lap time value to seconds."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip()
    # Handle M:SS.mmm format
    if ":" in s:
        parts = s.split(":")
        try:
            return float(parts[0]) * 60 + float(parts[1])
        except (ValueError, IndexError):
            return None
    try:
        return float(s)
    except (ValueError, TypeError):
        return None


async def sync_season(year: int):
    """Fetch and store all available race sessions for a season.
    
    Uses OpenF1 to discover sessions, then fetches full data for each.
    """
    logger.info("Syncing full %d season...", year)
    try:
        sessions = await openf1_client.get_available_sessions_by_year(year)
        synced = 0
        for s in sessions:
            gp = s.get("gp", "")
            # Skip if we already have data
            if await db.session_has_data(year, gp):
                logger.info("Skipping %d %s — already have data", year, gp)
                continue
            session_id = await fetch_and_store_session(year, gp)
            if session_id:
                synced += 1
            # Longer delay between session syncs to avoid 429s
            await asyncio.sleep(5)
        logger.info("Season %d sync complete: %d/%d sessions synced", year, synced, len(sessions))
        return synced
    except Exception as e:
        logger.error("Season sync failed: %s", e)
        return 0


async def sync_latest():
    """Sync the most recent session from OpenF1."""
    try:
        latest = await openf1_client.get_latest_session()
        if latest:
            country = latest.get("country_name", "")
            year = 0
            date_str = latest.get("date_start", "")
            if date_str:
                try:
                    from datetime import datetime
                    dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                    year = dt.year
                except Exception:
                    pass
            if year and country:
                return await fetch_and_store_session(year, country)
    except Exception as e:
        logger.error("Latest session sync failed: %s", e)
    return None


# ─── Background sync task ────────────────────────────────────────────

_sync_task: Optional[asyncio.Task] = None


async def _background_sync_loop(interval_seconds: int = 300):
    """Background loop that periodically syncs latest session data."""
    # Wait before the first sync to let the server fully start
    await asyncio.sleep(30)
    while True:
        try:
            await sync_latest()
        except Exception as e:
            logger.error("Background sync error: %s", e)
        await asyncio.sleep(interval_seconds)


def start_background_sync(interval_seconds: int = 300):
    """Start periodic background sync."""
    global _sync_task
    if _sync_task is None or _sync_task.done():
        _sync_task = asyncio.create_task(_background_sync_loop(interval_seconds))
        logger.info("Background sync started (every %ds)", interval_seconds)


def stop_background_sync():
    """Stop periodic background sync."""
    global _sync_task
    if _sync_task and not _sync_task.done():
        _sync_task.cancel()
        _sync_task = None
        logger.info("Background sync stopped")
