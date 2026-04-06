"""FastF1 data service — loads and caches session data."""

import fastf1
import pandas as pd
import numpy as np
from typing import Optional

from config import settings

# Enable FastF1 cache
fastf1.Cache.enable_cache(settings.FASTF1_CACHE_DIR)

# In-memory cache for loaded sessions
_session_cache: dict[str, fastf1.core.Session] = {}


def _cache_key(year: int, gp: str | int, session_type: str) -> str:
    return f"{year}_{gp}_{session_type}"


def load_session(
    year: int = 2024,
    gp: str | int = "Bahrain",
    session_type: str = "R",
) -> fastf1.core.Session:
    """Load a FastF1 session with caching."""
    key = _cache_key(year, gp, session_type)
    if key in _session_cache:
        return _session_cache[key]

    session = fastf1.get_session(year, gp, session_type)
    session.load()
    _session_cache[key] = session
    return session


def get_session_info(session: fastf1.core.Session) -> dict:
    """Get basic session information."""
    event = session.event
    return {
        "year": int(event["EventDate"].year),
        "name": str(event["EventName"]),
        "circuit": str(event.get("Location", "Unknown")),
        "country": str(event.get("Country", "Unknown")),
        "session_type": str(session.name),
        "date": str(event["EventDate"].date()),
        "total_laps": int(session.total_laps) if hasattr(session, "total_laps") and session.total_laps else 0,
    }


def get_drivers(session: fastf1.core.Session) -> list[dict]:
    """Get list of drivers with info."""
    results = session.results
    drivers = []
    for _, row in results.iterrows():
        drivers.append({
            "number": str(row.get("DriverNumber", "")),
            "abbreviation": str(row.get("Abbreviation", "")),
            "full_name": str(row.get("FullName", "")),
            "team": str(row.get("TeamName", "")),
            "team_color": f"#{row.get('TeamColor', '333333')}",
            "position": int(row.get("Position", 0)) if pd.notna(row.get("Position")) else 0,
            "grid_position": int(row.get("GridPosition", 0)) if pd.notna(row.get("GridPosition")) else 0,
            "status": str(row.get("Status", "")),
            "points": float(row.get("Points", 0)) if pd.notna(row.get("Points")) else 0,
        })
    return sorted(drivers, key=lambda d: d["position"] if d["position"] > 0 else 999)


def get_laps(session: fastf1.core.Session, driver: Optional[str] = None) -> list[dict]:
    """Get lap data, optionally filtered by driver abbreviation."""
    laps = session.laps
    if driver:
        laps = laps.pick_drivers(driver)

    result = []
    for _, lap in laps.iterrows():
        lap_time = lap.get("LapTime")
        s1 = lap.get("Sector1Time")
        s2 = lap.get("Sector2Time")
        s3 = lap.get("Sector3Time")

        result.append({
            "driver": str(lap.get("Driver", "")),
            "lap_number": int(lap.get("LapNumber", 0)),
            "lap_time": lap_time.total_seconds() if pd.notna(lap_time) else None,
            "sector1": s1.total_seconds() if pd.notna(s1) else None,
            "sector2": s2.total_seconds() if pd.notna(s2) else None,
            "sector3": s3.total_seconds() if pd.notna(s3) else None,
            "compound": str(lap.get("Compound", "")) if pd.notna(lap.get("Compound")) else None,
            "tyre_life": int(lap.get("TyreLife", 0)) if pd.notna(lap.get("TyreLife")) else None,
            "stint": int(lap.get("Stint", 0)) if pd.notna(lap.get("Stint")) else None,
            "is_pit_out_lap": bool(lap.get("PitOutTime") is not pd.NaT and pd.notna(lap.get("PitOutTime"))),
            "is_pit_in_lap": bool(lap.get("PitInTime") is not pd.NaT and pd.notna(lap.get("PitInTime"))),
            "speed_fl": float(lap.get("SpeedFL", 0)) if pd.notna(lap.get("SpeedFL")) else None,
            "speed_st": float(lap.get("SpeedST", 0)) if pd.notna(lap.get("SpeedST")) else None,
        })
    return result


