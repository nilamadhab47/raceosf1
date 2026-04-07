/**
 * CameraEngine — cinematic camera system for the track visualization.
 *
 * Uses `<g transform>` (GPU-composited) instead of dynamic viewBox (SVG relayout).
 * Implements velocity-based inertia for natural camera movement.
 * GSAP used only for discrete mode transitions (overview→follow), not frame-to-frame.
 *
 * Camera modes:
 *   - overview: full track (zoom=1, center)
 *   - follow: track a single driver (zoom=2.5)
 *   - battle: center between two battling drivers (dynamic zoom)
 *   - auto: delegated to DirectorEngine
 */

import { create } from "zustand";

/* ── Types ────────────────────────────────────────────────────────── */

export type CameraMode = "overview" | "follow" | "battle" | "auto";

export interface CameraState {
  // Position in SVG coordinate space (0–1000)
  x: number;
  y: number;
  zoom: number;

  // Velocity for inertia smoothing
  vx: number;
  vy: number;
  vz: number; // zoom velocity

  mode: CameraMode;
  targetDriver: string | null;
  targetDrivers: string[];      // for battle mode
  isTransitioning: boolean;

  // Auto director enable
  autoDirector: boolean;

  // Actions
  setMode: (mode: CameraMode) => void;
  followDriver: (driver: string) => void;
  battleMode: (d1: string, d2: string) => void;
  overview: () => void;
  setAutoDirector: (enabled: boolean) => void;

  /**
   * Called every animation frame. Reads target positions from
   * the provided getCarPosition callback, applies inertia smoothing.
   * Returns the current camera transform values.
   */
  tick: (dt: number, getCarPosition: (driver: string) => { x: number; y: number } | null) => CameraTransform;

  /** Hard-set camera position (for replay seek / URL restore) */
  jumpTo: (x: number, y: number, zoom: number) => void;
}

export interface CameraTransform {
  tx: number;  // translate X for <g transform>
  ty: number;  // translate Y
  scale: number;
}

/* ── Constants ────────────────────────────────────────────────────── */

const VB = 1000;
const CENTER = VB / 2;

// Inertia tuning
const SPRING = 0.045;      // how fast camera chases target (higher = snappier)
const DAMPING = 0.82;       // velocity decay (lower = more damping)
const ZOOM_SPRING = 0.035;
const ZOOM_DAMPING = 0.80;

// Zoom levels
const OVERVIEW_ZOOM = 1.0;
const FOLLOW_ZOOM = 2.5;
const BATTLE_ZOOM_MIN = 1.8;
const BATTLE_ZOOM_MAX = 3.0;
const BATTLE_PADDING = 200;  // SVG units padding around battle pair

/* ── Compute <g transform> from camera state ─────────────────────── */

function computeTransform(cx: number, cy: number, zoom: number): CameraTransform {
  // Center of viewport in SVG space is (500, 500)
  // We want camera.x,y to appear at viewport center
  const tx = CENTER - cx * zoom;
  const ty = CENTER - cy * zoom;
  return { tx, ty, scale: zoom };
}

/* ── Store ────────────────────────────────────────────────────────── */

export const useCamera = create<CameraState>((set, get) => ({
  x: CENTER,
  y: CENTER,
  zoom: OVERVIEW_ZOOM,
  vx: 0,
  vy: 0,
  vz: 0,
  mode: "overview",
  targetDriver: null,
  targetDrivers: [],
  isTransitioning: false,
  autoDirector: false,

  setMode: (mode) => set({ mode, isTransitioning: true }),

  followDriver: (driver) =>
    set({
      mode: "follow",
      targetDriver: driver,
      targetDrivers: [],
      isTransitioning: true,
    }),

  battleMode: (d1, d2) =>
    set({
      mode: "battle",
      targetDriver: null,
      targetDrivers: [d1, d2],
      isTransitioning: true,
    }),

  overview: () =>
    set({
      mode: "overview",
      targetDriver: null,
      targetDrivers: [],
      isTransitioning: true,
    }),

  setAutoDirector: (enabled) => set({ autoDirector: enabled, mode: enabled ? "auto" : "overview" }),

  tick: (dt, getCarPosition) => {
    const s = get();
    let targetX = CENTER;
    let targetY = CENTER;
    let targetZoom = OVERVIEW_ZOOM;

    const effectiveMode = s.mode === "auto" ? s.mode : s.mode;

    if (effectiveMode === "follow" || (effectiveMode === "auto" && s.targetDriver)) {
      const driver = s.targetDriver;
      if (driver) {
        const pos = getCarPosition(driver);
        if (pos) {
          targetX = pos.x;
          targetY = pos.y;
          targetZoom = FOLLOW_ZOOM;
        }
      }
    } else if (effectiveMode === "battle" || (effectiveMode === "auto" && s.targetDrivers.length === 2)) {
      const drivers = s.targetDrivers;
      if (drivers.length === 2) {
        const p1 = getCarPosition(drivers[0]);
        const p2 = getCarPosition(drivers[1]);
        if (p1 && p2) {
          targetX = (p1.x + p2.x) / 2;
          targetY = (p1.y + p2.y) / 2;

          // Dynamic zoom to keep both cars in frame
          const dx = Math.abs(p1.x - p2.x);
          const dy = Math.abs(p1.y - p2.y);
          const dist = Math.max(dx, dy) + BATTLE_PADDING;
          targetZoom = Math.min(BATTLE_ZOOM_MAX, Math.max(BATTLE_ZOOM_MIN, VB / dist));
        }
      }
    }
    // overview: targetX/Y/Zoom remain at center/1.0

    // ── Velocity-based inertia smoothing ──────────────────────────
    const dtNorm = Math.min(dt / 16.67, 3); // normalize to 60fps, cap at 3x

    let { vx, vy, vz, x, y, zoom } = s;

    // Spring force toward target
    vx += (targetX - x) * SPRING * dtNorm;
    vy += (targetY - y) * SPRING * dtNorm;
    vz += (targetZoom - zoom) * ZOOM_SPRING * dtNorm;

    // Damping
    vx *= DAMPING;
    vy *= DAMPING;
    vz *= ZOOM_DAMPING;

    // Apply velocity
    x += vx * dtNorm;
    y += vy * dtNorm;
    zoom += vz * dtNorm;

    // Clamp zoom
    zoom = Math.max(0.5, Math.min(5.0, zoom));

    // Check if transition is done (close enough to target)
    const settled =
      Math.abs(targetX - x) < 0.5 &&
      Math.abs(targetY - y) < 0.5 &&
      Math.abs(targetZoom - zoom) < 0.01;

    set({ x, y, zoom, vx, vy, vz, isTransitioning: !settled });

    return computeTransform(x, y, zoom);
  },

  jumpTo: (x, y, zoom) =>
    set({ x, y, zoom, vx: 0, vy: 0, vz: 0, isTransitioning: false }),
}));

/* ── Utility: compute transform without store ─────────────────────── */

export { computeTransform };
