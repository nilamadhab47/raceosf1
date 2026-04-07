/**
 * EventEngine — data-driven race event detection with micro-timeline interpolation.
 *
 * Detects: overtake, battle, pit_stop, incident, fastest_lap
 * from leaderboard/position/flag data already flowing through the store.
 *
 * Micro-timing: Even though backend data is lap-granular (12s intervals),
 * gap-delta interpolation estimates sub-lap event timing for broadcast feel.
 */

import { create } from "zustand";
import type { LeaderboardEntry, FlagMode } from "@/lib/types";

/* ── Types ────────────────────────────────────────────────────────── */

export type RaceEventType =
  | "overtake"
  | "battle"
  | "pit_stop"
  | "incident"
  | "fastest_lap";

export type EventSeverity = "low" | "medium" | "high";

export interface EventClip {
  eventId: string;
  start: number;        // raceProgress
  end: number;          // raceProgress
  drivers: string[];
  cameraMode: "follow" | "battle";
  zoom: number;
  label: string;
}

export interface RaceEvent {
  id: string;
  type: RaceEventType;
  time: number;           // raceProgress (fractional laps, micro-timed)
  lap: number;
  drivers: string[];
  trackProgress: number;  // 0–1 position on track
  severity: EventSeverity;
  message: string;
  data: Record<string, unknown>;
  clip: EventClip;
  createdAt: number;      // performance.now() for active-window calc
}

export interface EventEngineState {
  events: RaceEvent[];
  activeEvents: RaceEvent[];   // events within last 10s window

  // Internal tracking for detection
  _prevLeaderboard: LeaderboardEntry[];
  _prevPositions: Map<string, number>; // driver -> position
  _prevGaps: Map<string, number>;      // driver -> gap_to_leader
  _prevStints: Map<string, number>;    // driver -> stint number
  _bestLapTime: number;
  _bestLapDriver: string | null;

  // Actions
  processLeaderboard: (lb: LeaderboardEntry[], lap: number, raceProgress: number) => void;
  processFlag: (flag: FlagMode, lap: number, raceProgress: number) => void;
  tickActiveEvents: () => void;  // call each frame to prune expired active events
  getEventsForLap: (lap: number) => RaceEvent[];
  getEventsByType: (type: RaceEventType) => RaceEvent[];
  clearEvents: () => void;
}

/* ── Helpers ──────────────────────────────────────────────────────── */

let _eventCounter = 0;
function makeId(): string {
  return `evt_${Date.now().toString(36)}_${(++_eventCounter).toString(36)}`;
}

const ACTIVE_WINDOW_MS = 10_000; // events stay "active" for 10 seconds

const PIT_LANE_PROGRESS = 0.98;

/** Per-type clip windows (raceProgress units, ~12s per 1.0 at typical lap time) */
const CLIP_CONFIG: Record<RaceEventType, { before: number; after: number; camera: "follow" | "battle"; zoom: number }> = {
  overtake:    { before: 0.3, after: 0.2, camera: "battle", zoom: 2.8 },   // tight, fast moment
  battle:      { before: 0.5, after: 0.5, camera: "battle", zoom: 2.0 },   // wider, longer duel
  pit_stop:    { before: 0.2, after: 0.3, camera: "follow", zoom: 2.5 },   // follow into/out of pit
  incident:    { before: 0.4, after: 0.6, camera: "follow", zoom: 2.2 },   // see aftermath
  fastest_lap: { before: 0.2, after: 0.15, camera: "follow", zoom: 2.5 },  // short celebration
};

function buildClip(event: Omit<RaceEvent, "clip" | "createdAt" | "id">, detectionProgress: number): EventClip {
  const cfg = CLIP_CONFIG[event.type];
  // Clip window anchored to when detection actually runs (raceProgress at fetch time),
  // not the micro-timed estimate. This ensures recorded frames from the smooth
  // gap transition are captured in the replay buffer.
  const anchor = detectionProgress;
  return {
    eventId: "",
    start: Math.max(0, anchor - cfg.before),
    end: anchor + cfg.after,
    drivers: event.drivers,
    cameraMode: cfg.camera,
    zoom: cfg.zoom,
    label: event.message,
  };
}

/* ── Severity mapping ─────────────────────────────────────────────── */

function overtakeSeverity(posGain: number): EventSeverity {
  if (posGain >= 3) return "high";
  if (posGain >= 2) return "medium";
  return "low";
}

/* ── Store ────────────────────────────────────────────────────────── */

