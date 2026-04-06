"""YouTube highlight search via yt-dlp + Anthropic fallback.

Strategy:
1. yt-dlp ytsearch (fast, no API key, reliable)
2. Anthropic Claude fallback (asks for a real video ID, validates via thumbnail)
"""

import logging
import asyncio
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


def _search_ytdlp(query: str, max_results: int = 5) -> list[dict]:
    """Search YouTube via yt-dlp (extract_flat — metadata only, no download)."""
    try:
        import yt_dlp
    except ImportError:
        logger.warning("yt-dlp not installed — skipping")
        return []

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": True,
        "skip_download": True,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            result = ydl.extract_info(
                f"ytsearch{max_results}:{query}", download=False
            )
            entries = result.get("entries", []) if result else []
            return [
                {
                    "videoId": e["id"],
                    "title": e.get("title", ""),
                    "thumbnail": f"https://i.ytimg.com/vi/{e['id']}/mqdefault.jpg",
                    "lengthSeconds": int(e.get("duration") or 0),
                    "viewCount": int(e.get("view_count") or 0),
                }
                for e in entries
                if e.get("id")
            ]
    except Exception as exc:
        logger.error("yt-dlp search failed: %s", exc)
        return []


async def _validate_video_id(video_id: str) -> bool:
    """Quick check: does this YouTube video ID actually exist?"""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            # oEmbed returns 200 for valid videos, 4xx for invalid
            resp = await client.get(
                f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
            )
            return resp.status_code == 200
    except Exception:
        return False


async def _search_anthropic(year: int, gp_name: str) -> list[dict]:
    """Ask Claude for the official F1 YouTube highlight video ID."""
    try:
        import os
        from anthropic import Anthropic

        api_key = os.getenv("ANTHROPIC_API_KEY", "")
        if not api_key:
            return []

        client = Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=100,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"What is the YouTube video ID (the 11-character alphanumeric code from the URL) "
                        f"for the official Formula 1 channel's race highlights video of the {year} {gp_name} Grand Prix? "
                        f"Reply with ONLY the 11-character video ID. If unsure, reply UNKNOWN."
                    ),
                }
            ],
        )
        reply = response.content[0].text.strip()

        # Validate format
        if len(reply) == 11 and reply != "UNKNOWN" and reply.replace("-", "").replace("_", "").isalnum():
            # Validate the video actually exists
            if await _validate_video_id(reply):
                return [
                    {
                        "videoId": reply,
                        "title": f"{year} {gp_name} Grand Prix — Race Highlights",
                        "thumbnail": f"https://i.ytimg.com/vi/{reply}/mqdefault.jpg",
                        "lengthSeconds": 0,
                        "viewCount": 0,
                    }
                ]
        return []
    except Exception as exc:
        logger.error("Anthropic highlight search failed: %s", exc)
        return []


async def search_highlights(year: int, gp_name: str) -> list[dict]:
    """Search for F1 race highlights. yt-dlp first, Anthropic fallback."""
    query = f"F1 {year} {gp_name} Grand Prix race highlights official"

    # 1. Try yt-dlp (runs in thread to avoid blocking)
    results = await asyncio.to_thread(_search_ytdlp, query, 5)
    if results:
        return results

    # 2. Anthropic fallback
    results = await _search_anthropic(year, gp_name)
    if results:
        return results

    return []


# ─── Direct stream URL extraction (for in-app video playback) ────────

import time

# Cache: videoId -> (direct_url, expire_timestamp)
_stream_cache: dict[str, tuple[str, float]] = {}
_CACHE_TTL = 3 * 3600  # 3 hours (googlevideo URLs last ~6h)


def _extract_stream_url(video_id: str) -> Optional[str]:
    """Extract a direct MP4 stream URL from YouTube via yt-dlp."""
    try:
        import yt_dlp
    except ImportError:
        logger.warning("yt-dlp not installed")
        return None

    ydl_opts = {
        "format": "best[height<=720][ext=mp4]/best[height<=480][ext=mp4]/best[ext=mp4]",
        "quiet": True,
        "no_warnings": True,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(
                f"https://www.youtube.com/watch?v={video_id}", download=False
            )
            return info.get("url")
    except Exception as exc:
        logger.error("yt-dlp stream extraction failed for %s: %s", video_id, exc)
        return None


async def get_stream_url(video_id: str) -> Optional[str]:
    """Get a direct stream URL, using cache when available."""
    now = time.time()

    # Check cache
    if video_id in _stream_cache:
        url, expires = _stream_cache[video_id]
        if now < expires:
            return url

    # Extract fresh URL
    url = await asyncio.to_thread(_extract_stream_url, video_id)
    if url:
        _stream_cache[video_id] = (url, now + _CACHE_TTL)
    return url
