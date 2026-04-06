"""AI Insights Engine — rule-based F1 race analysis.

Designed to be replaceable with LLM-based analysis later.
Each rule function returns a list of Insight dicts.
"""

import pandas as pd
from typing import Protocol, Optional
import fastf1


class InsightGenerator(Protocol):
    """Protocol for insight generators — swap in LLM later."""
    def generate(self, session: fastf1.core.Session, at_lap: Optional[int] = None) -> list[dict]:
        ...


def _detect_tyre_degradation(session: fastf1.core.Session, at_lap: Optional[int] = None) -> list[dict]:
    """Detect drivers whose lap times are increasing significantly on old tyres."""
    insights = []
    laps = session.laps

    for drv in laps["Driver"].unique():
        drv_laps = laps.pick_drivers(drv)
        if at_lap:
            drv_laps = drv_laps[drv_laps["LapNumber"] <= at_lap]

        drv_laps = drv_laps[drv_laps["LapTime"].notna()].copy()
        drv_laps = drv_laps[~drv_laps["PitOutTime"].notna()]  # Exclude out-laps
        drv_laps = drv_laps[~drv_laps["PitInTime"].notna()]   # Exclude in-laps

        if len(drv_laps) < 5:
            continue

        # Look at last 5 laps
        recent = drv_laps.tail(5)
        times = recent["LapTime"].apply(lambda x: x.total_seconds() if pd.notna(x) else None)
        times = times.dropna().tolist()

        if len(times) < 4:
            continue

        # Check if lap times are trending upward (degradation)
        diffs = [times[i+1] - times[i] for i in range(len(times)-1)]
        avg_diff = sum(diffs) / len(diffs)
        tyre_life = recent.iloc[-1].get("TyreLife", 0)

        if avg_diff > 0.3 and pd.notna(tyre_life) and tyre_life > 15:
            compound = recent.iloc[-1].get("Compound", "Unknown")
            insights.append({
                "type": "degradation",
                "severity": "warning",
                "driver": drv,
                "message": f"🔴 {drv} showing tyre degradation on {compound}s (stint age: {int(tyre_life)} laps, avg +{avg_diff:.2f}s/lap)",
                "confidence": min(0.95, 0.5 + avg_diff * 0.15),
                "lap": int(recent.iloc[-1]["LapNumber"]),
            })

    return insights


def _detect_pace_drop(session: fastf1.core.Session, at_lap: Optional[int] = None) -> list[dict]:
    """Detect sudden pace drops (potential issue)."""
    insights = []
    laps = session.laps

    for drv in laps["Driver"].unique():
        drv_laps = laps.pick_drivers(drv)
        if at_lap:
            drv_laps = drv_laps[drv_laps["LapNumber"] <= at_lap]

        drv_laps = drv_laps[drv_laps["LapTime"].notna()].copy()
        drv_laps = drv_laps[~drv_laps["PitOutTime"].notna()]
        drv_laps = drv_laps[~drv_laps["PitInTime"].notna()]

        if len(drv_laps) < 6:
            continue

        baseline = drv_laps.tail(6).head(3)  # 3 laps before the latest 3
        recent = drv_laps.tail(3)

        baseline_avg = baseline["LapTime"].apply(lambda x: x.total_seconds()).mean()
        recent_avg = recent["LapTime"].apply(lambda x: x.total_seconds()).mean()

        diff = recent_avg - baseline_avg
        if diff > 1.0:
            insights.append({
                "type": "pace_drop",
                "severity": "alert",
                "driver": drv,
                "message": f"⚠️ {drv} pace dropped by {diff:.2f}s over last 3 laps — possible issue or traffic",
                "confidence": min(0.9, 0.4 + diff * 0.1),
                "lap": int(recent.iloc[-1]["LapNumber"]),
            })

    return insights


