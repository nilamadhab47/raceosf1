"""Dailymotion F1 highlights search — free, no API key, embeddable.

Dailymotion's public Data API allows searching for videos and returns
embed-ready content. F1 highlights are widely available and embedding
is generally permitted.

API docs: https://developers.dailymotion.com/api/
"""

import logging
import httpx

logger = logging.getLogger(__name__)

DAILYMOTION_API = "https://api.dailymotion.com"


async def search_dailymotion(query: str, max_results: int = 5) -> list[dict]:
    """Search Dailymotion for videos. Returns normalized result dicts."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{DAILYMOTION_API}/videos",
                params={
                    "search": query,
                    "fields": "id,title,thumbnail_240_url,duration,views_total,owner.screenname",
                    "limit": max_results,
                    "sort": "relevance",
                    "longer_than": 1,  # at least 1 minute
                },
            )
            resp.raise_for_status()
            data = resp.json()

            results = []
            for item in data.get("list", []):
                vid_id = item.get("id")
                if not vid_id:
                    continue
                results.append({
                    "videoId": vid_id,
                    "title": item.get("title", ""),
                    "thumbnail": item.get("thumbnail_240_url", ""),
                    "channelTitle": item.get("owner.screenname", ""),
                    "lengthSeconds": int(item.get("duration") or 0),
                    "viewCount": int(item.get("views_total") or 0),
                    "platform": "dailymotion",
                    "embedUrl": f"https://www.dailymotion.com/embed/video/{vid_id}?autoplay=1&mute=1&quality=auto",
                    "watchUrl": f"https://www.dailymotion.com/video/{vid_id}",
                })
            return results
    except Exception as exc:
        logger.error("Dailymotion search failed: %s", exc)
        return []
