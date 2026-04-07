"""ElevenLabs voice synthesis service."""

import httpx
from config import settings


async def synthesize_speech(text: str, voice_id: str = "EXAVITQu4vr4xnSDxMaL") -> bytes | None:
    """
    Convert text to speech using ElevenLabs API.
    Returns audio bytes (mp3) or None if API key not configured.

    Default voice: "Sarah" (EXAVITQu4vr4xnSDxMaL) — expressive, warm, energetic.
    Model: eleven_multilingual_v2 — latest, most natural & emotive.
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
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.15,
            "similarity_boost": 0.9,
            "style": 0.85,
            "use_speaker_boost": True,
        },
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            url, json=payload, headers=headers,
            params={"output_format": "mp3_44100_128"},
        )
        if response.status_code == 200:
            return response.content
        return None
