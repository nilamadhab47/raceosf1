"use client";

/**
 * TrackCanvas — real-time F1 race visualization with smooth car animation.
 *
 * ARCHITECTURE:
 *   1. Track outline fetched from /api/track-map → sampled into N evenly-spaced points
 *   2. Driver gap data fetched per-lap from /api/driver-positions + leaderboard
 *   3. Cars are placed on the track path based on timeline's lapProgress + gap offsets
 *   4. ALL animation is ref-based (no React re-renders in the hot path)
 *   5. requestAnimationFrame drives 60fps smooth interpolation
 *   6. Glowing trails rendered as SVG polylines from position history
 *
 * KEY CONCEPT: Each car's position = a point along the sampled track path.
 *   - Leader is at lapProgress (0–1) around the track
 *   - Other cars are offset behind based on gap_to_leader / avgLapTime
 *   - All cars move continuously as lapProgress advances
 */

import { useEffect, useRef, useState, memo, useCallback } from "react";
import { useF1Store } from "@/store/f1-store";
import { useTimeline } from "@/engines/Timeline";
import { useEventEngine } from "@/engines/EventEngine";
import { useReplayEngine } from "@/engines/ReplayEngine";
import { resolveTrack } from "@/lib/trackMapping";
import { api } from "@/lib/api";
import { EventBanner } from "./EventBanner";
import { EventReplayModal } from "./EventReplayModal";
import { TrackLoadingOverlay } from "./TrackLoadingOverlay";
import type { DriverPosition } from "@/lib/types";

/* ── Types ────────────────────────────────────────────────────────── */

export type LayerKey =
  | "cars"
  | "labels"
  | "battles"
  | "racingLine"
  | "sectors"
  | "gaps"
  | "tyres";

interface DriverSlot {
  driver: string;
  fullName: string;
  team: string;
  teamColor: string;
  position: number;
  lapTime: number | null;
  compound: string | null;
  gapToLeader: number | null;
  /** Track progress offset: gap_to_leader / avgLapTime (fraction of a lap) */
  progressOffset: number;
  isPitting: boolean;
  pitCompound: string | null;
}

interface TrackOutline {
  x: number[];
  y: number[];
  corners: { number: number; x: number; y: number; letter: string }[];
}

interface TrackSample {
  x: number;
  y: number;
  progress: number; // 0 to 1
}

/** Per-car animation state stored in refs (never triggers re-render) */
interface CarAnimData {
  targetOffset: number;   // gap_to_leader / avgLapTime — set on each data fetch
  smoothOffset: number;   // exponentially decays toward targetOffset
  targetSpread: number;   // position * 0.002 — set on each data fetch
  smoothSpread: number;   // exponentially decays toward targetSpread
  currentX: number;
  currentY: number;
}

/* ── Constants ────────────────────────────────────────────────────── */

const VB = 1000;
const TRACK_SAMPLES = 1000; // high-res sampling for smooth placement
const GAP_SMOOTH = 0.03;  // per-frame exponential decay for gap offsets (~0.38s half-life)
const BATTLE_PROXIMITY = 30;
const PIT_LANE_PROGRESS = 0.98; // approximate pit entry progress
const PIT_LANE_OFFSET = 35; // pixels to offset from track for pit lane

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: "#ff3333",
  MEDIUM: "#ffcc00",
  HARD: "#cccccc",
  INTERMEDIATE: "#22cc44",
  WET: "#2277ff",
};

/* ── Track path utilities ─────────────────────────────────────────── */

function buildTrackPath(outline: TrackOutline): string {
  const { x, y } = outline;
  if (x.length < 2) return "";
  let d = `M ${x[0]} ${y[0]}`;
  for (let i = 1; i < x.length; i++) d += ` L ${x[i]} ${y[i]}`;
  return d + " Z";
}

