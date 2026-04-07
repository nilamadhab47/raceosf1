"use client";

/**
 * EventReplayModal — floating PIP (Picture-in-Picture) overlay that shows
 * a zoomed-in mini-track view of an active event's involved drivers.
 *
 * Opens when useReplayEngine.activeEvent is set (via openEvent()).
 * Closes on user click or auto-timeout. Main track stays untouched.
 *
 * Camera polish:
 *   - GSAP-animated viewBox for smooth cinematic panning/zooming
 *   - GSAP-animated driver dot positions (lerp, no snapping)
 *   - clip.zoom drives zoom tightness; clip.cameraMode drives framing
 *   - Per-event-type clip windows tuned in EventEngine
 */

import { useEffect, useRef, useState, useCallback, memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";
import { useReplayEngine, REPLAY_SPEED_OPTIONS } from "@/engines/ReplayEngine";
import { useF1Store } from "@/store/f1-store";
import type { RaceEvent } from "@/engines/EventEngine";

/* ── Types ────────────────────────────────────────────────────────── */

interface TrackSample {
  x: number;
  y: number;
  progress: number;
}

interface EventReplayModalProps {
  trackPathD: string;
  pathSamples: TrackSample[];
}

/* ── Constants ────────────────────────────────────────────────────── */

const MODAL_W = 380;
const MODAL_H = 340;
const BASE_PADDING = 140;   // SVG units — scaled by 1/clip.zoom
const AUTO_CLOSE_MS = 15_000;
const VIEWBOX_EASE_DURATION = 0.8; // seconds for viewBox transitions
const DOT_EASE_DURATION = 0.5;     // seconds for dot position transitions

const EVENT_ICONS: Record<string, string> = {
  overtake: "⚔️",
  battle: "🔥",
  pit_stop: "🔧",
  incident: "⚠️",
  fastest_lap: "⏱️",
};

const SEVERITY_COLORS: Record<string, string> = {
  low: "#3b82f6",
  medium: "#f59e0b",
  high: "#ef4444",
};

/* ── Helpers ──────────────────────────────────────────────────────── */

function getTrackPoint(samples: TrackSample[], progress: number): { x: number; y: number } {
  if (samples.length === 0) return { x: 500, y: 500 };
  const p = ((progress % 1) + 1) % 1;
  const idx = p * (samples.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, samples.length - 1);
  const t = idx - lo;
  return {
    x: samples[lo].x + (samples[hi].x - samples[lo].x) * t,
    y: samples[lo].y + (samples[hi].y - samples[lo].y) * t,
  };
}

/** Compute viewBox params as numbers (for GSAP interpolation). */
function computeZoomedViewBox(
  points: { x: number; y: number }[],
  padding: number,
): { vx: number; vy: number; vw: number; vh: number } {
  if (points.length === 0) return { vx: 0, vy: 0, vw: 1000, vh: 1000 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const spanX = maxX - minX + padding * 2;
  const spanY = maxY - minY + padding * 2;
  const span = Math.max(spanX, spanY, 120);
  return { vx: cx - span / 2, vy: cy - span / 2, vw: span, vh: span };
}

function vbString(v: { vx: number; vy: number; vw: number; vh: number }): string {
  return `${v.vx.toFixed(1)} ${v.vy.toFixed(1)} ${v.vw.toFixed(1)} ${v.vh.toFixed(1)}`;
}

/* ── Component ────────────────────────────────────────────────────── */

export const EventReplayModal = memo(function EventReplayModal({
  trackPathD,
  pathSamples,
}: EventReplayModalProps) {
  const activeEvent = useReplayEngine((s) => s.activeEvent);
  const replaySpeed = useReplayEngine((s) => s.replaySpeed);
  const closeEvent = useReplayEngine((s) => s.closeEvent);
  const setReplaySpeed = useReplayEngine((s) => s.setReplaySpeed);
  const getFrameRange = useReplayEngine((s) => s.getFrameRange);
  const leaderboard = useF1Store((s) => s.leaderboard);

  const [playbackIdx, setPlaybackIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const framesRef = useRef<ReturnType<typeof getFrameRange>>([]);
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number>(0);
  const lastTickRef = useRef(0);

  // GSAP refs for smooth camera
  const svgRef = useRef<SVGSVGElement>(null);
  const viewBoxRef = useRef({ vx: 0, vy: 0, vw: 1000, vh: 1000 });
  const dotGroupRefs = useRef<Map<string, SVGGElement>>(new Map());

  // When event changes, load frames from the ring buffer
  useEffect(() => {
    if (!activeEvent) {
      framesRef.current = [];
      setPlaybackIdx(0);
      return;
    }
    const clip = activeEvent.clip;
    if (clip) {
      framesRef.current = getFrameRange(clip.start, clip.end);
    }
    setPlaybackIdx(0);
    setIsPaused(false);
  }, [activeEvent, getFrameRange]);

  // Auto-close timer
  useEffect(() => {
    if (!activeEvent) return;
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    autoCloseRef.current = setTimeout(() => {
      closeEvent();
    }, AUTO_CLOSE_MS);
    return () => {
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    };
  }, [activeEvent, closeEvent]);

  // Playback animation loop
  useEffect(() => {
    if (!activeEvent || isPaused) return;
    const frames = framesRef.current;
    if (frames.length === 0) return;

    const step = (now: number) => {
      if (lastTickRef.current === 0) lastTickRef.current = now;
      const dt = now - lastTickRef.current;
      if (dt >= 100 / replaySpeed) {
        lastTickRef.current = now;
        setPlaybackIdx((prev) => {
          const next = prev + 1;
          if (next >= frames.length) {
            closeEvent();
            return prev;
          }
          return next;
        });
      }
      rafRef.current = requestAnimationFrame(step);
    };

    lastTickRef.current = 0;
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [activeEvent, isPaused, replaySpeed, closeEvent]);

  // GSAP viewBox animation — runs whenever playbackIdx changes
  useEffect(() => {
    if (!activeEvent || !svgRef.current) return;

    const frames = framesRef.current;
    const currentFrame = frames.length > 0 ? frames[Math.min(playbackIdx, frames.length - 1)] : null;
    const driverCodes = activeEvent.drivers;
    const clip = activeEvent.clip;

    // Use clip.zoom to scale padding: higher zoom = less padding = tighter
    const zoomFactor = clip?.zoom ?? 2.0;
    const padding = BASE_PADDING / (zoomFactor / 2.0);

    // Resolve driver positions for this frame
    const points: { x: number; y: number }[] = [];
    for (const code of driverCodes) {
      if (currentFrame) {
        const pos = currentFrame.positions.get(code);
        if (pos) { points.push({ x: pos.x, y: pos.y }); continue; }
      }
      const pt = getTrackPoint(pathSamples, activeEvent.trackProgress);
      points.push(pt);
    }

    // Camera mode framing: "battle" centers between drivers, "follow" centers on first
    let targetVB: { vx: number; vy: number; vw: number; vh: number };
    if (clip?.cameraMode === "follow" && points.length > 0) {
      // Center on primary driver with fixed span
      const span = Math.max(200 / (zoomFactor / 2.0), 120);
      targetVB = {
        vx: points[0].x - span / 2,
        vy: points[0].y - span / 2,
        vw: span,
        vh: span,
      };
    } else {
      targetVB = computeZoomedViewBox(points, padding);
    }

    // Animate viewBox smoothly via GSAP
    const svg = svgRef.current;
    gsap.to(viewBoxRef.current, {
      vx: targetVB.vx,
      vy: targetVB.vy,
      vw: targetVB.vw,
      vh: targetVB.vh,
      duration: VIEWBOX_EASE_DURATION,
      ease: "power2.out",
      overwrite: true,
      onUpdate() {
        svg.setAttribute("viewBox", vbString(viewBoxRef.current));
      },
    });

    // Animate each driver dot position via GSAP
    for (let i = 0; i < driverCodes.length; i++) {
      const code = driverCodes[i];
      const el = dotGroupRefs.current.get(code);
      if (!el || !points[i]) continue;
      gsap.to(el, {
        attr: { transform: `translate(${points[i].x}, ${points[i].y})` },
        duration: DOT_EASE_DURATION,
        ease: "power2.out",
        overwrite: true,
      });
    }
  }, [playbackIdx, activeEvent, pathSamples]);

  const handleClose = useCallback(() => {
    closeEvent();
  }, [closeEvent]);

  const togglePause = useCallback(() => {
    setIsPaused((p) => !p);
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
  }, []);

  const setDotRef = useCallback((code: string) => (el: SVGGElement | null) => {
    if (el) dotGroupRefs.current.set(code, el);
    else dotGroupRefs.current.delete(code);
  }, []);

  if (!activeEvent) return null;

  // Build driver data for rendering (initial positions — GSAP handles animation)
  const driverCodes = activeEvent.drivers;
  const driverLookup = new Map(leaderboard.map((d) => [d.driver, d]));

  const driverDots: {
    code: string;
    x: number;
    y: number;
    color: string;
    fullName: string;
  }[] = [];

  const frames = framesRef.current;
  const currentFrame = frames.length > 0 ? frames[Math.min(playbackIdx, frames.length - 1)] : null;

  for (const code of driverCodes) {
    const lb = driverLookup.get(code);
    const color = lb
      ? lb.team_color.startsWith("#") ? lb.team_color : `#${lb.team_color}`
      : "#ffffff";
    const fullName = lb?.full_name ?? code;

    if (currentFrame) {
      const pos = currentFrame.positions.get(code);
      if (pos) { driverDots.push({ code, x: pos.x, y: pos.y, color, fullName }); continue; }
    }
    const pt = getTrackPoint(pathSamples, activeEvent.trackProgress);
    driverDots.push({ code, x: pt.x, y: pt.y, color, fullName });
  }

  const progress = frames.length > 1 ? playbackIdx / (frames.length - 1) : 0;
  const severityColor = SEVERITY_COLORS[activeEvent.severity] ?? "#3b82f6";

  // Clip duration display
  const clip = activeEvent.clip;
  const clipDurationSec = clip ? ((clip.end - clip.start) * 12).toFixed(1) : null; // ~12s per 1.0 raceProgress
  const currentTimeSec = clip ? ((progress * (clip.end - clip.start)) * 12).toFixed(1) : null;

  // Initial viewBox (GSAP will animate from here)
  const zoomFactor = clip?.zoom ?? 2.0;
  const initPadding = BASE_PADDING / (zoomFactor / 2.0);
  const initVB = computeZoomedViewBox(
    driverDots.map((d) => ({ x: d.x, y: d.y })),
    initPadding,
  );

  return (
    <AnimatePresence>
      <motion.div
        key={activeEvent.id}
        initial={{ opacity: 0, scale: 0.85, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.85, y: 30 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className="absolute bottom-20 right-4 z-50 rounded-[6px] overflow-hidden shadow-2xl"
        style={{
          width: MODAL_W,
          height: MODAL_H,
          background: "#111111",
          border: `1px solid ${severityColor}44`,
        }}
      >
        {/* Header bar */}
        <div
          className="flex items-center justify-between px-3 py-1.5"
          style={{ borderBottom: `1px solid ${severityColor}33` }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base">{EVENT_ICONS[activeEvent.type] ?? "📍"}</span>
            <span
              className="text-xs font-semibold uppercase tracking-wider truncate"
              style={{ color: severityColor }}
            >
              {activeEvent.type.replace("_", " ")}
            </span>
            <span className="text-[10px] text-white/40">Lap {activeEvent.lap}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Speed selector */}
            <div className="flex items-center gap-0.5">
              {REPLAY_SPEED_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setReplaySpeed(s)}
                  className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                    replaySpeed === s
                      ? "bg-white/15 text-white"
                      : "text-white/30 hover:text-white/60"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
            {/* Pause/Play */}
            <button
              onClick={togglePause}
              className="text-white/50 hover:text-white transition-colors text-xs px-1"
              title={isPaused ? "Play" : "Pause"}
            >
              {isPaused ? "▶" : "⏸"}
            </button>
            {/* Close */}
            <button
              onClick={handleClose}
              className="text-white/30 hover:text-white transition-colors text-sm leading-none px-1"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Mini-track SVG — GSAP drives viewBox + dot positions */}
        <svg
          ref={svgRef}
          viewBox={vbString(initVB)}
          className="w-full"
          style={{ height: MODAL_H - 90 }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Track path */}
          <path
            d={trackPathD}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={8}
            strokeLinejoin="round"
          />
          <path
            d={trackPathD}
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth={3}
            strokeLinejoin="round"
          />

          {/* Driver dots — positions animated by GSAP */}
          {driverDots.map((dot) => (
            <g
              key={dot.code}
              ref={setDotRef(dot.code)}
              transform={`translate(${dot.x}, ${dot.y})`}
            >
              {/* Glow */}
              <circle r={18} fill={dot.color} opacity={0.15} />
              {/* Outer ring */}
              <circle r={10} fill={dot.color} opacity={0.4} />
              {/* Inner dot */}
              <circle r={6} fill={dot.color} />
              {/* Driver code label */}
              <text
                y={-16}
                textAnchor="middle"
                fill="white"
                fontSize={12}
                fontWeight="bold"
                style={{ textShadow: `0 0 8px ${dot.color}` }}
              >
                {dot.code}
              </text>
            </g>
          ))}
        </svg>

        {/* Footer: event message + duration + progress bar */}
        <div className="px-3 pb-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-white/50 truncate flex-1 mr-2">
              {activeEvent.message}
            </p>
            {clipDurationSec && currentTimeSec && (
              <span className="text-[9px] font-mono text-white/30 shrink-0">
                {currentTimeSec}s / {clipDurationSec}s
              </span>
            )}
          </div>
          {/* Progress bar */}
          <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-100"
              style={{
                width: `${progress * 100}%`,
                background: severityColor,
              }}
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});
