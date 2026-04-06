"""Race simulation — simulates live race progression using historical data."""

import asyncio
import time
from typing import Optional


class RaceSimulator:
    """Simulates a race by incrementing lap number over time."""

    def __init__(self):
        self.current_lap = 0
        self.total_laps = 0
        self.is_running = False
        self.speed = 3.0  # seconds per lap
        self._start_time: float = 0
        self._year: int = 2024
        self._gp: str = "Bahrain"

    def start(self, total_laps: int, speed: float = 3.0, year: int = 2024, gp: str = "Bahrain"):
        self.total_laps = total_laps
        self.speed = speed
        self.current_lap = 1
        self.is_running = True
        self._start_time = time.time()
        self._year = year
        self._gp = gp

    def stop(self):
        self.is_running = False

    def reset(self):
        self.current_lap = 0
        self.is_running = False

    def get_state(self) -> dict:
        if self.is_running:
            elapsed = time.time() - self._start_time
            self.current_lap = min(
                self.total_laps,
                max(1, int(elapsed / self.speed) + 1)
            )
            if self.current_lap >= self.total_laps:
                self.is_running = False

        return {
            "current_lap": self.current_lap,
            "total_laps": self.total_laps,
            "is_running": self.is_running,
            "speed": self.speed,
            "year": self._year,
            "gp": self._gp,
            "progress": round(self.current_lap / self.total_laps * 100, 1) if self.total_laps > 0 else 0,
        }


race_simulator = RaceSimulator()
