/**
 * AnimationLoop — production 60fps render loop using requestAnimationFrame.
 *
 * Features:
 *   - Singleton per-app (one rAF loop)
 *   - Subscribers receive deltaTime (ms) each frame
 *   - Auto-starts when first subscriber attaches
 *   - Auto-stops when last subscriber detaches
 *   - Ghost-smoothing for jump detection
 *   - Never triggers React re-renders directly (subscribers use Refs)
 */

import type { Point } from "./CoordMapper";
import { lerp, dist, ghostSmooth } from "./CoordMapper";

/* ── Types ────────────────────────────────────────────────────────── */

export type FrameCallback = (dt: number, elapsed: number) => void;

export interface CarAnimState {
  driver: string;
  current: Point;
  target: Point;
  velocity: Point;
  history: Point[]; // last 3 targets for ghost smoothing
}

/* ── Singleton Animation Loop ─────────────────────────────────────── */

class AnimationLoopSingleton {
  private subscribers = new Map<string, FrameCallback>();
  private rafId: number | null = null;
  private lastTime = 0;
  private elapsed = 0;
  private running = false;

  /** Subscribe to the frame loop. Returns an unsubscribe function. */
  subscribe(id: string, callback: FrameCallback): () => void {
    this.subscribers.set(id, callback);
    if (!this.running) this.start();
    return () => this.unsubscribe(id);
  }

  unsubscribe(id: string): void {
    this.subscribers.delete(id);
    if (this.subscribers.size === 0) this.stop();
  }

  private start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.elapsed = 0;
    this.tick();
  }

  private stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private tick = (): void => {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min(now - this.lastTime, 50); // cap at 50ms (20fps floor)
    this.lastTime = now;
    this.elapsed += dt;

    for (const cb of this.subscribers.values()) {
      cb(dt, this.elapsed);
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  isRunning(): boolean {
    return this.running;
  }
}

export const animationLoop = new AnimationLoopSingleton();

/* ── Car interpolation engine ─────────────────────────────────────── */

const LERP_FACTOR = 0.08; // smoothness (lower = smoother, higher = snappier)
const JUMP_THRESHOLD = 150; // pixels; beyond this = teleport with smoothing
const HISTORY_SIZE = 3;

export class CarInterpolator {
  private cars = new Map<string, CarAnimState>();

  /** Update target position for a car (called when new data arrives) */
  setTarget(driver: string, target: Point): void {
    let state = this.cars.get(driver);
    if (!state) {
      state = {
        driver,
        current: { ...target },
        target: { ...target },
        velocity: { x: 0, y: 0 },
        history: [{ ...target }],
      };
      this.cars.set(driver, state);
      return;
    }

    // Ghost smoothing: detect jumps
    const d = dist(state.target, target);
    if (d > JUMP_THRESHOLD) {
      // Big jump — use ghost-smoothed position
      state.history = [{ ...target }];
      state.target = { ...target };
    } else {
      state.history.push({ ...target });
      if (state.history.length > HISTORY_SIZE) state.history.shift();
      state.target = ghostSmooth(state.history);
    }
  }

  /** Call each frame with deltaTime to advance interpolation */
  tick(dt: number): void {
    const factor = Math.min(1, LERP_FACTOR * (dt / 16.67)); // normalize to 60fps
    for (const state of this.cars.values()) {
      const prev = { ...state.current };
      state.current = lerp(state.current, state.target, factor);
      state.velocity = {
        x: (state.current.x - prev.x) / (dt || 1),
        y: (state.current.y - prev.y) / (dt || 1),
      };
    }
  }

  /** Get the smoothly interpolated position for a car */
  getPosition(driver: string): Point | null {
    return this.cars.get(driver)?.current ?? null;
  }

  /** Get all interpolated car states */
  getAll(): CarAnimState[] {
    return Array.from(this.cars.values());
  }

  /** Remove a car (DNF, etc.) */
  remove(driver: string): void {
    this.cars.delete(driver);
  }

  /** Clear everything */
  clear(): void {
    this.cars.clear();
  }
}
