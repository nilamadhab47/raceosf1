import type {
  SessionInfo,
  Driver,
  LapData,
  TelemetryData,
  LeaderboardEntry,
  Insight,
  StrategyResult,
  LiveState,
  AvailableSession,
  WeatherData,
  TrackMapData,
  DriverPosition,
  RateLimitStatus,
  ModeInfo,
  DriverStints,
  GapEvolutionData,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const DEFAULT_TIMEOUT = 30_000;  // 30 seconds
const LONG_TIMEOUT = 90_000;    // 90 seconds (session load on cold start)

async function fetchJSON<T>(
  path: string,
  options?: RequestInit & { timeout?: number },
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, ...init } = options ?? {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `API error: ${res.status}`);
    }
    return res.json();
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("Request timed out — check your connection and try again");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  // Session
  getSession: () => fetchJSON<SessionInfo>("/api/session"),
  loadSession: (year: number, gp: string, sessionType = "R") =>
    fetchJSON<SessionInfo>(
      `/api/session/load?year=${year}&gp=${encodeURIComponent(gp)}&session_type=${sessionType}`,
      { method: "POST", timeout: LONG_TIMEOUT }
    ),
  getAvailableSessions: () => fetchJSON<AvailableSession[]>("/api/available-sessions"),

  // Drivers
  getDrivers: () => fetchJSON<Driver[]>("/api/drivers"),

  // Laps
  getLaps: (driver?: string) =>
    fetchJSON<LapData[]>(driver ? `/api/laps?driver=${driver}` : "/api/laps"),

  // Telemetry
  getTelemetry: (driver: string, lap: number) =>
    fetchJSON<TelemetryData>(`/api/telemetry?driver=${driver}&lap=${lap}`),

  // Leaderboard
  getLeaderboard: (lap?: number) =>
    fetchJSON<LeaderboardEntry[]>(lap != null ? `/api/leaderboard?lap=${lap}` : "/api/leaderboard"),

  // Weather
  getWeather: () => fetchJSON<WeatherData[]>("/api/weather"),

  // Race Control
  getRaceControl: (lap?: number) =>
    fetchJSON<{ flag: string; race_control: any[] }>(
      lap != null ? `/api/race-control?lap=${lap}` : "/api/race-control"
    ),

  // Insights
  getInsights: (lap?: number) =>
    fetchJSON<Insight[]>(lap != null ? `/api/insights?lap=${lap}` : "/api/insights"),

  // Strategy
  simulateStrategy: (driver: string, pitLap: number, compound: string) =>
    fetchJSON<StrategyResult>("/api/simulate-strategy", {
      method: "POST",
      body: JSON.stringify({ driver, pit_lap: pitLap, compound }),
    }),

  // Live simulation
  getLive: () => fetchJSON<LiveState>("/api/live"),
  startLive: (speed = 3.0) =>
    fetchJSON<LiveState>(`/api/live/start?speed=${speed}`, { method: "POST" }),
  stopLive: () => fetchJSON<LiveState>("/api/live/stop", { method: "POST" }),
  resetLive: () => fetchJSON<LiveState>("/api/live/reset", { method: "POST" }),

  // Voice
  synthesizeSpeech: async (text: string): Promise<Blob | null> => {
    const res = await fetch(`${API_BASE}/api/voice/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return null;
    return res.blob();
  },

  // Track map
  getTrackMap: () => fetchJSON<TrackMapData>("/api/track-map"),
  getDriverPositions: (lap: number) => fetchJSON<DriverPosition[]>(`/api/driver-positions?lap=${lap}`),

  // Session / telemetry loading status
  getSessionStatus: () =>
    fetchJSON<{ session_loaded: boolean; telemetry_loaded: boolean; telemetry_loading: boolean }>("/api/session/status"),

  // AI
  getAIInsights: (lap?: number) =>
    fetchJSON<Insight[]>(lap != null ? `/api/ai/insights?lap=${lap}` : "/api/ai/insights"),
  chatWithAI: (question: string, history?: { role: string; content: string }[], lap?: number) =>
    fetchJSON<{ reply: string }>(
      `/api/ai/chat${lap != null ? `?lap=${lap}` : ""}`,
      {
        method: "POST",
        body: JSON.stringify({ question, history }),
      }
    ),

  // YouTube Highlights
  searchHighlights: (year: number, gp: string) =>
    fetchJSON<{ results: { videoId: string; title: string; thumbnail: string; lengthSeconds: number; viewCount: number }[] }>(
      `/api/highlights/search?year=${year}&gp=${encodeURIComponent(gp)}`
    ),

  // Direct video stream URL (302 redirect to CDN)
  getStreamUrl: (videoId: string) =>
    `${API_BASE}/api/highlights/stream?v=${encodeURIComponent(videoId)}`,

  // Health
  health: () => fetchJSON<{ status: string }>("/api/health"),

  // Mode & Rate Limit
  getMode: () => fetchJSON<ModeInfo>("/api/mode"),
  setMode: (mode: "simulation" | "live") =>
    fetchJSON<ModeInfo>(`/api/mode?mode=${mode}`, { method: "POST" }),
  getRateLimit: () => fetchJSON<RateLimitStatus>("/api/rate-limit"),

  // Stints
  getStints: () => fetchJSON<DriverStints[]>("/api/stints"),

  // Gap Evolution
  getGapEvolution: (topN: number = 5) =>
    fetchJSON<GapEvolutionData>(`/api/gap-evolution?top_n=${topN}`),

  // ─── OpenF1 Free API ───────────────────────────────────────────────
  openf1: {
    getSessions: (year: number = 2025) =>
      fetchJSON<any[]>(`/api/openf1/sessions?year=${year}`),
    getLatestSession: () => fetchJSON<any>("/api/openf1/latest-session"),
    getDrivers: (sessionKey: string = "latest") =>
      fetchJSON<any[]>(`/api/openf1/drivers?session_key=${sessionKey}`),
    getPositions: (sessionKey: string = "latest") =>
      fetchJSON<any[]>(`/api/openf1/positions?session_key=${sessionKey}`),
    getLaps: (sessionKey: string = "latest", driverNumber?: number) =>
      fetchJSON<any[]>(
        `/api/openf1/laps?session_key=${sessionKey}${driverNumber ? `&driver_number=${driverNumber}` : ""}`
      ),
    getRaceControl: (sessionKey: string = "latest") =>
      fetchJSON<any[]>(`/api/openf1/race-control?session_key=${sessionKey}`),
    getWeather: (sessionKey: string = "latest") =>
      fetchJSON<any[]>(`/api/openf1/weather?session_key=${sessionKey}`),
    getIntervals: (sessionKey: string = "latest") =>
      fetchJSON<any[]>(`/api/openf1/intervals?session_key=${sessionKey}`),
    getTeamRadio: (sessionKey: string = "latest", driverNumber?: number) =>
      fetchJSON<any[]>(
        `/api/openf1/team-radio?session_key=${sessionKey}${driverNumber ? `&driver_number=${driverNumber}` : ""}`
      ),
  },

  // ─── Database-backed data ─────────────────────────────────────────
  db: {
    syncSession: (year: number, gp: string) =>
      fetchJSON<{ session_id: number; status: string }>(
        `/api/db/sync-session?year=${year}&gp=${encodeURIComponent(gp)}`,
        { method: "POST" }
      ),
    syncSeason: (year: number) =>
      fetchJSON<{ year: number; sessions_synced: number }>(
        `/api/db/sync-season?year=${year}`,
        { method: "POST" }
      ),
    syncLatest: () =>
      fetchJSON<{ session_id: number | null; status: string }>(
        "/api/db/sync-latest",
        { method: "POST" }
      ),
    getSessions: (year?: number) =>
      fetchJSON<any[]>(year ? `/api/db/sessions?year=${year}` : "/api/db/sessions"),
    getDrivers: (sessionId: number) =>
      fetchJSON<any[]>(`/api/db/session/${sessionId}/drivers`),
    getLeaderboard: (sessionId: number, lap: number = 0) =>
      fetchJSON<any[]>(`/api/db/session/${sessionId}/leaderboard?lap=${lap}`),
    getLaps: (sessionId: number, driver?: string) =>
      fetchJSON<any[]>(
        `/api/db/session/${sessionId}/laps${driver ? `?driver=${driver}` : ""}`
      ),
    getStints: (sessionId: number) =>
      fetchJSON<any[]>(`/api/db/session/${sessionId}/stints`),
    getRaceControl: (sessionId: number, lap?: number) =>
      fetchJSON<any[]>(
        `/api/db/session/${sessionId}/race-control${lap ? `?lap=${lap}` : ""}`
      ),
    getWeather: (sessionId: number) =>
      fetchJSON<any[]>(`/api/db/session/${sessionId}/weather`),
    getPitStops: (sessionId: number) =>
      fetchJSON<any[]>(`/api/db/session/${sessionId}/pit-stops`),
    hasData: (year: number, gp: string) =>
      fetchJSON<{ has_data: boolean }>(
        `/api/db/has-data?year=${year}&gp=${encodeURIComponent(gp)}`
      ),
  },
};
