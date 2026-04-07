import { create } from "zustand";
import type {
  SessionInfo,
  Driver,
  LeaderboardEntry,
  Insight,
  LiveState,
  TelemetryData,
  DriverPosition,
  RateLimitStatus,
  FlagMode,
  RaceControlEvent,
} from "@/lib/types";
import { api } from "@/lib/api";

interface F1State {
  // Session
  session: SessionInfo | null;
  loading: boolean;
  error: string | null;

  // Drivers
  drivers: Driver[];

  // Leaderboard
  leaderboard: LeaderboardEntry[];

  // Telemetry
  telemetry1: TelemetryData | null;
  telemetry2: TelemetryData | null;
  selectedDriver1: string;
  selectedDriver2: string;
  selectedLap: number;

  // Insights
  insights: Insight[];

  // Live
  liveState: LiveState | null;

  // Driver Positions (from WebSocket or REST)
  positions: DriverPosition[];

  // WebSocket
  wsConnected: boolean;

  // Mode & Rate Limit
  mode: "simulation" | "live";
  liveAvailable: boolean;
  rateLimit: RateLimitStatus | null;

  // Flags & Race Control
  flagMode: FlagMode;
  raceControlMessages: RaceControlEvent[];

  // Voice
  voiceMuted: boolean;
  autoCommentary: boolean;

  // Focus
  focusedDriver: string | null;

  // AI Chat
  chatMessages: ChatMessage[];

  // Actions
  loadSession: (year: number, gp: string) => Promise<void>;
  fetchDrivers: () => Promise<void>;
  fetchLeaderboard: (lap?: number) => Promise<void>;
  fetchTelemetry: (driver: string, lap: number, slot: 1 | 2) => Promise<void>;
  fetchInsights: (lap?: number) => Promise<void>;
  fetchRaceControl: (lap?: number) => Promise<void>;
  fetchLiveState: () => Promise<void>;
  setSelectedDriver: (slot: 1 | 2, driver: string) => void;
  setSelectedLap: (lap: number) => void;
  setVoiceMuted: (muted: boolean) => void;
  setAutoCommentary: (auto: boolean) => void;
  setError: (error: string | null) => void;

  // WebSocket-driven setters
  setLeaderboard: (data: LeaderboardEntry[]) => void;
  setPositions: (data: DriverPosition[]) => void;
  setInsightsFromWS: (data: Insight[]) => void;
  setLiveState: (data: LiveState | null) => void;
  setWsConnected: (connected: boolean) => void;

  // Flags & Race Control
  setFlagMode: (flag: FlagMode) => void;
  setRaceControlMessages: (msgs: RaceControlEvent[]) => void;

  // AI Chat
  addChatMessage: (msg: ChatMessage) => void;
  clearChat: () => void;

