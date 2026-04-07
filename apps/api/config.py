import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


class Settings:
    FASTF1_CACHE_DIR: str = os.getenv("FASTF1_CACHE_DIR", "./cache")
    ELEVENLABS_API_KEY: str = os.getenv("ELEVENLABS_API_KEY", "")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    RAPIDAPI_KEY: str = os.getenv("RAPIDAPI_KEY", "")
    YOUTUBE_API_KEY: str = os.getenv("YOUTUBE_API_KEY", "")
    LIVE_MODE_ENABLED: bool = os.getenv("LIVE_MODE_ENABLED", "").lower() in ("true", "1", "yes")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
    API_PORT: int = int(os.getenv("API_PORT", "8000"))

    def __init__(self):
        Path(self.FASTF1_CACHE_DIR).mkdir(parents=True, exist_ok=True)


settings = Settings()
