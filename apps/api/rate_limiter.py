"""Sliding-window rate limiter for external API calls.

Tracks timestamps of requests in a deque and enforces a max-requests-per-window
policy. Thread-safe via asyncio lock.
"""

import asyncio
import time
from collections import deque


class RateLimiter:
    """Token-bucket-style rate limiter using a sliding time window."""

    def __init__(self, max_requests: int = 18, window_seconds: float = 60.0):
        self.max_requests = max_requests
        self.window = window_seconds
        self._timestamps: deque[float] = deque()
        self._lock = asyncio.Lock()

    def _prune(self):
        """Remove timestamps older than the window."""
        cutoff = time.monotonic() - self.window
        while self._timestamps and self._timestamps[0] < cutoff:
            self._timestamps.popleft()

    async def acquire(self) -> bool:
        """Try to consume one request slot. Returns True if allowed."""
        async with self._lock:
            self._prune()
            if len(self._timestamps) < self.max_requests:
                self._timestamps.append(time.monotonic())
                return True
            return False

    @property
    def status(self) -> dict:
        """Current rate limit status (non-async, best-effort)."""
        self._prune()
        used = len(self._timestamps)
        return {
            "used": used,
            "remaining": max(0, self.max_requests - used),
            "limit": self.max_requests,
            "window_seconds": self.window,
        }