  // Mode & Rate Limit
  setMode: (mode: "simulation" | "live") => void;
  setLiveAvailable: (available: boolean) => void;
  setRateLimit: (data: RateLimitStatus) => void;
  setFocusedDriver: (driver: string | null) => void;
  fetchMode: () => Promise<void>;
  fetchRateLimit: () => Promise<void>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export const useF1Store = create<F1State>((set, get) => ({
  session: null,
  loading: false,
  error: null,
  drivers: [],
  leaderboard: [],
  telemetry1: null,
  telemetry2: null,
  selectedDriver1: "",
  selectedDriver2: "",
  selectedLap: 10,
  insights: [],
  liveState: null,
  positions: [],
  wsConnected: false,
  flagMode: "green",
  raceControlMessages: [],
  voiceMuted: true,
  autoCommentary: false,
  focusedDriver: null,
  chatMessages: [],
  mode: "simulation",
  liveAvailable: false,
  rateLimit: null,

  loadSession: async (year, gp) => {
    set({
      loading: true,
      error: null,
      // ── Full reset on GP switch ──
      leaderboard: [],
      drivers: [],
      insights: [],
      telemetry1: null,
      telemetry2: null,
      positions: [],
      liveState: null,
      raceControlMessages: [],
      flagMode: "green",
      focusedDriver: null,
      chatMessages: [],
      selectedDriver1: "",
      selectedDriver2: "",
    });
    try {
      const session = await api.loadSession(year, gp);
      set({ session, loading: false });
      // Fetch dependent data for new GP
      get().fetchDrivers();
      get().fetchLeaderboard();
      get().fetchInsights();
      get().fetchRaceControl(1);
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  fetchDrivers: async () => {
    try {
      const drivers = await api.getDrivers();
      set({ drivers });
      // Auto-select first two drivers for telemetry
      if (drivers.length >= 2) {
        const state = get();
        if (!state.selectedDriver1) set({ selectedDriver1: drivers[0].abbreviation });
        if (!state.selectedDriver2) set({ selectedDriver2: drivers[1].abbreviation });
      }
    } catch (e) {
      console.error("Failed to fetch drivers:", e);
    }
  },

  fetchLeaderboard: async (lap?) => {
    try {
      const leaderboard = await api.getLeaderboard(lap);
      set({ leaderboard });
    } catch (e) {
      console.error("Failed to fetch leaderboard:", e);
    }
  },

  fetchTelemetry: async (driver, lap, slot) => {
    try {
      const data = await api.getTelemetry(driver, lap);
      if (slot === 1) set({ telemetry1: data });
      else set({ telemetry2: data });
    } catch (e) {
      console.error("Failed to fetch telemetry:", e);
    }
  },

  fetchInsights: async (lap?) => {
    try {
      const insights = await api.getInsights(lap);
      set({ insights });
    } catch (e) {
      console.error("Failed to fetch insights:", e);
    }
  },

  fetchLiveState: async () => {
    try {
      const liveState = await api.getLive();
      set({ liveState });
    } catch (e) {
      console.error("Failed to fetch live state:", e);
    }
  },

  setSelectedDriver: (slot, driver) => {
    if (slot === 1) set({ selectedDriver1: driver });
    else set({ selectedDriver2: driver });
  },

  setSelectedLap: (lap) => set({ selectedLap: lap }),
  setVoiceMuted: (muted) => set({ voiceMuted: muted }),
  setAutoCommentary: (auto) => set({ autoCommentary: auto }),
  setError: (error) => set({ error }),

  // WebSocket-driven setters
  setLeaderboard: (data) => set({ leaderboard: data }),
  setPositions: (data) => set({ positions: data }),
  setInsightsFromWS: (data) => set({ insights: data }),
  setLiveState: (data) => set({ liveState: data }),
  setWsConnected: (connected) => set({ wsConnected: connected }),

  // Flags & Race Control
  setFlagMode: (flag) => set({ flagMode: flag }),
  setRaceControlMessages: (msgs) => set({ raceControlMessages: msgs }),

  fetchRaceControl: async (lap?) => {
    try {
      const data = await api.getRaceControl(lap);
      if (data.race_control) set({ raceControlMessages: data.race_control });
      if (data.flag) set({ flagMode: data.flag as FlagMode });
    } catch (e) {
      console.error("Failed to fetch race control:", e);
    }
  },

  // AI Chat
  addChatMessage: (msg) =>
    set((state) => ({ chatMessages: [...state.chatMessages, msg] })),
  clearChat: () => set({ chatMessages: [] }),

  // Mode & Rate Limit
  setMode: (mode) => set({ mode }),
  setLiveAvailable: (available) => set({ liveAvailable: available }),
  setRateLimit: (data) => set({ rateLimit: data }),
  setFocusedDriver: (driver) => set({ focusedDriver: driver }),
  fetchMode: async () => {
    try {
      const info = await api.getMode();
      set({ mode: info.mode, liveAvailable: info.live_available });
    } catch {}
  },
  fetchRateLimit: async () => {
    try {
      const data = await api.getRateLimit();
      set({ rateLimit: data });
    } catch {}
  },
}));
