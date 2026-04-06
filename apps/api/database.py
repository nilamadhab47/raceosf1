"""SQLite database layer for persisting F1 data.

Stores race data fetched from RapidAPI / OpenF1 so we have 2026 (and beyond)
data available offline without re-fetching.  Uses aiosqlite for async access.

Tables:
  sessions       — race weekend metadata
  drivers        — driver info per session
  lap_times      — per-driver per-lap times + sectors
  positions      — position snapshots (timing screen order)
  race_control   — flags, penalties, messages
  pit_stops      — pit stop events
  stints         — tyre stints
  weather        — weather snapshots
  team_radio     — team radio metadata
"""

import aiosqlite
import json
import os
import logging
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)

DB_PATH = os.getenv("F1_DB_PATH", os.path.join(os.path.dirname(__file__), "f1_data.db"))

_db: Optional[aiosqlite.Connection] = None


async def get_db() -> aiosqlite.Connection:
    """Get or create the database connection."""
    global _db
    if _db is None:
        _db = await aiosqlite.connect(DB_PATH)
        _db.row_factory = aiosqlite.Row
        await _db.execute("PRAGMA journal_mode=WAL")
        await _db.execute("PRAGMA foreign_keys=ON")
        await _init_tables(_db)
    return _db


async def close_db():
    """Close the database connection."""
    global _db
    if _db:
        await _db.close()
        _db = None


async def _init_tables(db: aiosqlite.Connection):
    """Create tables if they don't exist."""
    await db.executescript("""
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year INTEGER NOT NULL,
            gp TEXT NOT NULL,
            name TEXT,
            circuit TEXT,
            country TEXT,
            session_type TEXT DEFAULT 'Race',
            date TEXT,
            total_laps INTEGER,
            session_key TEXT,
            source TEXT DEFAULT 'rapidapi',
            fetched_at TEXT,
            raw_data TEXT,
            UNIQUE(year, gp, session_type)
        );

        CREATE TABLE IF NOT EXISTS drivers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER REFERENCES sessions(id),
            number TEXT,
            abbreviation TEXT,
            full_name TEXT,
            team TEXT,
            team_color TEXT,
            position INTEGER,
            grid_position INTEGER,
            status TEXT,
            points REAL DEFAULT 0,
            UNIQUE(session_id, abbreviation)
        );

        CREATE TABLE IF NOT EXISTS lap_times (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER REFERENCES sessions(id),
            driver TEXT,
            lap_number INTEGER,
            lap_time REAL,
            sector1 REAL,
            sector2 REAL,
            sector3 REAL,
            compound TEXT,
            tyre_life INTEGER,
            stint INTEGER,
            is_pit_out_lap INTEGER DEFAULT 0,
            is_pit_in_lap INTEGER DEFAULT 0,
            speed_fl REAL,
            speed_st REAL,
            UNIQUE(session_id, driver, lap_number)
        );

        CREATE TABLE IF NOT EXISTS positions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER REFERENCES sessions(id),
            driver TEXT,
            lap INTEGER,
            position INTEGER,
            gap_to_leader REAL,
            interval_to_ahead REAL,
            last_lap_time REAL,
            compound TEXT,
            tyre_life INTEGER,
            timestamp TEXT
        );

        CREATE TABLE IF NOT EXISTS race_control (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER REFERENCES sessions(id),
            lap INTEGER,
            category TEXT,
            flag TEXT,
            message TEXT,
            timestamp TEXT
        );

        CREATE TABLE IF NOT EXISTS pit_stops (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER REFERENCES sessions(id),
            driver TEXT,
            lap INTEGER,
            duration REAL,
            compound_from TEXT,
            compound_to TEXT,
            timestamp TEXT
        );

        CREATE TABLE IF NOT EXISTS stints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER REFERENCES sessions(id),
            driver TEXT,
            stint_number INTEGER,
            compound TEXT,
            start_lap INTEGER,
            end_lap INTEGER,
            laps INTEGER,
            UNIQUE(session_id, driver, stint_number)
        );

        CREATE TABLE IF NOT EXISTS weather (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER REFERENCES sessions(id),
            air_temp REAL,
            track_temp REAL,
            humidity REAL,
            pressure REAL,
            rainfall INTEGER DEFAULT 0,
            wind_speed REAL,
            wind_direction REAL,
            timestamp TEXT
        );

        CREATE TABLE IF NOT EXISTS team_radio (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER REFERENCES sessions(id),
            driver TEXT,
            message TEXT,
            lap INTEGER,
            timestamp TEXT,
            recording_url TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_lap_times_session ON lap_times(session_id, driver);
        CREATE INDEX IF NOT EXISTS idx_positions_session ON positions(session_id, lap);
        CREATE INDEX IF NOT EXISTS idx_stints_session ON stints(session_id, driver);
    """)
    await db.commit()