def _detect_undercut_opportunity(session: fastf1.core.Session, at_lap: Optional[int] = None) -> list[dict]:
    """Detect potential undercut opportunities."""
    insights = []
    laps = session.laps

    drivers = sorted(laps["Driver"].unique())
    driver_recent: dict[str, dict] = {}

    for drv in drivers:
        drv_laps = laps.pick_drivers(drv)
        if at_lap:
            drv_laps = drv_laps[drv_laps["LapNumber"] <= at_lap]

        clean_laps = drv_laps[drv_laps["LapTime"].notna()].copy()
        clean_laps = clean_laps[~clean_laps["PitOutTime"].notna()]
        clean_laps = clean_laps[~clean_laps["PitInTime"].notna()]

        if len(clean_laps) < 3:
            continue

        recent_3 = clean_laps.tail(3)
        avg_pace = recent_3["LapTime"].apply(lambda x: x.total_seconds()).mean()
        tyre_life = recent_3.iloc[-1].get("TyreLife", 0)
        compound = str(recent_3.iloc[-1].get("Compound", ""))
        position = recent_3.iloc[-1].get("Position", 0)

        driver_recent[drv] = {
            "avg_pace": avg_pace,
            "tyre_life": int(tyre_life) if pd.notna(tyre_life) else 0,
            "compound": compound,
            "position": int(position) if pd.notna(position) else 0,
        }

    # Compare adjacent drivers
    sorted_drivers = sorted(driver_recent.items(), key=lambda x: x[1]["position"])
    for i in range(1, len(sorted_drivers)):
        ahead_drv, ahead = sorted_drivers[i - 1]
        behind_drv, behind = sorted_drivers[i]

        # Undercut: behind driver is faster and ahead driver has old tyres
        if (behind["avg_pace"] < ahead["avg_pace"] - 0.3
                and ahead["tyre_life"] > 15
                and behind["tyre_life"] > 10):
            pit_window_gap = ahead["avg_pace"] - behind["avg_pace"]
            insights.append({
                "type": "strategy",
                "severity": "info",
                "driver": behind_drv,
                "message": f"🟢 Undercut window open: {behind_drv} is {pit_window_gap:.2f}s/lap faster than {ahead_drv} (P{ahead['position']}). Fresh tyres could gain position.",
                "confidence": min(0.85, 0.5 + pit_window_gap * 0.1),
                "lap": at_lap or 0,
            })

    return insights


def _detect_pit_stop_suggestion(session: fastf1.core.Session, at_lap: Optional[int] = None) -> list[dict]:
    """Suggest pit stops based on tyre age and degradation."""
    insights = []
    laps = session.laps

    # Average stint lengths for compounds (rough heuristics)
    compound_avg_stint = {"SOFT": 18, "MEDIUM": 28, "HARD": 40}

    for drv in laps["Driver"].unique():
        drv_laps = laps.pick_drivers(drv)
        if at_lap:
            drv_laps = drv_laps[drv_laps["LapNumber"] <= at_lap]

        if drv_laps.empty:
            continue

        last = drv_laps.iloc[-1]
        tyre_life = last.get("TyreLife")
        compound = str(last.get("Compound", "MEDIUM"))

        if pd.isna(tyre_life):
            continue

        tyre_life = int(tyre_life)
        expected_stint = compound_avg_stint.get(compound, 25)

        if tyre_life >= expected_stint * 0.85:
            laps_overdue = tyre_life - expected_stint
            insights.append({
                "type": "pit_suggestion",
                "severity": "warning" if laps_overdue > 0 else "info",
                "driver": drv,
                "message": f"🔧 {drv} should consider pitting — {compound} tyres at {tyre_life} laps (typical stint: ~{expected_stint})",
                "confidence": min(0.9, 0.6 + (tyre_life / expected_stint - 0.85) * 2),
                "lap": int(last["LapNumber"]),
            })

    return insights