function samplePath(pathD: string, count: number): TrackSample[] {
  if (typeof document === "undefined") return [];
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathD);
  svg.appendChild(path);
  document.body.appendChild(svg);
  const total = path.getTotalLength();
  const samples: TrackSample[] = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const pt = path.getPointAtLength(t * total);
    samples.push({ x: pt.x, y: pt.y, progress: t });
  }
  document.body.removeChild(svg);
  return samples;
}

/** Look up x,y for a progress value (0–1). Uses nearest index for O(1). */
function getTrackPoint(samples: TrackSample[], progress: number): { x: number; y: number } {
  if (samples.length === 0) return { x: 500, y: 500 };
  // Wrap progress into [0, 1)
  let p = ((progress % 1) + 1) % 1;
  const idx = p * (samples.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, samples.length - 1);
  const t = idx - lo;
  return {
    x: samples[lo].x + (samples[hi].x - samples[lo].x) * t,
    y: samples[lo].y + (samples[hi].y - samples[lo].y) * t,
  };
}

/* ── Main TrackCanvas ─────────────────────────────────────────────── */

interface TrackCanvasProps {
  layers: Record<LayerKey, boolean>;
}

export const TrackCanvas = memo(function TrackCanvas({ layers }: TrackCanvasProps) {
  const { session, leaderboard, focusedDriver, setFocusedDriver, fetchLeaderboard } = useF1Store();
  const { currentLap, totalLaps, lapProgress, isPlaying, avgLapTime, setAvgLapTime } = useTimeline();

  const [trackOutline, setTrackOutline] = useState<TrackOutline | null>(null);
  const [trackPathD, setTrackPathD] = useState("");
  const [pathSamples, setPathSamples] = useState<TrackSample[]>([]);
  const [hoveredDriver, setHoveredDriver] = useState<string | null>(null);
  const [telemetryReady, setTelemetryReady] = useState(false);

  // Refs for animation data (never cause re-renders)
  const driverSlotsRef = useRef<DriverSlot[]>([]);
  const carAnimRef = useRef<Map<string, CarAnimData>>(new Map());
  const prevStintsRef = useRef<Map<string, number>>(new Map()); // track stint changes for pit detection
  const svgRef = useRef<SVGSVGElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const prevLapRef = useRef(-1);
  const fetchingRef = useRef(false);
  const lastFrameRecordRef = useRef(0);

  // For React UI (leaderboard bar at bottom, battle detection)
  const [carPositions, setCarPositions] = useState<{ driver: string; x: number; y: number; teamColor: string; position: number }[]>([]);
  const battlesRef = useRef<Set<string>>(new Set());

  const trackInfo = session ? resolveTrack(session.circuit) : null;

  /* ── 1. Load track outline — instant from static SVG, upgrade from API ── */

  useEffect(() => {
    if (!session) return;
    // Reset all animation state for new session
    driverSlotsRef.current = [];
    carAnimRef.current.clear();
    prevStintsRef.current.clear();
    prevLapRef.current = -1;
    setCarPositions([]);
    setHoveredDriver(null);
    setTelemetryReady(false);

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let retries = 0;
    let hasStaticTrack = false;

    // ─── Phase A: Instantly load static track SVG ───
    const info = resolveTrack(session.circuit);
    if (info?.svg) {
      fetch(`/tracks/${info.svg}`)
        .then((r) => r.text())
        .then((svgText) => {
          if (cancelled) return;
          const parser = new DOMParser();
          const doc = parser.parseFromString(svgText, "image/svg+xml");
          const pathEl = doc.querySelector("path");
          if (!pathEl) return;
          const d = pathEl.getAttribute("d") || "";
          if (!d) return;
          // Static SVGs are 500x500 — sample then scale to 1000x1000
          const rawSamples = samplePath(d, TRACK_SAMPLES);
          if (rawSamples.length === 0) return;
          const scaled = rawSamples.map((s) => ({ x: s.x * 2, y: s.y * 2, progress: s.progress }));
          const scaledD =
            `M ${scaled[0].x} ${scaled[0].y}` +
            scaled.slice(1).map((s) => ` L ${s.x} ${s.y}`).join("") +
            " Z";
          setTrackPathD(scaledD);
          setPathSamples(scaled);
          setTelemetryReady(true);
          hasStaticTrack = true;
        })
        .catch(() => {});
    }

    // ─── Phase B: Background — poll API for precise telemetry track ───
    const tryFetchTrackMap = () => {
      api.getTrackMap().then((data) => {
        if (cancelled) return;
        if (data?.x?.length > 1) {
          const outline: TrackOutline = {
            x: data.x as number[],
            y: data.y as number[],
            corners: (data.corners || []) as TrackOutline["corners"],
          };
          setTrackOutline(outline);
          const d = buildTrackPath(outline);
          setTrackPathD(d);
          setPathSamples(samplePath(d, TRACK_SAMPLES));
          setTelemetryReady(true);
        } else if (!hasStaticTrack) {
          // 202 or empty — keep polling only if we don't have a static track yet
          pollTimer = setTimeout(tryFetchTrackMap, 3000);
        } else {
          // We have a static track, poll less aggressively for optional upgrade
          retries++;
          if (retries < 15) pollTimer = setTimeout(tryFetchTrackMap, 8000);
        }
      }).catch(() => {
        if (cancelled) return;
        retries++;
        if (!hasStaticTrack && retries < 20) {
          pollTimer = setTimeout(tryFetchTrackMap, 5000);
        } else if (hasStaticTrack && retries < 10) {
          pollTimer = setTimeout(tryFetchTrackMap, 10000);
        }
        // After max retries, just stop — static track is good enough
      });
    };

    tryFetchTrackMap();

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [session]);

  /* ── 2. Fetch driver data on lap change ─────────────────────────── */

  useEffect(() => {
    if (!session || currentLap < 1 || fetchingRef.current) return;
    if (currentLap === prevLapRef.current) return;
    prevLapRef.current = currentLap;
    fetchingRef.current = true;

    // Always fetch leaderboard (Phase 1 data — always available)
    // Try driver positions too (Phase 2 data — may 202)
    Promise.all([
      api.getDriverPositions(currentLap).catch(() => null),
      fetchLeaderboard(currentLap),
    ])
      .then(([positions]) => {
        if (positions && Array.isArray(positions) && positions.length > 0 && positions[0]?.driver) {
          buildDriverSlots(positions);
        } else {
          // Telemetry not ready — build slots from leaderboard alone
          buildDriverSlotsFromLeaderboard();
        }
      })
      .catch(() => {
        buildDriverSlotsFromLeaderboard();
      })
      .finally(() => { fetchingRef.current = false; });
  }, [session, currentLap, fetchLeaderboard]);

  /* ── Build driver slots from position + leaderboard data ────────── */

  const buildDriverSlots = useCallback((positions: DriverPosition[]) => {
    const lb = useF1Store.getState().leaderboard;
    const currentLapNow = useTimeline.getState().currentLap;

    // Compute average lap time from leaderboard for gap conversion
    const lapTimes = lb.filter((e) => e.last_lap_time && e.last_lap_time > 30).map((e) => e.last_lap_time!);
    if (lapTimes.length > 3) {
      const avg = lapTimes.reduce((a, b) => a + b, 0) / lapTimes.length;
      setAvgLapTime(avg);
    }

    const currentAvgLapTime = useTimeline.getState().avgLapTime;

    const slots: DriverSlot[] = [];
    for (const dp of positions) {
      const lbe = lb.find((e) => e.driver === dp.driver);
      const gap = lbe?.gap_to_leader ?? 0;
      // Convert gap (seconds) to fraction of a lap
      const progressOffset = currentLapNow <= 2
        ? dp.position * 0.018  // Starting grid: ~1.8% per grid slot
        : gap / currentAvgLapTime;

      // Detect pit stops by stint change
      const currentStint = lbe?.stint ?? 0;
      const prevStint = prevStintsRef.current.get(dp.driver) ?? currentStint;
      const isPitting = currentStint > prevStint && currentLapNow > 2;
      prevStintsRef.current.set(dp.driver, currentStint);

      slots.push({
        driver: dp.driver,
        fullName: dp.full_name,
        team: dp.team,
        teamColor: dp.team_color.startsWith("#") ? dp.team_color : `#${dp.team_color}`,
        position: dp.position,
        lapTime: dp.lap_time,
        compound: lbe?.compound ?? null,
        gapToLeader: lbe?.gap_to_leader ?? null,
        progressOffset,
        isPitting,
        pitCompound: isPitting ? (lbe?.compound ?? null) : null,
      });
    }
    slots.sort((a, b) => a.position - b.position);
    driverSlotsRef.current = slots;

    // Push new targets into CarAnimData — smoothOffset will decay toward them
    for (const slot of slots) {
      let anim = carAnimRef.current.get(slot.driver);
      if (!anim) {
        anim = {
          targetOffset: slot.progressOffset,
          smoothOffset: slot.progressOffset,
          targetSpread: slot.position * 0.002,
          smoothSpread: slot.position * 0.002,
          currentX: 500, currentY: 500,
        };
        carAnimRef.current.set(slot.driver, anim);
      }
      anim.targetOffset = slot.progressOffset;
      anim.targetSpread = slot.position * 0.002;
    }

    // Feed leaderboard to EventEngine for event detection
    const raceProgress = useTimeline.getState().raceProgress;
    useEventEngine.getState().processLeaderboard(lb, currentLapNow, raceProgress);
  }, [setAvgLapTime]);

  /** Fallback: build driver slots from leaderboard alone (no telemetry needed) */
  const buildDriverSlotsFromLeaderboard = useCallback(() => {
    const lb = useF1Store.getState().leaderboard;
    if (lb.length === 0) return;
    const currentLapNow = useTimeline.getState().currentLap;

    const lapTimes = lb.filter((e) => e.last_lap_time && e.last_lap_time > 30).map((e) => e.last_lap_time!);
    if (lapTimes.length > 3) {
      const avg = lapTimes.reduce((a, b) => a + b, 0) / lapTimes.length;
      setAvgLapTime(avg);
    }
    const currentAvgLapTime = useTimeline.getState().avgLapTime;

    const slots: DriverSlot[] = lb.map((e) => {
      const gap = e.gap_to_leader ?? 0;
      const progressOffset = currentLapNow <= 2
        ? e.position * 0.018
        : gap / currentAvgLapTime;

      const currentStint = e.stint ?? 0;
      const prevStint = prevStintsRef.current.get(e.driver) ?? currentStint;
      const isPitting = currentStint > prevStint && currentLapNow > 2;
      prevStintsRef.current.set(e.driver, currentStint);

      return {
        driver: e.driver,
        fullName: e.full_name,
        team: e.team,
        teamColor: e.team_color.startsWith("#") ? e.team_color : `#${e.team_color}`,
        position: e.position,
        lapTime: e.last_lap_time,
        compound: e.compound ?? null,
        gapToLeader: e.gap_to_leader ?? null,
        progressOffset,
        isPitting,
        pitCompound: isPitting ? (e.compound ?? null) : null,
      };
    });

    slots.sort((a, b) => a.position - b.position);
    driverSlotsRef.current = slots;

    for (const slot of slots) {
      let anim = carAnimRef.current.get(slot.driver);
      if (!anim) {
        anim = {
          targetOffset: slot.progressOffset,
          smoothOffset: slot.progressOffset,
          targetSpread: slot.position * 0.002,
          smoothSpread: slot.position * 0.002,
          currentX: 500, currentY: 500,
        };
        carAnimRef.current.set(slot.driver, anim);
      }
      anim.targetOffset = slot.progressOffset;
      anim.targetSpread = slot.position * 0.002;
    }

    const raceProgress = useTimeline.getState().raceProgress;
    useEventEngine.getState().processLeaderboard(lb, currentLapNow, raceProgress);
  }, [setAvgLapTime]);

  /* ── 3. 60fps animation loop ────────────────────────────────────── */

  useEffect(() => {
    if (pathSamples.length === 0) return;

    let lastDomUpdate = 0;
    const DOM_UPDATE_INTERVAL = 2000; // update React state every 2s (bottom bar only — cosmetic)

    const animate = () => {
      const { lapProgress: lp } = useTimeline.getState();
      const slots = driverSlotsRef.current;
      const samples = pathSamples;
      const svg = svgRef.current;

      if (slots.length === 0 || !svg) {
        rafIdRef.current = requestAnimationFrame(animate);
        return;
      }

      const now = performance.now();
      const positionsForReact: typeof carPositions = [];

      // ── Per-car smooth animation ──
      const framePositions: { driver: string; x: number; y: number }[] = [];

      for (const slot of slots) {
        // Get or init animation state
        let anim = carAnimRef.current.get(slot.driver);
        if (!anim) {
          anim = {
            targetOffset: slot.progressOffset,
            smoothOffset: slot.progressOffset,
            targetSpread: slot.position * 0.002,
            smoothSpread: slot.position * 0.002,
            currentX: 500, currentY: 500,
          };
          carAnimRef.current.set(slot.driver, anim);
        }

        // Single-layer exponential decay: smoothOffset → targetOffset
        // Each car smooths independently — no simultaneous bulk jumps
        anim.smoothOffset += (anim.targetOffset - anim.smoothOffset) * GAP_SMOOTH;
        anim.smoothSpread += (anim.targetSpread - anim.smoothSpread) * GAP_SMOOTH;

        // CORE: car progress = leader progress - smoothed gap offset + smoothed spread
        let carProgress = lp - anim.smoothOffset + anim.smoothSpread;
        carProgress = ((carProgress % 1) + 1) % 1;

        // Convert progress directly to x,y — single step, no second LERP
        const pos = getTrackPoint(samples, carProgress);
        anim.currentX = pos.x;
        anim.currentY = pos.y;

        // If pitting, offset perpendicular toward pit lane
        let drawX = anim.currentX;
        let drawY = anim.currentY;
        if (slot.isPitting) {
          const ahead = getTrackPoint(samples, carProgress + 0.005);
          const dx = ahead.x - pos.x;
          const dy = ahead.y - pos.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          drawX += (-dy / len) * PIT_LANE_OFFSET;
          drawY += (dx / len) * PIT_LANE_OFFSET;
        }



        // Direct DOM manipulation — NO React re-render
        const carGroup = svg.getElementById(`car-${slot.driver}`);
        if (carGroup) {
          carGroup.setAttribute("transform", `translate(${drawX.toFixed(1)},${drawY.toFixed(1)})`);
        }

        // Pit stop label
        const pitLabel = svg.getElementById(`pit-${slot.driver}`);
        if (pitLabel) {
          pitLabel.setAttribute("visibility", slot.isPitting ? "visible" : "hidden");
        }

        framePositions.push({ driver: slot.driver, x: drawX, y: drawY });

        positionsForReact.push({
          driver: slot.driver,
          x: drawX,
          y: drawY,
          teamColor: slot.teamColor,
          position: slot.position,
        });
      }

      // ── Battle detection — every frame, pure DOM updates ──
      const newBattles = new Set<string>();
      for (let i = 0; i < framePositions.length; i++) {
        for (let j = i + 1; j < framePositions.length; j++) {
          const dx = framePositions[i].x - framePositions[j].x;
          const dy = framePositions[i].y - framePositions[j].y;
          if (dx * dx + dy * dy < BATTLE_PROXIMITY * BATTLE_PROXIMITY) {
            newBattles.add(framePositions[i].driver);
            newBattles.add(framePositions[j].driver);
          }
        }
      }
      // Update battle ring visibility via DOM (no React re-render)
      for (const slot of slots) {
        const battleRing = svg.getElementById(`battle-${slot.driver}`);
        if (battleRing) {
          battleRing.setAttribute("visibility", newBattles.has(slot.driver) ? "visible" : "hidden");
        }
      }
      battlesRef.current = newBattles;

      // Update battle badge text via DOM
      const badgeEl = document.getElementById("battle-badge-text");
      if (badgeEl) {
        const battleCount = Math.floor(newBattles.size / 2);
        badgeEl.textContent = battleCount > 0
          ? `⚔ ${battleCount} BATTLE${battleCount > 1 ? "S" : ""}`
          : "";
      }

      // Throttled React state update for bottom bar
      if (now - lastDomUpdate > DOM_UPDATE_INTERVAL) {
        lastDomUpdate = now;
        setCarPositions(positionsForReact);
      }

      // ── Event Engine active-window prune ──
      useEventEngine.getState().tickActiveEvents();

      // ── Replay frame recording (throttled to ~2Hz) ──
      if (now - lastFrameRecordRef.current > 500) {
        lastFrameRecordRef.current = now;
        const posMap = new Map<string, { x: number; y: number; progress: number }>();
        for (const [driver, anim] of carAnimRef.current) {
          const prog = ((lp - anim.smoothOffset + anim.smoothSpread) % 1 + 1) % 1;
          posMap.set(driver, { x: anim.currentX, y: anim.currentY, progress: prog });
        }
        const rp = useTimeline.getState().raceProgress;
        const lb = useF1Store.getState().leaderboard;
        useReplayEngine.getState().recordFrame(rp, posMap, lb);
      }

      rafIdRef.current = requestAnimationFrame(animate);
    };

    rafIdRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    };
  }, [pathSamples]);

  /* ── Battle detection is now in the rAF loop (ref-based) ──────── */

  const onHover = useCallback((d: string | null) => setHoveredDriver(d), []);
  const onClickCar = useCallback(
    (d: string) => setFocusedDriver(focusedDriver === d ? null : d),
    [focusedDriver, setFocusedDriver],
  );

  /* ── Render ────────────────────────────────────────────────────── */

  if (!session) {
    return (
      <div className="h-full flex items-center justify-center bg-f1-bg">
        <div className="text-center space-y-3">
          <div className="text-6xl">🏁</div>
          <p className="text-sm text-f1-text-dim">Load a session to view the track</p>
        </div>
      </div>
    );
  }

  const slots = driverSlotsRef.current;

  return (
    <div className="h-full w-full relative overflow-hidden bg-f1-bg">
      {/* Telemetry loading overlay */}
      {!telemetryReady && (
        <TrackLoadingOverlay trackInfo={trackInfo} circuitName={session.circuit} />
      )}

      {/* Track info overlay */}
      <div className="absolute top-3 right-3 z-10 glass-panel rounded-lg px-3 py-1.5 pointer-events-none">
        <h2 className="text-[10px] font-display font-bold uppercase tracking-[0.25em] text-f1-text-dim">
          {trackInfo?.name || session.circuit}
        </h2>
        {trackInfo && (
          <p className="text-[9px] font-mono text-f1-text-muted mt-0.5">
            {trackInfo.length}km · {trackInfo.laps} laps · {trackInfo.country}
          </p>
        )}
      </div>

      {/* Lap badge */}
      <div className="absolute top-3 left-3 z-10 glass-panel rounded-lg px-3 py-1.5 flex items-center gap-2">
        <span className="text-[10px] font-display font-bold uppercase tracking-wider text-f1-text-dim">LAP</span>
        <span className="text-base font-mono font-bold text-white">{currentLap}</span>
        <span className="text-[10px] font-mono text-f1-text-muted">/ {totalLaps || session.total_laps || "—"}</span>
      </div>

      {/* Battle badge */}
      {layers.battles && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full glass-panel border border-f1-red/30">
          <span id="battle-badge-text" className="text-[10px] font-display font-bold uppercase tracking-wider text-f1-red animate-pulse">
          </span>
        </div>
      )}

      {/* ═══ SVG — track + cars ═══ */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB} ${VB}`}
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="car-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="car-glow-strong" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="track-glow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

        </defs>

        {/* Racing line */}
        {layers.racingLine && trackPathD && (
          <path d={trackPathD} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={24} filter="url(#track-glow)" />
        )}

        {/* Track glow */}
        {trackPathD && (
          <path d={trackPathD} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={24} strokeLinejoin="round" />
        )}

        {/* Track outline */}
        {trackPathD && (
          <path d={trackPathD} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={10} strokeLinejoin="round" filter="url(#track-glow)" />
        )}

        {/* Corners */}
        {trackOutline?.corners.map((c) => (
          <g key={c.number}>
            <circle cx={c.x} cy={c.y} r={3} fill="none" stroke="rgba(255,170,0,0.5)" strokeWidth={1} />
            <text x={c.x} y={c.y - 8} textAnchor="middle" fontSize="7" fill="rgba(255,170,0,0.6)" fontWeight="600">{c.number}</text>
          </g>
        ))}

        {/* Sector markers */}
        {layers.sectors && pathSamples.length > 0 && [1/3, 2/3].map((t, i) => {
          const pt = getTrackPoint(pathSamples, t);
          return (
            <g key={`s${i}`}>
              <circle cx={pt.x} cy={pt.y} r={5} fill="none" stroke="#ffaa00" strokeWidth={1.5} opacity={0.6} />
              <text x={pt.x} y={pt.y - 10} textAnchor="middle" fontSize="9" fill="#ffaa00" fontWeight="600" opacity={0.7}>S{i+1}</text>
            </g>
          );
        })}



        {/* ─── Car dots ─── */}
        {layers.cars && slots.map((slot) => {
          const active = hoveredDriver === slot.driver || focusedDriver === slot.driver;
          const r = active ? 14 : 10;
          return (
            <g
              key={slot.driver}
              id={`car-${slot.driver}`}
              transform="translate(500,500)"
              style={{ cursor: "pointer", pointerEvents: "all" }}
              onMouseEnter={() => onHover(slot.driver)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onClickCar(slot.driver)}
            >
              {/* Battle ring — always rendered, visibility toggled via rAF DOM updates */}
              {layers.battles && (
                <g id={`battle-${slot.driver}`} visibility="hidden">
                  <circle r={20} fill="none" stroke={slot.teamColor} strokeWidth={2} opacity={0.5}>
                    <animate attributeName="r" values="14;22;14" dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                </g>
              )}

              {/* Outer glow */}
              <circle r={active ? 28 : 20} fill={slot.teamColor} opacity={0.08} filter="url(#car-glow)" />
              <circle r={r + 4} fill={slot.teamColor} opacity={0.3} />

              {/* Main dot */}
              <circle
                r={r}
                fill={slot.teamColor}
                stroke={focusedDriver === slot.driver ? "#fff" : slot.position === 1 ? "#E10600" : "rgba(255,255,255,0.6)"}
                strokeWidth={focusedDriver === slot.driver ? 2.5 : slot.position === 1 ? 2 : 1.5}
                filter="url(#car-glow)"
              />

              {/* Position number */}
              <text y={4} textAnchor="middle" fontSize="9" fill="#000" fontWeight="900" fontFamily="var(--font-orbitron)">
                {slot.position}
              </text>

              {/* Driver label */}
              {layers.labels && (
                <text
                  y={-16}
                  textAnchor="middle"
                  fontSize={active ? "12" : "10"}
                  fill="#fff"
                  fontWeight="700"
                  fontFamily="var(--font-jetbrains)"
                  style={{ textShadow: `0 0 10px ${slot.teamColor}` }}
                >
                  {slot.driver}
                </text>
              )}

              {/* Gap badge */}
              {layers.gaps && slot.gapToLeader != null && slot.position > 1 && (
                <g>
                  <rect x={14} y={-8} width={44} height={16} rx={4} fill="rgba(0,0,0,0.85)" stroke={slot.teamColor} strokeWidth={0.5} />
                  <text x={36} y={4} textAnchor="middle" fontSize="8" fill="#00D2BE" fontFamily="var(--font-jetbrains)">
                    +{slot.gapToLeader.toFixed(1)}
                  </text>
                </g>
              )}

              {/* Tyre indicator */}
              {layers.tyres && slot.compound && (
                <circle cx={r + 5} cy={r + 5} r={5} fill={COMPOUND_COLORS[slot.compound.toUpperCase()] || "#888"} stroke="#000" strokeWidth={0.5} />
              )}

              {/* Hover tooltip */}
              {active && (
                <g>
                  <rect x={18} y={-42} width={140} height={60} rx={6} fill="rgba(6,6,10,0.95)" stroke={slot.teamColor} strokeWidth={1} />
                  <text x={24} y={-26} fontSize="10" fill="#fff" fontWeight="700" fontFamily="var(--font-jetbrains)">
                    P{slot.position} {slot.fullName}
                  </text>
                  <text x={24} y={-12} fontSize="8" fill="#6b6b88" fontFamily="var(--font-sans)">{slot.team}</text>
                  <text x={24} y={2} fontSize="9" fill="#00D2BE" fontFamily="var(--font-jetbrains)">
                    {slot.lapTime ? `${slot.lapTime.toFixed(3)}s` : "—"}
                  </text>
                  {slot.compound && (
                    <text x={24} y={14} fontSize="8" fill={COMPOUND_COLORS[slot.compound.toUpperCase()] || "#888"} fontFamily="var(--font-jetbrains)">
                      {slot.compound.toUpperCase()}
                    </text>
                  )}
                </g>
              )}

              {/* Pit stop banner */}
              <g id={`pit-${slot.driver}`} visibility={slot.isPitting ? "visible" : "hidden"}>
                <rect x={-22} y={18} width={44} height={16} rx={4} fill="rgba(255,0,0,0.85)" stroke="#ff4444" strokeWidth={0.8} />
                <text x={0} y={29} textAnchor="middle" fontSize="8" fill="#fff" fontWeight="900" fontFamily="var(--font-orbitron)">
                  PIT
                </text>
                {slot.pitCompound && (
                  <circle cx={28} cy={26} r={5} fill={COMPOUND_COLORS[slot.pitCompound.toUpperCase()] || "#888"} stroke="#000" strokeWidth={0.5} />
                )}
              </g>
            </g>
          );
        })}
      </svg>

      {/* Event Banner overlay */}
      <EventBanner />

      {/* Event Replay Modal — floating PIP */}
      <EventReplayModal trackPathD={trackPathD} pathSamples={pathSamples} />

      {/* Bottom driver bar */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-t from-f1-bg/95 to-transparent overflow-x-auto">
        {slots
          .slice(0, 20)
          .map((slot) => (
            <div
              key={slot.driver}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded cursor-pointer transition-all shrink-0 ${
                hoveredDriver === slot.driver || focusedDriver === slot.driver
                  ? "bg-white/10 scale-105" : "hover:bg-white/5"
              }`}
              onMouseEnter={() => onHover(slot.driver)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onClickCar(slot.driver)}
            >
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: slot.teamColor }} />
              <span className="text-[9px] font-mono font-bold text-f1-text-dim">{slot.driver}</span>
            </div>
          ))}
      </div>
    </div>
  );
});