export const useEventEngine = create<EventEngineState>((set, get) => ({
  events: [],
  activeEvents: [],
  _prevLeaderboard: [],
  _prevPositions: new Map(),
  _prevGaps: new Map(),
  _prevStints: new Map(),
  _bestLapTime: Infinity,
  _bestLapDriver: null,

  processLeaderboard: (lb, lap, raceProgress) => {
    const state = get();
    const newEvents: RaceEvent[] = [];

    const prevPos = state._prevPositions;
    const prevGaps = state._prevGaps;
    const prevStints = state._prevStints;

    // Build current maps
    const currPos = new Map<string, number>();
    const currGaps = new Map<string, number>();
    const currStints = new Map<string, number>();

    for (const entry of lb) {
      currPos.set(entry.driver, entry.position);
      currGaps.set(entry.driver, entry.gap_to_leader ?? 0);
      currStints.set(entry.driver, entry.stint ?? 0);
    }

    // Skip detection on first lap or first data
    if (prevPos.size > 0 && lap > 1) {

      // ── OVERTAKE detection ──────────────────────────────────────
      for (const entry of lb) {
        const prev = prevPos.get(entry.driver);
        if (prev === undefined) continue;
        const curr = entry.position;
        if (curr < prev) {
          // Driver gained positions
          const gained = prev - curr;
          // Find who was overtaken: drivers whose position worsened
          const overtaken: string[] = [];
          for (const other of lb) {
            if (other.driver === entry.driver) continue;
            const otherPrev = prevPos.get(other.driver);
            if (otherPrev !== undefined && other.position > otherPrev) {
              // Check if this driver was in the vicinity (adjacent positions)
              if (otherPrev <= prev && other.position >= curr) {
                overtaken.push(other.driver);
              }
            }
          }

          // Micro-timing: estimate when overtake happened within the lap
          const prevGap = prevGaps.get(entry.driver) ?? 0;
          const currGap = entry.gap_to_leader ?? 0;
          let estimatedOffset = 0.5; // default: mid-lap
          if (prevGap > 0 && currGap >= 0) {
            // Gap-delta interpolation
            const gapDelta = Math.abs(prevGap - currGap);
            if (gapDelta > 0.1) {
              estimatedOffset = Math.min(0.9, Math.max(0.1, prevGap / (prevGap + Math.abs(currGap) + 0.01)));
            }
          }

          const eventTime = (lap - 1) + estimatedOffset;
          const drivers = [entry.driver, ...overtaken.slice(0, 1)];

          // Dedup check
          const isDupe = state.events.some(
            (e) => e.type === "overtake" && e.lap === lap && e.drivers[0] === entry.driver,
          );
          if (!isDupe) {
            const severity = overtakeSeverity(gained);
            const msg = overtaken.length > 0
              ? `${entry.driver} overtakes ${overtaken[0]} → P${curr}`
              : `${entry.driver} gains ${gained} position${gained > 1 ? "s" : ""} → P${curr}`;

            const evt: Omit<RaceEvent, "clip" | "createdAt" | "id"> = {
              type: "overtake",
              time: eventTime,
              lap,
              drivers,
              trackProgress: estimatedOffset,
              severity,
              message: msg,
              data: { from: prev, to: curr, gained },
            };
            const id = makeId();
            const clip = buildClip(evt, raceProgress);
            clip.eventId = id;
            newEvents.push({ ...evt, id, clip, createdAt: performance.now() });
          }
        }
      }

      // ── BATTLE detection (gap < 1.0s between adjacent drivers) ──
      const sorted = [...lb].sort((a, b) => a.position - b.position);
      for (let i = 0; i < sorted.length - 1; i++) {
        const d1 = sorted[i];
        const d2 = sorted[i + 1];
        const g1 = d1.gap_to_leader ?? 0;
        const g2 = d2.gap_to_leader ?? 0;
        const gap = Math.abs(g2 - g1);

        if (gap < 1.0 && gap > 0) {
          // Check dedup: no battle event for same pair this lap
          const pair = [d1.driver, d2.driver].sort().join("-");
          const isDupe = state.events.some(
            (e) => e.type === "battle" && e.lap === lap &&
              [...e.drivers].sort().join("-") === pair,
          );
          if (!isDupe) {
            // Micro-timing: estimate closest approach
            const prevG1 = prevGaps.get(d1.driver) ?? g1;
            const prevG2 = prevGaps.get(d2.driver) ?? g2;
            const prevGap = Math.abs(prevG2 - prevG1);
            const gapRate = gap - prevGap; // negative = closing
            let estimatedOffset = 0.5;
            if (gapRate < -0.1) {
              // Closing — closest approach later in lap
              estimatedOffset = Math.min(0.9, gap / Math.abs(gapRate));
            }

            const eventTime = (lap - 1) + estimatedOffset;
            const severity: EventSeverity = gap < 0.5 ? "high" : gap < 0.8 ? "medium" : "low";

            const evt: Omit<RaceEvent, "clip" | "createdAt" | "id"> = {
              type: "battle",
              time: eventTime,
              lap,
              drivers: [d1.driver, d2.driver],
              trackProgress: estimatedOffset,
              severity,
              message: `${d1.driver} vs ${d2.driver} — ${gap.toFixed(1)}s`,
              data: { gap, positions: [d1.position, d2.position] },
            };
            const id = makeId();
            const clip = buildClip(evt, raceProgress);
            clip.eventId = id;
            newEvents.push({ ...evt, id, clip, createdAt: performance.now() });
          }
        }
      }

      // ── PIT STOP detection (stint increment) ────────────────────
      for (const entry of lb) {
        const prev = prevStints.get(entry.driver);
        const curr = entry.stint ?? 0;
        if (prev !== undefined && curr > prev && lap > 2) {
          const isDupe = state.events.some(
            (e) => e.type === "pit_stop" && e.lap === lap && e.drivers[0] === entry.driver,
          );
          if (!isDupe) {
            const eventTime = (lap - 1) + PIT_LANE_PROGRESS;
            const evt: Omit<RaceEvent, "clip" | "createdAt" | "id"> = {
              type: "pit_stop",
              time: eventTime,
              lap,
              drivers: [entry.driver],
              trackProgress: PIT_LANE_PROGRESS,
              severity: "medium",
              message: `${entry.driver} PIT STOP → ${entry.compound?.toUpperCase() || "?"}`,
              data: { compound: entry.compound, stint: curr },
            };
            const id = makeId();
            const clip = buildClip(evt, raceProgress);
            clip.eventId = id;
            newEvents.push({ ...evt, id, clip, createdAt: performance.now() });
          }
        }
      }

      // ── FASTEST LAP detection ───────────────────────────────────
      for (const entry of lb) {
        if (entry.last_lap_time && entry.last_lap_time > 30) {
          if (entry.last_lap_time < state._bestLapTime) {
            const prevBest = state._bestLapTime;
            const isFirst = prevBest === Infinity;

            if (!isFirst) {
              const isDupe = state.events.some(
                (e) => e.type === "fastest_lap" && e.lap === lap && e.drivers[0] === entry.driver,
              );
              if (!isDupe) {
                const eventTime = raceProgress;
                const evt: Omit<RaceEvent, "clip" | "createdAt" | "id"> = {
                  type: "fastest_lap",
                  time: eventTime,
                  lap,
                  drivers: [entry.driver],
                  trackProgress: 0,
                  severity: "high",
                  message: `${entry.driver} FASTEST LAP — ${entry.last_lap_time.toFixed(3)}s`,
                  data: { time: entry.last_lap_time, prevBest },
                };
                const id = makeId();
                const clip = buildClip(evt, raceProgress);
                clip.eventId = id;
                newEvents.push({ ...evt, id, clip, createdAt: performance.now() });
              }
            }

            // Always update best
            set({ _bestLapTime: entry.last_lap_time, _bestLapDriver: entry.driver });
          }
        }
      }
    }

    // Update prev tracking
    set({
      _prevLeaderboard: lb,
      _prevPositions: currPos,
      _prevGaps: currGaps,
      _prevStints: currStints,
    });

    // Append new events
    if (newEvents.length > 0) {
      const now = performance.now();
      set((s) => ({
        events: [...s.events, ...newEvents],
        activeEvents: [
          ...s.activeEvents.filter((e) => now - e.createdAt < ACTIVE_WINDOW_MS),
          ...newEvents,
        ],
      }));
    }
  },

  processFlag: (flag, lap, raceProgress) => {
    if (flag === "green" || flag === "chequered") return;

    const state = get();
    // Dedup: no same-type flag event within 2 laps
    const isDupe = state.events.some(
      (e) => e.type === "incident" && Math.abs(e.lap - lap) < 2,
    );
    if (isDupe) return;

    const severityMap: Record<string, EventSeverity> = {
      yellow_flag: "medium",
      safety_car: "high",
      virtual_safety_car: "high",
      red_flag: "high",
    };

    const labelMap: Record<string, string> = {
      yellow_flag: "YELLOW FLAG",
      safety_car: "SAFETY CAR",
      virtual_safety_car: "VIRTUAL SAFETY CAR",
      red_flag: "RED FLAG",
    };

    const id = makeId();
    const evt: RaceEvent = {
      id,
      type: "incident",
      time: raceProgress,
      lap,
      drivers: [],
      trackProgress: 0.5,
      severity: severityMap[flag] || "medium",
      message: `⚠ ${labelMap[flag] || flag.toUpperCase()} — Lap ${lap}`,
      data: { flag },
      clip: {
        eventId: id,
        start: Math.max(0, raceProgress - 0.5),
        end: raceProgress + 0.7,
        drivers: [],
        cameraMode: "follow",
        zoom: 1.5,
        label: labelMap[flag] || flag,
      },
      createdAt: performance.now(),
    };

    set((s) => ({
      events: [...s.events, evt],
      activeEvents: [...s.activeEvents, evt],
    }));
  },

  tickActiveEvents: () => {
    const now = performance.now();
    set((s) => {
      const next = s.activeEvents.filter((e) => now - e.createdAt < ACTIVE_WINDOW_MS);
      if (next.length === s.activeEvents.length) return s; // no change
      return { activeEvents: next };
    });
  },

  getEventsForLap: (lap) => get().events.filter((e) => e.lap === lap),
  getEventsByType: (type) => get().events.filter((e) => e.type === type),

  clearEvents: () =>
    set({
      events: [],
      activeEvents: [],
      _prevLeaderboard: [],
      _prevPositions: new Map(),
      _prevGaps: new Map(),
      _prevStints: new Map(),
      _bestLapTime: Infinity,
      _bestLapDriver: null,
    }),
}));
