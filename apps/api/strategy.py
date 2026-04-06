"""Strategy simulator — basic heuristic pit stop model."""

import pandas as pd
import fastf1
from typing import Optional


def simulate_strategy(
    session: fastf1.core.Session,
    driver: str,
    pit_lap: int,
    new_compound: str = "MEDIUM",
) -> dict:
    """
    Simulate a pit stop strategy for a driver.

    Given a pit lap, estimate the projected position and time impact.
    Uses actual race data to compute a realistic estimate.
    """
    laps = session.laps
    drv_laps = laps.pick_drivers(driver)

    if drv_laps.empty:
        return {"error": f"No data for driver {driver}"}

    total_laps = int(drv_laps["LapNumber"].max())
    if pit_lap < 1 or pit_lap > total_laps:
        return {"error": f"Pit lap must be between 1 and {total_laps}"}

    # Get clean laps before pit stop
    pre_pit = drv_laps[drv_laps["LapNumber"] < pit_lap]
    pre_pit_clean = pre_pit[pre_pit["LapTime"].notna()]
    pre_pit_clean = pre_pit_clean[~pre_pit_clean["PitOutTime"].notna()]
    pre_pit_clean = pre_pit_clean[~pre_pit_clean["PitInTime"].notna()]

    if pre_pit_clean.empty:
        return {"error": "Not enough data before pit lap"}

    # Estimate pace on old tyres (last 3 clean laps)
    old_pace = pre_pit_clean.tail(3)["LapTime"].apply(
        lambda x: x.total_seconds() if pd.notna(x) else None
    ).dropna().mean()

    # Pit stop loss (typical ~22-25 seconds)
    pit_stop_loss = 23.0

    # New tyre pace advantage by compound
    compound_delta = {
        "SOFT": -1.5,   # 1.5s faster but degrades fast
        "MEDIUM": -0.8,  # Good balance
        "HARD": -0.2,    # Slight improvement, long lasting
    }
    pace_improvement = compound_delta.get(new_compound.upper(), -0.8)

    # Degradation rate by compound (seconds per lap)
    compound_degradation = {
        "SOFT": 0.12,
        "MEDIUM": 0.06,
        "HARD": 0.03,
    }
    deg_rate = compound_degradation.get(new_compound.upper(), 0.06)

    # Simulate remaining laps
    remaining_laps = total_laps - pit_lap
    new_pace_base = old_pace + pace_improvement

    # Calculate time for remaining laps with new tyres + degradation
    new_strategy_time = pit_stop_loss
    for lap_on_tyre in range(1, remaining_laps + 1):
        lap_time = new_pace_base + (deg_rate * lap_on_tyre)
        new_strategy_time += lap_time

    # Calculate time for remaining laps on current tyres (with increasing deg)
    current_tyre_life = int(pre_pit_clean.iloc[-1].get("TyreLife", 15)) if pd.notna(pre_pit_clean.iloc[-1].get("TyreLife")) else 15
    old_deg_rate = 0.08  # Assumed average
    old_strategy_time = 0.0
    for lap_extra in range(1, remaining_laps + 1):
        lap_time = old_pace + (old_deg_rate * (current_tyre_life + lap_extra) * 0.05)
        old_strategy_time += lap_time

    time_delta = new_strategy_time - old_strategy_time

    # Estimate position change based on gaps to nearby drivers
    all_drivers = laps["Driver"].unique()
    position_at_pit = int(drv_laps[drv_laps["LapNumber"] == pit_lap - 1].iloc[0]["Position"]) \
        if not drv_laps[drv_laps["LapNumber"] == pit_lap - 1].empty \
        and pd.notna(drv_laps[drv_laps["LapNumber"] == pit_lap - 1].iloc[0].get("Position")) \
        else 10

    # Simple heuristic: pit stop costs ~1-2 positions, but fresh tyres gain them back
    positions_lost_in_pit = 2
    positions_gained_later = max(0, int(-time_delta / 3))  # Rough: gain 1 pos per 3s advantage
    projected_position = max(1, position_at_pit + positions_lost_in_pit - positions_gained_later)

    return {
        "driver": driver,
        "pit_lap": pit_lap,
        "new_compound": new_compound.upper(),
        "total_laps": total_laps,
        "remaining_laps": remaining_laps,
        "pit_stop_loss": pit_stop_loss,
        "old_pace_avg": round(old_pace, 3),
        "new_pace_base": round(new_pace_base, 3),
        "time_delta_vs_no_stop": round(time_delta, 3),
        "projected_position": projected_position,
        "current_position": position_at_pit,
        "recommendation": "PIT" if time_delta < -2 else "STAY OUT" if time_delta > 2 else "MARGINAL",
        "explanation": _build_explanation(driver, pit_lap, new_compound, time_delta, projected_position, position_at_pit),
    }


def _build_explanation(driver, pit_lap, compound, time_delta, proj_pos, curr_pos) -> str:
    if time_delta < -5:
        return f"Strong recommendation to pit {driver} on lap {pit_lap} for {compound}s. Expected to gain {round(-time_delta, 1)}s over remaining laps. Projected P{proj_pos} from P{curr_pos}."
    elif time_delta < -2:
        return f"Pitting {driver} on lap {pit_lap} for {compound}s is favorable. Expected to gain {round(-time_delta, 1)}s. Projected P{proj_pos}."
    elif time_delta < 2:
        return f"Marginal call for {driver}. Time delta is only {round(abs(time_delta), 1)}s. Could go either way."
    else:
        return f"Staying out is preferred for {driver}. Pitting would cost {round(time_delta, 1)}s overall."
