"""YouTube highlight search — YouTube Data API v3 (embeddable only) + fallbacks.

Strategy:
1. YouTube Data API v3 — free, 10k quota/day, filters for embeddable videos
2. yt-dlp ytsearch fallback (no API key needed)
3. Anthropic Claude fallback (asks for a real video ID, validates via oEmbed)

Results are cached in-memory for 1 hour to minimize API quota usage.
"""

import logging
import asyncio
import time
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# ─── In-memory cache ─────────────────────────────────────────────────
_search_cache: dict[str, tuple[list[dict], float]] = {}
_SEARCH_CACHE_TTL = 3600  # 1 hour


def _get_cached(key: str) -> list[dict] | None:
    if key in _search_cache:
        results, expires = _search_cache[key]
        if time.time() < expires:
            return results
        del _search_cache[key]
    return None


def _set_cached(key: str, results: list[dict]) -> None:
    _search_cache[key] = (results, time.time() + _SEARCH_CACHE_TTL)


# ─── 1. YouTube Data API v3 ─────────────────────────────────────────

async def _search_youtube_api(query: str, max_results: int = 5) -> list[dict]:
    """Search via YouTube Data API v3 — only returns embeddable videos."""
    import os
    api_key = os.getenv("YOUTUBE_API_KEY", "")
    if not api_key:
        logger.info("No YOUTUBE_API_KEY set — skipping YouTube Data API")
        return []

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://www.googleapis.com/youtube/v3/search",
                params={
                    "part": "snippet",
                    "q": query,
                    "type": "video",
                    "videoEmbeddable": "true",
                    "maxResults": max_results,
                    "order": "relevance",
                    "key": api_key,
                },
            )
            resp.raise_for_status()
            data = resp.json()

            results = []
            for item in data.get("items", []):
                vid = item["id"].get("videoId")
                snippet = item.get("snippet", {})
                if vid:
                    results.append({
                        "videoId": vid,
                        "title": snippet.get("title", ""),
                        "thumbnail": snippet.get("thumbnails", {}).get("medium", {}).get("url",
                            f"https://i.ytimg.com/vi/{vid}/mqdefault.jpg"),
                        "channelTitle": snippet.get("channelTitle", ""),
                        "lengthSeconds": 0,
                        "viewCount": 0,
                    })
            return results
    except Exception as exc:
        logger.error("YouTube Data API search failed: %s", exc)
        return []


# ─── 2. yt-dlp fallback ─────────────────────────────────────────────

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


# ─── 3. Anthropic fallback ───────────────────────────────────────────

async def _validate_video_id(video_id: str) -> bool:
    """Quick check: does this YouTube video ID actually exist?"""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
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

        if len(reply) == 11 and reply != "UNKNOWN" and reply.replace("-", "").replace("_", "").isalnum():
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


# ─── Main search function ────────────────────────────────────────────

async def search_highlights(year: int, gp_name: str) -> list[dict]:
    """Search for embeddable F1 race highlights. Cached for 1 hour."""
    cache_key = f"{year}-{gp_name.lower().strip()}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    query = f"F1 {year} {gp_name} Grand Prix race highlights"

    # 1. YouTube Data API v3 (embeddable filter)
    results = await _search_youtube_api(query, 5)
    if results:
        _set_cached(cache_key, results)
        return results

    # 2. yt-dlp fallback
    results = await asyncio.to_thread(_search_ytdlp, query, 5)
    if results:
        _set_cached(cache_key, results)
        return results

    # 3. Anthropic fallback
    results = await _search_anthropic(year, gp_name)
    if results:
        _set_cached(cache_key, results)
        return results

    return []


# ─── Stream URL (kept for backwards compat) ──────────────────────────

_stream_cache: dict[str, tuple[str, float]] = {}
_STREAM_CACHE_TTL = 3 * 3600


def _extract_stream_url(video_id: str) -> Optional[str]:
    try:
        import yt_dlp
    except ImportError:
        return None
    ydl_opts = {
        "format": "best[height<=720][ext=mp4]/best[height<=480][ext=mp4]/best[ext=mp4]",
        "quiet": True,
        "no_warnings": True,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
            return info.get("url")
    except Exception as exc:
        logger.error("yt-dlp stream extraction failed for %s: %s", video_id, exc)
        return None


async def get_stream_url(video_id: str) -> Optional[str]:
    now = time.time()
    if video_id in _stream_cache:
        url, expires = _stream_cache[video_id]
        if now < expires:
            return url
    url = await asyncio.to_thread(_extract_stream_url, video_id)
    if url:
        _stream_cache[video_id] = (url, now + _STREAM_CACHE_TTL)
    return url
