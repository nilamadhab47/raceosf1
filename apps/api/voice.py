"""ElevenLabs voice synthesis service."""

import httpx
from config import settings


async def synthesize_speech(text: str, voice_id: str = "21m00Tcm4TlvDq8ikWAM") -> bytes | None:
    """
    Convert text to speech using ElevenLabs API.
    Returns audio bytes (mp3) or None if API key not configured.
    """
    if not settings.ELEVENLABS_API_KEY:
        return None

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "xi-api-key": settings.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }
    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
        },
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, json=payload, headers=headers)
        if response.status_code == 200:
            return response.content
        return None
