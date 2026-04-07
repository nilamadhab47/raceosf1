/**
 * Timeline — rAF-driven global race clock.
 *
 * Maintains a continuous `raceProgress` (fractional laps, e.g. 10.456).
 * The rAF loop calls tick(deltaMs) every frame.
 *
 * At 1x speed, one lap = BASE_LAP_SECONDS of wall-clock time.
 * Components read `currentLap` (integer) and `lapProgress` (0–1).
 * TrackCanvas uses `lapProgress` to place cars along the track path.
 */

import { create } from "zustand";

/* ── Types ────────────────────────────────────────────────────────── */

export interface TimelineState {
  raceProgress: number;   // fractional laps (e.g. 10.456)
  currentLap: number;     // floor(raceProgress) + 1 (1-based)
  lapProgress: number;    // raceProgress % 1 (0.0 – 1.0)
  totalLaps: number;
  avgLapTime: number;     // seconds — for gap-to-progress conversion

  isPlaying: boolean;
  speed: number;
  progress: number;       // 0–100 for scrubber

  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (lap: number) => void;
  setSpeed: (speed: number) => void;
  stepForward: () => void;
  stepBackward: () => void;
  setTotalLaps: (total: number) => void;
  setAvgLapTime: (t: number) => void;
  tick: (deltaMs: number) => void;
  syncFromLive: (lap: number, total: number, isRunning: boolean) => void;
}

export const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 5, 10] as const;

/** Wall-clock seconds per lap at 1x. 12s is fast-enough but visible. */
const BASE_LAP_SECONDS = 12;

function deriveFields(raceProgress: number, totalLaps: number) {
  const clamped = Math.max(0, Math.min(raceProgress, totalLaps - 1));
  const currentLap = Math.min(Math.floor(clamped) + 1, totalLaps);
  const lapProgress = clamped - Math.floor(clamped);
  const progress = totalLaps > 1 ? (clamped / (totalLaps - 1)) * 100 : 0;
  return { raceProgress: clamped, currentLap, lapProgress, progress };
}

export const useTimeline = create<TimelineState>((set, get) => ({
  raceProgress: 0,
  currentLap: 1,
  lapProgress: 0,
  totalLaps: 57,
  avgLapTime: 90,
  isPlaying: false,
  speed: 1,
  progress: 0,

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),

  seek: (lap) => {
    const { totalLaps } = get();
    const clamped = Math.max(1, Math.min(lap, totalLaps));
    set(deriveFields(clamped - 1, totalLaps));
  },

  setSpeed: (speed) => set({ speed }),

  stepForward: () => {
    const { raceProgress, totalLaps } = get();
    set(deriveFields(Math.floor(raceProgress) + 1, totalLaps));
  },

  stepBackward: () => {
    const { raceProgress, totalLaps } = get();
    set(deriveFields(Math.max(0, Math.floor(raceProgress) - 1), totalLaps));
  },

  setTotalLaps: (total) => set({ totalLaps: total }),
  setAvgLapTime: (t) => set({ avgLapTime: t }),

  tick: (deltaMs) => {
    const { isPlaying, speed, raceProgress, totalLaps } = get();
    if (!isPlaying) return;
    if (raceProgress >= totalLaps - 1) {
      set({ isPlaying: false, ...deriveFields(totalLaps - 1, totalLaps) });
      return;
    }
    const deltaSec = deltaMs / 1000;
    const increment = (deltaSec * speed) / BASE_LAP_SECONDS;
    set(deriveFields(raceProgress + increment, totalLaps));
  },

  syncFromLive: (lap, total, isRunning) => {
    const { raceProgress } = get();
    const target = Math.max(0, lap - 1);
    // Only snap forward — never backward. Prevents oscillation when
    // tick() advances between polls and sync tries to snap back.
    if (target > raceProgress) {
      set({ totalLaps: total, isPlaying: isRunning, ...deriveFields(target, total) });
    } else {
      set({ totalLaps: total, isPlaying: isRunning });
    }
  },
}));