def _detect_strong_laps(session: fastf1.core.Session, at_lap: Optional[int] = None) -> list[dict]:
    """Report notably fast laps on the current lap (works from lap 2)."""
    insights = []
    laps = session.laps
    if laps.empty:
        return insights

    target_lap = at_lap or int(laps["LapNumber"].max())
    if target_lap < 2:
        return insights

    all_laps = laps[laps["LapNumber"] <= target_lap]
    all_laps = all_laps[all_laps["LapTime"].notna()]
    all_laps = all_laps[~all_laps["PitOutTime"].notna()]
    all_laps = all_laps[~all_laps["PitInTime"].notna()]
    if all_laps.empty:
        return insights

    fastest_time = all_laps["LapTime"].min().total_seconds()
    current_laps = all_laps[all_laps["LapNumber"] == target_lap]
    if current_laps.empty:
        return insights

    for _, row in current_laps.iterrows():
        t = row["LapTime"].total_seconds()
        if t <= fastest_time * 1.005:
            drv = row["Driver"]
            ct_str = f"{int(t // 60)}:{t % 60:06.3f}" if t >= 60 else f"{t:.3f}s"
            insights.append({
                "type": "pace",
                "severity": "info",
                "driver": drv,
                "message": f"🔥 {drv} posted a strong lap: {ct_str} (Lap {target_lap})",
                "confidence": 0.8,
                "lap": target_lap,
            })

    return insights[:3]


def _detect_position_changes(session: fastf1.core.Session, at_lap: Optional[int] = None) -> list[dict]:
    """Detect position gains/losses vs grid (works from lap 1)."""
    insights = []
    laps = session.laps
    if laps.empty:
        return insights

    target_lap = at_lap or int(laps["LapNumber"].max())
    if target_lap < 1:
        return insights

    current_data = laps[laps["LapNumber"] == target_lap]
    if current_data.empty:
        return insights

    # Compare with grid position (lap 1 position)
    grid_data = laps[laps["LapNumber"] == 1]
    if grid_data.empty:
        return insights

    grid_map = {}
    for _, row in grid_data.iterrows():
        pos = row.get("Position")
        if pd.notna(pos):
            grid_map[row["Driver"]] = int(pos)

    for _, row in current_data.iterrows():
        drv = row["Driver"]
        pos = row.get("Position")
        if pd.isna(pos) or drv not in grid_map:
            continue
        current_pos = int(pos)
        grid_pos = grid_map[drv]
        gained = grid_pos - current_pos

        if gained >= 3:
            insights.append({
                "type": "mover",
                "severity": "info",
                "driver": drv,
                "message": f"🚀 {drv} up {gained} places from P{grid_pos} → P{current_pos}",
                "confidence": min(0.95, 0.7 + gained * 0.05),
                "lap": target_lap,
            })
        elif gained <= -3:
            insights.append({
                "type": "mover",
                "severity": "warning",
                "driver": drv,
                "message": f"📉 {drv} dropped {abs(gained)} places from P{grid_pos} → P{current_pos}",
                "confidence": min(0.95, 0.7 + abs(gained) * 0.05),
                "lap": target_lap,
            })

    return insights


class RuleBasedInsightEngine:
    """Rule-based insight generator. Can be swapped for LLM-based later."""

    def generate(self, session: fastf1.core.Session, at_lap: Optional[int] = None) -> list[dict]:
        insights = []
        insights.extend(_detect_tyre_degradation(session, at_lap))
        insights.extend(_detect_pace_drop(session, at_lap))
        insights.extend(_detect_undercut_opportunity(session, at_lap))
        insights.extend(_detect_pit_stop_suggestion(session, at_lap))
        insights.extend(_detect_strong_laps(session, at_lap))
        insights.extend(_detect_position_changes(session, at_lap))

        # Sort by confidence descending
        insights.sort(key=lambda x: x.get("confidence", 0), reverse=True)
        return insights


# Default engine — replace with LLMInsightEngine later
insight_engine = RuleBasedInsightEngine()
