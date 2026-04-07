/**
 * YouTube race highlight mappings.
 *
 * Maps known Grand Prix to official F1 YouTube highlight videos
 * with approximate lap-based event timestamps.
 *
 * Video IDs point to official Formula 1 YouTube channel race highlights.
 */

import type { VideoEvent } from "@/components/WorldMonitor/YouTubeOverlay";
import { api } from "@/lib/api";

interface RaceHighlights {
  videoId: string;
  events: Omit<VideoEvent, "videoId">[];
}

// Key format: "YEAR-circuit_name" (lowercase, spaces → underscores)
const HIGHLIGHTS_DB: Record<string, RaceHighlights> = {
  "2024-bahrain": {
    videoId: "6M4dJJFmRiA",
    events: [
      { lap: 1, event: "start", label: "Race Start — Lights Out in Bahrain", timestamp: 45 },
      { lap: 15, event: "pit_stop", label: "First pit window opens — Soft to Hards", timestamp: 180 },
      { lap: 20, event: "overtake", label: "Mid-race battles for position", timestamp: 300 },
      { lap: 38, event: "pit_stop", label: "Second stint undercut attempts", timestamp: 420 },
      { lap: 50, event: "highlight", label: "Final stint race to the finish", timestamp: 540 },
      { lap: 57, event: "finish", label: "Verstappen takes the checkered flag", timestamp: 660 },
    ],
  },
  "2024-jeddah": {
    videoId: "bTcSNdQ9qSA",
    events: [
      { lap: 1, event: "start", label: "Race Start — Saudi Arabian Grand Prix", timestamp: 30 },
      { lap: 18, event: "pit_stop", label: "First pit stops commence", timestamp: 180 },
      { lap: 35, event: "overtake", label: "Key overtakes through the field", timestamp: 360 },
      { lap: 50, event: "finish", label: "Race finish at Jeddah", timestamp: 540 },
    ],
  },
  "2024-miami": {
    videoId: "WmVMdQGJfDc",
    events: [
      { lap: 1, event: "start", label: "Race Start — Miami Grand Prix", timestamp: 30 },
      { lap: 10, event: "highlight", label: "Norris makes his move", timestamp: 150 },
      { lap: 25, event: "pit_stop", label: "Strategic pit window", timestamp: 300 },
      { lap: 45, event: "overtake", label: "Late-race battles", timestamp: 480 },
      { lap: 57, event: "finish", label: "Norris wins his maiden race", timestamp: 600 },
    ],
  },
  "2024-monaco": {
    videoId: "NJCqHyJlPU4",
    events: [
      { lap: 1, event: "start", label: "Race Start in Monte Carlo", timestamp: 30 },
      { lap: 20, event: "highlight", label: "Tight battles on the streets", timestamp: 200 },
      { lap: 55, event: "pit_stop", label: "Late pit stop drama", timestamp: 420 },
      { lap: 78, event: "finish", label: "Leclerc wins at home", timestamp: 600 },
    ],
  },
  "2024-silverstone": {
    videoId: "e0t6_6FklmQ",
    events: [
      { lap: 1, event: "start", label: "Race Start — British Grand Prix", timestamp: 30 },
      { lap: 15, event: "highlight", label: "Rain begins to fall", timestamp: 180 },
      { lap: 35, event: "pit_stop", label: "Tyre strategy chaos in the wet", timestamp: 360 },
      { lap: 52, event: "finish", label: "Hamilton wins at Silverstone", timestamp: 540 },
    ],
  },
  "2024-spa": {
    videoId: "MIhsJnmW_yU",
    events: [
      { lap: 1, event: "start", label: "Race Start — Belgian Grand Prix", timestamp: 30 },
      { lap: 10, event: "overtake", label: "DRS battles down Kemmel", timestamp: 120 },
      { lap: 30, event: "pit_stop", label: "Undercut attempts", timestamp: 300 },
      { lap: 44, event: "finish", label: "Race finish at Spa", timestamp: 480 },
    ],
  },
};