def get_telemetry(
    session: fastf1.core.Session,
    driver: str,
    lap_number: int,
) -> dict:
    """Get telemetry data for a specific driver and lap."""
    laps = session.laps.pick_drivers(driver)
    lap = laps[laps["LapNumber"] == lap_number]

    if lap.empty:
        return {"error": f"No data for {driver} lap {lap_number}"}

    lap = lap.iloc[0]
    try:
        tel = lap.get_telemetry()
    except Exception:
        return {"error": f"Telemetry unavailable for {driver} lap {lap_number}"}

    # Downsample if too many points (for frontend performance)
    if len(tel) > 500:
        step = max(1, len(tel) // 500)
        tel = tel.iloc[::step]

    def safe_list(series):
        return [float(v) if pd.notna(v) and np.isfinite(v) else 0 for v in series]

    return {
        "driver": driver,
        "lap_number": lap_number,
        "distance": safe_list(tel.get("Distance", [])),
        "speed": safe_list(tel.get("Speed", [])),
        "throttle": safe_list(tel.get("Throttle", [])),
        "brake": [int(b) * 100 if pd.notna(b) else 0 for b in tel.get("Brake", [])],
        "rpm": safe_list(tel.get("RPM", [])),
        "gear": safe_list(tel.get("nGear", tel.get("Gear", []))),
        "drs": safe_list(tel.get("DRS", [])),
    }


def get_race_leaderboard(session: fastf1.core.Session, at_lap: Optional[int] = None) -> list[dict]:
    """Get leaderboard at a specific lap (or final standings)."""
    laps = session.laps
    drivers_info = get_drivers(session)
    driver_map = {d["abbreviation"]: d for d in drivers_info}

    if at_lap is None:
        at_lap = int(laps["LapNumber"].max())

    leaderboard = []
    for drv in laps["Driver"].unique():
        drv_laps = laps.pick_drivers(drv)
        lap_at = drv_laps[drv_laps["LapNumber"] <= at_lap]

        if lap_at.empty:
            continue

        last_lap = lap_at.iloc[-1]
        lap_time = last_lap.get("LapTime")
        info = driver_map.get(drv, {})

        leaderboard.append({
            "driver": drv,
            "full_name": info.get("full_name", drv),
            "team": info.get("team", ""),
            "team_color": info.get("team_color", "#333333"),
            "position": int(last_lap.get("Position", 0)) if pd.notna(last_lap.get("Position")) else 0,
            "current_lap": int(last_lap.get("LapNumber", 0)),
            "last_lap_time": lap_time.total_seconds() if pd.notna(lap_time) else None,
            "compound": str(last_lap.get("Compound", "")) if pd.notna(last_lap.get("Compound")) else None,
            "tyre_life": int(last_lap.get("TyreLife", 0)) if pd.notna(last_lap.get("TyreLife")) else None,
            "stint": int(last_lap.get("Stint", 0)) if pd.notna(last_lap.get("Stint")) else None,
            "gap_to_leader": None,  # Computed below
        })

    # Sort by position
    leaderboard.sort(key=lambda d: d["position"] if d["position"] > 0 else 999)

    # Compute gap to leader using cumulative lap times
    for idx, entry in enumerate(leaderboard):
        if idx == 0:
            entry["gap_to_leader"] = 0
        else:
            drv = entry["driver"]
            leader_drv = leaderboard[0]["driver"]
            drv_laps = laps.pick_drivers(drv)
            leader_laps = laps.pick_drivers(leader_drv)
            drv_at = drv_laps[drv_laps["LapNumber"] <= at_lap]
            leader_at = leader_laps[leader_laps["LapNumber"] <= at_lap]

            drv_time = drv_at["LapTime"].dropna().sum()
            leader_time = leader_at["LapTime"].dropna().sum()

            if hasattr(drv_time, "total_seconds") and hasattr(leader_time, "total_seconds"):
                gap = drv_time.total_seconds() - leader_time.total_seconds()
                entry["gap_to_leader"] = round(gap, 3)

    return leaderboard


def get_gap_evolution(session: fastf1.core.Session, top_n: int = 5) -> dict:
    """Get gap-to-leader evolution for top N finishers across all laps."""
    laps = session.laps
    drivers_info = get_drivers(session)
    driver_map = {d["abbreviation"]: d for d in drivers_info}

    total_laps = int(laps["LapNumber"].max())

    # Determine final top N drivers by finishing position
    final_board = get_race_leaderboard(session, at_lap=total_laps)
    top_drivers = [e["driver"] for e in final_board[:top_n]]
    leader = top_drivers[0] if top_drivers else None
    if not leader:
        return {"laps": [], "drivers": []}

    # Pre-compute cumulative times per driver per lap
    cum_times: dict[str, dict[int, float]] = {}
    for drv in top_drivers:
        drv_laps = laps.pick_drivers(drv).sort_values("LapNumber")
        running = 0.0
        times: dict[int, float] = {}
        for _, row in drv_laps.iterrows():
            lt = row.get("LapTime")
            if pd.notna(lt) and hasattr(lt, "total_seconds"):
                running += lt.total_seconds()
            times[int(row["LapNumber"])] = running
        cum_times[drv] = times

    lap_numbers = list(range(1, total_laps + 1))

    result_drivers = []
    for drv in top_drivers:
        info = driver_map.get(drv, {})
        gaps = []
        for lap_n in lap_numbers:
            leader_t = cum_times.get(leader, {}).get(lap_n)
            drv_t = cum_times.get(drv, {}).get(lap_n)
            if leader_t and drv_t:
                gaps.append(round(drv_t - leader_t, 3))
            else:
                gaps.append(None)
        result_drivers.append({
            "driver": drv,
            "full_name": info.get("full_name", drv),
            "team_color": info.get("team_color", "#333333"),
            "gaps": gaps,
        })

    return {"laps": lap_numbers, "drivers": result_drivers}


def get_weather(session: fastf1.core.Session) -> list[dict]:
    """Get weather data for the session."""
    weather = session.weather_data
    if weather is None or weather.empty:
        return []

    result = []
    for _, row in weather.iterrows():
        result.append({
            "time": str(row.get("Time", "")),
            "air_temp": float(row.get("AirTemp", 0)) if pd.notna(row.get("AirTemp")) else None,
            "track_temp": float(row.get("TrackTemp", 0)) if pd.notna(row.get("TrackTemp")) else None,
            "humidity": float(row.get("Humidity", 0)) if pd.notna(row.get("Humidity")) else None,
            "pressure": float(row.get("Pressure", 0)) if pd.notna(row.get("Pressure")) else None,
            "rainfall": bool(row.get("Rainfall", False)),
            "wind_speed": float(row.get("WindSpeed", 0)) if pd.notna(row.get("WindSpeed")) else None,
            "wind_direction": int(row.get("WindDirection", 0)) if pd.notna(row.get("WindDirection")) else None,
        })
    return result


def get_track_map(session: fastf1.core.Session) -> dict:
    """Get circuit outline coordinates and corner info for track map rendering."""
    try:
        circuit_info = session.get_circuit_info()
    except Exception:
        return {"error": "Circuit info not available"}

    # Get track outline from the fastest lap's position data
    lap = session.laps.pick_fastest()
    if lap is None:
        return {"error": "No lap data available"}

    try:
        pos = lap.get_pos_data()
    except Exception:
        return {"error": "Position data unavailable"}

    if pos is None or pos.empty:
        return {"error": "No position data"}

    x = pos["X"].values
    y = pos["Y"].values

    # Normalize to 0-1000 SVG space
    x_min, x_max = float(np.nanmin(x)), float(np.nanmax(x))
    y_min, y_max = float(np.nanmin(y)), float(np.nanmax(y))
    x_range = x_max - x_min or 1
    y_range = y_max - y_min or 1
    scale = max(x_range, y_range)

    # Center and normalize
    x_norm = ((x - x_min) / scale * 900 + 50).tolist()
    y_norm = ((y - y_min) / scale * 900 + 50).tolist()

    # Downsample for performance
    step = max(1, len(x_norm) // 300)
    x_norm = [float(v) if np.isfinite(v) else 0 for v in x_norm[::step]]
    y_norm = [float(v) if np.isfinite(v) else 0 for v in y_norm[::step]]

    # Corners
    corners = []
    if hasattr(circuit_info, "corners") and circuit_info.corners is not None:
        for _, c in circuit_info.corners.iterrows():
            cx = float((c.get("X", 0) - x_min) / scale * 900 + 50) if pd.notna(c.get("X")) else 0
            cy = float((c.get("Y", 0) - y_min) / scale * 900 + 50) if pd.notna(c.get("Y")) else 0
            corners.append({
                "number": int(c.get("Number", 0)),
                "x": cx,
                "y": cy,
                "letter": str(c.get("Letter", "")),
            })

    return {
        "x": x_norm,
        "y": y_norm,
        "corners": corners,
        "x_min": x_min,
        "x_max": x_max,
        "y_min": y_min,
        "y_max": y_max,
    }


def get_driver_positions_at_lap(session: fastf1.core.Session, lap_number: int) -> list[dict]:
    """Get X/Y positions of all drivers at a specific lap (sampled positions along the lap)."""
    laps = session.laps
    drivers_info = get_drivers(session)
    driver_map = {d["abbreviation"]: d for d in drivers_info}

    # Get track normalization from fastest lap
    fastest = session.laps.pick_fastest()
    if fastest is None:
        return []
    try:
        pos_ref = fastest.get_pos_data()
    except Exception:
        return []
    if pos_ref is None or pos_ref.empty:
        return []

    x_all = pos_ref["X"].values
    y_all = pos_ref["Y"].values
    x_min, x_max = float(np.nanmin(x_all)), float(np.nanmax(x_all))
    y_min, y_max = float(np.nanmin(y_all)), float(np.nanmax(y_all))
    x_range = x_max - x_min or 1
    y_range = y_max - y_min or 1
    scale = max(x_range, y_range)

    positions = []
    for drv in laps["Driver"].unique():
        drv_laps = laps.pick_drivers(drv)
        lap_data = drv_laps[drv_laps["LapNumber"] == lap_number]
        if lap_data.empty:
            continue

        lap_row = lap_data.iloc[0]
        info = driver_map.get(drv, {})

        try:
            pos = lap_row.get_pos_data()
        except Exception:
            continue

        if pos is None or pos.empty:
            continue

        # Pick a point ~70% through the lap as the "current" position
        idx = min(len(pos) - 1, int(len(pos) * 0.7))
        px = float((pos.iloc[idx]["X"] - x_min) / scale * 900 + 50) if pd.notna(pos.iloc[idx]["X"]) else 0
        py = float((pos.iloc[idx]["Y"] - y_min) / scale * 900 + 50) if pd.notna(pos.iloc[idx]["Y"]) else 0

        lap_time = lap_row.get("LapTime")
        position = lap_row.get("Position")

        positions.append({
            "driver": drv,
            "full_name": info.get("full_name", drv),
            "team": info.get("team", ""),
            "team_color": info.get("team_color", "#333333"),
            "x": round(px, 1),
            "y": round(py, 1),
            "position": int(position) if pd.notna(position) else 0,
            "lap_time": lap_time.total_seconds() if pd.notna(lap_time) else None,
        })

    positions.sort(key=lambda p: p["position"] if p["position"] > 0 else 999)
    return positions


def get_race_control_at_lap(session: fastf1.core.Session, lap_number: int) -> tuple[str, list[dict]]:
    """Return (flag_mode, race_control_messages) for a given lap.

    flag_mode: "green" | "yellow" | "sc" | "vsc" | "red" | "chequered"
    race_control_messages: list of {time, lap, category, flag, message}
    """
    try:
        rc = session.race_control_messages
    except Exception:
        return "green", []

    if rc is None or rc.empty:
        return "green", []

    # Determine the lap column name (fastf1 versions differ)
    lap_col = "Lap" if "Lap" in rc.columns else "LapNumber"

    # Filter messages up to this lap
    lap_msgs = rc[rc[lap_col] <= lap_number]
    if lap_msgs.empty:
        return "green", []

    # Build message list (last 10 up to current lap)
    recent = lap_msgs.tail(10)
    messages = []
    for _, row in recent.iterrows():
        time_str = str(row.get("Time", ""))
        if hasattr(row.get("Time"), "total_seconds"):
            secs = row["Time"].total_seconds()
            m, s = divmod(int(secs), 60)
            h, m = divmod(m, 60)
            time_str = f"{h}:{m:02d}:{s:02d}"
        messages.append({
            "time": time_str,
            "lap": int(row.get(lap_col, 0)) if pd.notna(row.get(lap_col)) else 0,
            "category": str(row.get("Category", "Other")),
            "flag": str(row.get("Flag", "")) if pd.notna(row.get("Flag")) else "",
            "message": str(row.get("Message", "")),
        })

    # Determine current flag from the latest flag-related message
    flag_mode = "green"
    for _, row in lap_msgs.iterrows():
        msg = str(row.get("Message", "")).upper()
        flag = str(row.get("Flag", "")).upper() if pd.notna(row.get("Flag")) else ""
        category = str(row.get("Category", "")).upper()

        if "RED FLAG" in msg or flag == "RED":
            flag_mode = "red"
        elif "SAFETY CAR" in msg and "VIRTUAL" not in msg:
            if "IN THIS LAP" in msg or "IN AT" in msg:
                flag_mode = "green"  # SC coming in
            else:
                flag_mode = "sc"
        elif "VIRTUAL SAFETY CAR" in msg or "VSC" in msg:
            if "ENDING" in msg:
                flag_mode = "green"
            else:
                flag_mode = "vsc"
        elif "GREEN" in flag or ("GREEN" in msg and category in ("FLAG", "")):
            flag_mode = "green"
        elif "YELLOW" in flag:
            flag_mode = "yellow"
        elif "CHEQUERED" in flag or "CHEQUERED" in msg:
            flag_mode = "chequered"

    return flag_mode, messages


def get_stints(session: fastf1.core.Session) -> list[dict]:
    """Return stint summary per driver: [{driver, team_color, stints: [{compound, start_lap, end_lap, laps}]}]."""
    laps = session.laps
    if laps.empty:
        return []

    drivers_info = get_drivers(session)
    driver_map = {d["abbreviation"]: d for d in drivers_info}
    total_laps = int(laps["LapNumber"].max())

    result = []
    for drv in laps["Driver"].unique():
        drv_laps = laps.pick_drivers(drv).sort_values("LapNumber")
        info = driver_map.get(drv, {})
        stints = []
        current_stint = None

        for _, lap_row in drv_laps.iterrows():
            compound = str(lap_row.get("Compound", "")) if pd.notna(lap_row.get("Compound")) else "UNKNOWN"
            stint_num = int(lap_row.get("Stint", 0)) if pd.notna(lap_row.get("Stint")) else 0
            lap_num = int(lap_row.get("LapNumber", 0))

            if current_stint is None or current_stint["stint"] != stint_num:
                if current_stint:
                    current_stint["end_lap"] = current_stint["_last_lap"]
                    stints.append(current_stint)
                current_stint = {
                    "compound": compound,
                    "stint": stint_num,
                    "start_lap": lap_num,
                    "end_lap": lap_num,
                    "laps": 1,
                    "_last_lap": lap_num,
                }
            else:
                current_stint["laps"] += 1
                current_stint["_last_lap"] = lap_num

        if current_stint:
            current_stint["end_lap"] = current_stint["_last_lap"]
            stints.append(current_stint)

        # Clean up internal fields
        for s in stints:
            s.pop("_last_lap", None)

        pos = info.get("position", 99)
        result.append({
            "driver": drv,
            "full_name": info.get("full_name", drv),
            "team_color": info.get("team_color", "#333333"),
            "position": pos,
            "total_laps": total_laps,
            "stints": stints,
        })

    result.sort(key=lambda x: x["position"])
    return result