# ─── Session CRUD ────────────────────────────────────────────────────

async def upsert_session(
    year: int, gp: str, name: str = "", circuit: str = "",
    country: str = "", session_type: str = "Race", date: str = "",
    total_laps: int = 0, session_key: str = "", source: str = "rapidapi",
    raw_data: dict = None,
) -> int:
    """Insert or update a session. Returns the session ID."""
    db = await get_db()
    await db.execute("""
        INSERT INTO sessions (year, gp, name, circuit, country, session_type, date, total_laps, session_key, source, fetched_at, raw_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(year, gp, session_type) DO UPDATE SET
            name=excluded.name, circuit=excluded.circuit, country=excluded.country,
            date=excluded.date, total_laps=excluded.total_laps, session_key=excluded.session_key,
            source=excluded.source, fetched_at=excluded.fetched_at, raw_data=excluded.raw_data
    """, (year, gp, name, circuit, country, session_type, date, total_laps,
          session_key, source, datetime.utcnow().isoformat(),
          json.dumps(raw_data) if raw_data else None))
    await db.commit()
    cursor = await db.execute(
        "SELECT id FROM sessions WHERE year=? AND gp=? AND session_type=?",
        (year, gp, session_type)
    )
    row = await cursor.fetchone()
    return row[0]


async def get_session(year: int, gp: str, session_type: str = "Race") -> Optional[dict]:
    """Get a session from DB."""
    db = await get_db()
    cursor = await db.execute(
        "SELECT * FROM sessions WHERE year=? AND gp=? AND session_type=?",
        (year, gp, session_type)
    )
    row = await cursor.fetchone()
    if not row:
        return None
    return dict(row)


async def get_all_sessions(year: Optional[int] = None) -> list[dict]:
    """Get all sessions, optionally filtered by year."""
    db = await get_db()
    if year:
        cursor = await db.execute(
            "SELECT * FROM sessions WHERE year=? ORDER BY date DESC", (year,)
        )
    else:
        cursor = await db.execute("SELECT * FROM sessions ORDER BY year DESC, date DESC")
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


# ─── Bulk insert helpers ─────────────────────────────────────────────

async def save_drivers(session_id: int, drivers: list[dict]):
    """Save driver list for a session."""
    db = await get_db()
    for d in drivers:
        await db.execute("""
            INSERT OR REPLACE INTO drivers (session_id, number, abbreviation, full_name, team, team_color, position, grid_position, status, points)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (session_id, d.get("number", ""), d.get("abbreviation", d.get("driver", "")),
              d.get("full_name", d.get("name", "")), d.get("team", ""),
              d.get("team_color", ""), d.get("position", 0),
              d.get("grid_position", 0), d.get("status", ""), d.get("points", 0)))
    await db.commit()


async def save_lap_times(session_id: int, laps: list[dict]):
    """Save lap time data for a session."""
    db = await get_db()
    for lap in laps:
        await db.execute("""
            INSERT OR REPLACE INTO lap_times
            (session_id, driver, lap_number, lap_time, sector1, sector2, sector3,
             compound, tyre_life, stint, is_pit_out_lap, is_pit_in_lap, speed_fl, speed_st)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (session_id, lap.get("driver", ""), lap.get("lap_number", 0),
              lap.get("lap_time"), lap.get("sector1"), lap.get("sector2"), lap.get("sector3"),
              lap.get("compound"), lap.get("tyre_life"), lap.get("stint"),
              int(lap.get("is_pit_out_lap", False)), int(lap.get("is_pit_in_lap", False)),
              lap.get("speed_fl"), lap.get("speed_st")))
    await db.commit()


