"""AI Insights Engine — Claude-powered F1 race analysis + interactive chat.

Uses Anthropic's Claude API for enhanced race insights and natural language
interaction about race data. Falls back to rule-based insights if API unavailable.
"""

import os
import json
import logging
from typing import Optional

import fastf1
from anthropic import Anthropic, APIError

logger = logging.getLogger(__name__)

_client: Optional[Anthropic] = None


def _get_client() -> Optional[Anthropic]:
    """Lazy-init Anthropic client."""
    global _client
    if _client is not None:
        return _client
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        logger.warning("ANTHROPIC_API_KEY not set — AI features disabled")
        return None
    _client = Anthropic(api_key=api_key)
    return _client


def _build_race_context(session: fastf1.core.Session, at_lap: Optional[int] = None) -> str:
    """Build a compact text summary of current race state for Claude."""
    laps = session.laps
    info = []

    info.append(f"Race: {session.event['EventName']} {session.event.year}")
    info.append(f"Circuit: {session.event['Location']}")

    if at_lap:
        info.append(f"Current Lap: {at_lap}/{int(laps['LapNumber'].max())}")
    else:
        info.append(f"Total Laps: {int(laps['LapNumber'].max())}")

    # Build leaderboard snapshot
    if at_lap:
        lap_data = laps[laps["LapNumber"] == at_lap]
    else:
        last_lap = int(laps["LapNumber"].max())
        lap_data = laps[laps["LapNumber"] == last_lap]

    if not lap_data.empty:
        info.append("\nLeaderboard:")
        lap_data = lap_data.sort_values("Position")
        for _, row in lap_data.head(10).iterrows():
            drv = row.get("Driver", "?")
            pos = row.get("Position", "?")
            compound = row.get("Compound", "?")
            tyre_life = row.get("TyreLife", "?")
            lt = row.get("LapTime")
            lt_str = f"{lt.total_seconds():.3f}s" if hasattr(lt, "total_seconds") else "N/A"
            info.append(f"  P{int(pos) if pos == pos else '?'} {drv} — {lt_str} | {compound} (age {int(tyre_life) if tyre_life == tyre_life else '?'})")

    return "\n".join(info)


SYSTEM_PROMPT = """You are an expert F1 race engineer and strategist embedded in a real-time race intelligence dashboard.

Your role:
- Analyze live race data and provide tactical insights
- Identify strategy opportunities (undercuts, overcuts, pit windows)
- Detect tyre degradation trends and recommend pit stops
- Spot battles developing and predict outcomes
- Explain complex racing situations in clear, broadcast-quality language

Guidelines:
- Be concise and data-driven — this is a live dashboard, not an article
- Use F1 terminology naturally (DRS, undercut, dirty air, tyre cliff, etc.)
- Format insights as short paragraphs or bullet points
- Reference specific drivers, positions, and lap numbers
- Express confidence levels when making predictions
- Use plain text only — no markdown or HTML formatting
"""


async def generate_ai_insights(
    session: fastf1.core.Session,
    at_lap: Optional[int] = None,
    rule_insights: Optional[list[dict]] = None,
) -> list[dict]:
    """Generate Claude-enhanced insights, enriching rule-based analysis."""
    client = _get_client()
    if not client:
        return rule_insights or []

    context = _build_race_context(session, at_lap)

    # Include rule-based insights as input for Claude to enhance
    rules_summary = ""
    if rule_insights:
        rules_summary = "\n\nDetected patterns:\n" + "\n".join(
            f"- {i['message']}" for i in rule_insights[:5]
        )

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=600,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": f"Analyze the current race state and provide 2-3 tactical insights.\n\n{context}{rules_summary}",
                }
            ],
        )

        ai_text = response.content[0].text
        # Parse into structured insights
        ai_insights = []
        for i, paragraph in enumerate(ai_text.strip().split("\n\n")):
            paragraph = paragraph.strip()
            if not paragraph:
                continue
            ai_insights.append({
                "type": "ai_analysis",
                "severity": "info",
                "driver": "",
                "message": f"🤖 {paragraph}",
                "confidence": 0.85,
                "lap": at_lap or 0,
                "source": "claude",
            })

        # Combine: rule-based first, then AI
        combined = (rule_insights or []) + ai_insights
        return combined

    except APIError as e:
        logger.error("Claude API error: %s", e)
        return rule_insights or []
    except Exception as e:
        logger.error("AI insight generation failed: %s", e)
        return rule_insights or []


async def chat_with_ai(
    question: str,
    session: fastf1.core.Session,
    at_lap: Optional[int] = None,
    history: Optional[list[dict]] = None,
) -> str:
    """Interactive AI chat about the race."""
    client = _get_client()
    if not client:
        return "AI chat unavailable — ANTHROPIC_API_KEY not configured."

    context = _build_race_context(session, at_lap)

    messages = []

    # Add conversation history (last 10 exchanges max)
    if history:
        for msg in history[-20:]:
            messages.append({
                "role": msg["role"],
                "content": msg["content"],
            })

    messages.append({
        "role": "user",
        "content": f"Race context:\n{context}\n\nUser question: {question}",
    })

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=400,
            system=SYSTEM_PROMPT + "\n\nYou are in interactive chat mode. Answer the user's question about the current race concisely.",
            messages=messages,
        )
        return response.content[0].text
    except APIError as e:
        logger.error("Claude chat error: %s", e)
        return f"AI temporarily unavailable. Please try again."
    except Exception as e:
        logger.error("Chat failed: %s", e)
        return "Something went wrong. Please try again."
