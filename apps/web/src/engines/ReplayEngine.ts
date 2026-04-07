/**
 * ReplayEngine — ring-buffered frame store with structured event clip playback.
 *
 * Records snapshots every ~500ms during simulation.
 * Supports instant jump-to-event with the EventClip structure.
 * Provides slow-motion playback (0.25x–2x) via Timeline speed control.
 */

import { create } from "zustand";
import type { LeaderboardEntry } from "@/lib/types";
import type { EventClip, RaceEvent } from "./EventEngine";

/* ── Types ────────────────────────────────────────────────────────── */

export interface ReplayFrame {
  time: number;  // raceProgress
  positions: Map<string, { x: number; y: number; progress: number }>;
  leaderboard: LeaderboardEntry[];
}

export interface ReplayEngineState {
  /** True when replaying a clip (positions come from frame store, not live) */
  isReplayMode: boolean;

  /** Current clip being played, null if not in clip mode */
  activeClip: EventClip | null;

  /** Full event being replayed (for modal metadata) */
  activeEvent: RaceEvent | null;

  /** Total recorded frames */
  frameCount: number;

  /** Playback speed during replay */
  replaySpeed: number;

  // Actions
  recordFrame: (time: number, positions: Map<string, { x: number; y: number; progress: number }>, leaderboard: LeaderboardEntry[]) => void;
  getFrameAt: (raceProgress: number) => ReplayFrame | null;
  getFrameRange: (start: number, end: number) => ReplayFrame[];

  openEvent: (event: RaceEvent) => void;
  closeEvent: () => void;
  playClip: (clip: EventClip) => void;
  stopReplay: () => void;
  setReplaySpeed: (speed: number) => void;

  clearFrames: () => void;
}

/* ── Constants ────────────────────────────────────────────────────── */

const MAX_FRAMES = 10_000;

/* ── Ring buffer (module-level for performance — not in Zustand state) ── */

const _frames: (ReplayFrame | null)[] = new Array(MAX_FRAMES).fill(null);
let _writeIdx = 0;
let _count = 0;

function _pushFrame(frame: ReplayFrame): void {
  _frames[_writeIdx % MAX_FRAMES] = frame;
  _writeIdx++;
  _count = Math.min(_count + 1, MAX_FRAMES);
}

function _getNearest(raceProgress: number): ReplayFrame | null {
  if (_count === 0) return null;
  let best: ReplayFrame | null = null;
  let bestDist = Infinity;

  // Scan from most recent backward (more likely to find nearby frames)
  const start = _writeIdx - 1;
  const end = Math.max(0, _writeIdx - _count);
  for (let i = start; i >= end; i--) {
    const frame = _frames[i % MAX_FRAMES];
    if (!frame) continue;
    const dist = Math.abs(frame.time - raceProgress);
    if (dist < bestDist) {
      bestDist = dist;
      best = frame;
    }
    // Early exit: if we're moving further away, stop
    if (dist > bestDist + 1) break;
  }
  return best;
}

function _getRange(start: number, end: number): ReplayFrame[] {
  const result: ReplayFrame[] = [];
  const from = Math.max(0, _writeIdx - _count);
  for (let i = from; i < _writeIdx; i++) {
    const frame = _frames[i % MAX_FRAMES];
    if (frame && frame.time >= start && frame.time <= end) {
      result.push(frame);
    }
  }
  return result;
}

function _clearAll(): void {
  _frames.fill(null);
  _writeIdx = 0;
  _count = 0;
}

/* ── Store ────────────────────────────────────────────────────────── */

export const useReplayEngine = create<ReplayEngineState>((set, get) => ({
  isReplayMode: false,
  activeClip: null,
  activeEvent: null,
  frameCount: 0,
  replaySpeed: 0.25,

  recordFrame: (time, positions, leaderboard) => {
    _pushFrame({ time, positions, leaderboard });
    // Only update frameCount occasionally to avoid excessive re-renders
    const newCount = _count;
    if (newCount !== get().frameCount) {
      set({ frameCount: newCount });
    }
  },

  getFrameAt: (raceProgress) => _getNearest(raceProgress),
  getFrameRange: (start, end) => _getRange(start, end),

  openEvent: (event) => {
    set({
      isReplayMode: true,
      activeEvent: event,
      activeClip: event.clip ?? null,
      replaySpeed: 0.25,
    });
  },

  closeEvent: () => {
    set({
      isReplayMode: false,
      activeEvent: null,
      activeClip: null,
    });
  },

  playClip: (clip) => {
    set({
      isReplayMode: true,
      activeClip: clip,
      replaySpeed: 0.25,
    });
  },

  stopReplay: () => {
    set({
      isReplayMode: false,
      activeClip: null,
      activeEvent: null,
    });
  },

  setReplaySpeed: (speed) => set({ replaySpeed: speed }),

  clearFrames: () => {
    _clearAll();
    set({
      frameCount: 0,
      isReplayMode: false,
      activeClip: null,
      activeEvent: null,
    });
  },
}));

/* ── Replay speed options ─────────────────────────────────────────── */

export const REPLAY_SPEED_OPTIONS = [0.25, 0.5, 1, 2] as const;