async def save_positions(session_id: int, positions: list[dict]):
    """Save position/leaderboard snapshots."""
    db = await get_db()
    for p in positions:
        await db.execute("""
            INSERT INTO positions
            (session_id, driver, lap, position, gap_to_leader, interval_to_ahead,
             last_lap_time, compound, tyre_life, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (session_id, p.get("driver", ""), p.get("lap", 0), p.get("position", 0),
              p.get("gap_to_leader"), p.get("interval", p.get("interval_to_ahead")),
              p.get("last_lap_time"), p.get("compound"), p.get("tyre_life"),
              p.get("timestamp", "")))
    await db.commit()


async def save_race_control(session_id: int, messages: list[dict]):
    """Save race control messages."""
    db = await get_db()
    for m in messages:
        await db.execute("""
            INSERT INTO race_control (session_id, lap, category, flag, message, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (session_id, m.get("lap", 0), m.get("category", "Other"),
              m.get("flag", ""), m.get("message", ""), m.get("timestamp", "")))
    await db.commit()


async def save_stints(session_id: int, stints: list[dict]):
    """Save tyre stint data."""
    db = await get_db()
    for s in stints:
        await db.execute("""
            INSERT OR REPLACE INTO stints
            (session_id, driver, stint_number, compound, start_lap, end_lap, laps)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (session_id, s.get("driver", ""), s.get("stint_number", s.get("stint", 0)),
              s.get("compound", ""), s.get("start_lap", 0),
              s.get("end_lap", 0), s.get("laps", 0)))
    await db.commit()


async def save_weather(session_id: int, weather: list[dict]):
    """Save weather data points."""
    db = await get_db()
    for w in weather:
        await db.execute("""
            INSERT INTO weather
            (session_id, air_temp, track_temp, humidity, pressure, rainfall, wind_speed, wind_direction, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (session_id, w.get("air_temp"), w.get("track_temp"),
              w.get("humidity"), w.get("pressure"),
              int(w.get("rainfall", False)), w.get("wind_speed"),
              w.get("wind_direction"), w.get("timestamp", "")))
    await db.commit()


async def save_pit_stops(session_id: int, stops: list[dict]):
    """Save pit stop events."""
    db = await get_db()
    for s in stops:
        await db.execute("""
            INSERT INTO pit_stops (session_id, driver, lap, duration, compound_from, compound_to, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (session_id, s.get("driver", ""), s.get("lap", 0),
              s.get("duration"), s.get("compound_from", ""),
              s.get("compound_to", ""), s.get("timestamp", "")))
    await db.commit()


# ─── Query helpers ───────────────────────────────────────────────────

async def get_drivers_for_session(session_id: int) -> list[dict]:
    db = await get_db()
    cursor = await db.execute(
        "SELECT * FROM drivers WHERE session_id=? ORDER BY position", (session_id,)
    )
    return [dict(r) for r in await cursor.fetchall()]


async def get_leaderboard_at_lap(session_id: int, lap: int) -> list[dict]:
    """Get leaderboard at a specific lap from stored positions."""
    db = await get_db()
    # Get the latest position entry for each driver up to this lap
    cursor = await db.execute("""
        SELECT p.* FROM positions p
        INNER JOIN (
            SELECT driver, MAX(lap) as max_lap
            FROM positions
            WHERE session_id=? AND lap<=?
            GROUP BY driver
        ) latest ON p.driver = latest.driver AND p.lap = latest.max_lap AND p.session_id=?
        ORDER BY p.position
    """, (session_id, lap, session_id))
    return [dict(r) for r in await cursor.fetchall()]


async def get_laps_for_driver(session_id: int, driver: str) -> list[dict]:
    db = await get_db()
    cursor = await db.execute(
        "SELECT * FROM lap_times WHERE session_id=? AND driver=? ORDER BY lap_number",
        (session_id, driver)
    )
    return [dict(r) for r in await cursor.fetchall()]


async def get_all_laps(session_id: int) -> list[dict]:
    db = await get_db()
    cursor = await db.execute(
        "SELECT * FROM lap_times WHERE session_id=? ORDER BY lap_number, driver",
        (session_id,)
    )
    return [dict(r) for r in await cursor.fetchall()]


async def get_stints_for_session(session_id: int) -> list[dict]:
    db = await get_db()
    cursor = await db.execute(
        "SELECT * FROM stints WHERE session_id=? ORDER BY driver, stint_number",
        (session_id,)
    )
    return [dict(r) for r in await cursor.fetchall()]


async def get_race_control_for_session(session_id: int, lap: Optional[int] = None) -> list[dict]:
    db = await get_db()
    if lap:
        cursor = await db.execute(
            "SELECT * FROM race_control WHERE session_id=? AND lap<=? ORDER BY lap, timestamp",
            (session_id, lap)
        )
    else:
        cursor = await db.execute(
            "SELECT * FROM race_control WHERE session_id=? ORDER BY lap, timestamp",
            (session_id,)
        )
    return [dict(r) for r in await cursor.fetchall()]


async def get_weather_for_session(session_id: int) -> list[dict]:
    db = await get_db()
    cursor = await db.execute(
        "SELECT * FROM weather WHERE session_id=? ORDER BY timestamp",
        (session_id,)
    )
    return [dict(r) for r in await cursor.fetchall()]


async def get_pit_stops_for_session(session_id: int) -> list[dict]:
    db = await get_db()
    cursor = await db.execute(
        "SELECT * FROM pit_stops WHERE session_id=? ORDER BY lap",
        (session_id,)
    )
    return [dict(r) for r in await cursor.fetchall()]


async def session_has_data(year: int, gp: str, session_type: str = "Race") -> bool:
    """Check if we already have lap data for this session."""
    s = await get_session(year, gp, session_type)
    if not s:
        return False
    db = await get_db()
    cursor = await db.execute(
        "SELECT COUNT(*) FROM lap_times WHERE session_id=?", (s["id"],)
    )
    row = await cursor.fetchone()
    return row[0] > 0