/**
 * Resolve YouTube highlight events for a given session.
 * Returns an array of VideoEvent objects for the YouTubeOverlay component.
 *
 * @param year  - e.g., 2024
 * @param circuit - circuit name from backend (e.g., "Bahrain", "Miami International Autodrome")
 */
export function getVideoEvents(year: number, circuit: string): VideoEvent[] {
  // Normalize circuit name to match our DB keys
  const normalized = circuit
    .toLowerCase()
    .replace(/international|autodrome|circuit|grand prix|de |of /gi, "")
    .trim()
    .replace(/\s+/g, "_");

  // Try exact match first, then partial matches
  const key = `${year}-${normalized}`;
  let entry = HIGHLIGHTS_DB[key];

  if (!entry) {
    // Try partial match
    const partial = Object.entries(HIGHLIGHTS_DB).find(([k]) => {
      const parts = k.split("-");
      return parts[0] === String(year) && normalized.includes(parts[1]);
    });
    if (partial) entry = partial[1];
  }

  if (!entry) {
    // Try matching just by circuit keyword
    const circuitLower = circuit.toLowerCase();
    const match = Object.entries(HIGHLIGHTS_DB).find(([k]) => {
      const parts = k.split("-");
      return parts[0] === String(year) && circuitLower.includes(parts[1]);
    });
    if (match) entry = match[1];
  }

  if (!entry) return [];

  return entry.events.map((e) => ({
    ...e,
    videoId: entry!.videoId,
  }));
}

/* ── YouTube Search via Invidious (free, no API key) ──────────────── */

export interface YouTubeResult {
  videoId: string;
  title: string;
  thumbnail: string;
  lengthSeconds: number;
  viewCount: number;
}

/**
 * Get highlights from the static DB as YouTubeResult[].
 * Works offline and for known races.
 */
export function getStaticHighlights(year: number, circuit: string): YouTubeResult[] {
  const normalized = circuit
    .toLowerCase()
    .replace(/international|autodrome|circuit|grand prix|de |of /gi, "")
    .trim()
    .replace(/\s+/g, "_");

  let entry: RaceHighlights | undefined;

  // Try exact match
  entry = HIGHLIGHTS_DB[`${year}-${normalized}`];

  // Try partial key match
  if (!entry) {
    const match = Object.entries(HIGHLIGHTS_DB).find(([k]) => {
      const parts = k.split("-");
      return parts[0] === String(year) && (normalized.includes(parts[1]) || parts[1].includes(normalized));
    });
    if (match) entry = match[1];
  }

  // Try keyword match
  if (!entry) {
    const circuitLower = circuit.toLowerCase();
    const match = Object.entries(HIGHLIGHTS_DB).find(([k]) => {
      const parts = k.split("-");
      return parts[0] === String(year) && circuitLower.includes(parts[1]);
    });
    if (match) entry = match[1];
  }

  if (!entry) return [];

  const firstEvent = entry.events[0];
  return [{
    videoId: entry.videoId,
    title: `${year} ${circuit} Grand Prix — Race Highlights`,
    thumbnail: `https://i.ytimg.com/vi/${entry.videoId}/mqdefault.jpg`,
    lengthSeconds: firstEvent ? Math.max(...entry.events.map(e => e.timestamp)) : 0,
    viewCount: 0,
  }];
}

/**
 * Search for F1 race highlights via backend (yt-dlp → Anthropic fallback).
 * This is the primary search method — calls our own /api/highlights/search endpoint.
 */
export async function searchYouTubeHighlights(
  year: number,
  gpName: string,
): Promise<YouTubeResult[]> {
  try {
    const data = await api.searchHighlights(year, gpName);
    if (data.results && data.results.length > 0) {
      return data.results;
    }
  } catch {
    // Backend unavailable — fall through
  }

  // Fallback to static DB
  return getStaticHighlights(year, gpName);
}
