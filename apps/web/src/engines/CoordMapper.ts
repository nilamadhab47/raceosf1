/**
 * CoordMapper — maps raw telemetry (X, Y) to SVG viewBox space.
 *
 * Pipeline:
 *   1. Compute bounding box of reference track telemetry
 *   2. Normalize to [0, 1]
 *   3. Preserve aspect ratio (fit inside target rect)
 *   4. Invert Y (telemetry Y grows up, SVG Y grows down)
 *   5. Apply padding
 *   6. (Optional) Snap to nearest pre-sampled SVG path point
 */

/* ── Types ────────────────────────────────────────────────────────── */

export interface Point {
  x: number;
  y: number;
}

export interface BBox {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface PathSample {
  x: number;
  y: number;
  progress: number; // 0–1 along the path
}

export interface MapperConfig {
  /** Target viewport width (e.g. 1000) */
  width: number;
  /** Target viewport height (e.g. 1000) */
  height: number;
  /** Padding fraction 0–0.5 (default 0.08) */
  padding?: number;
  /** Invert Y axis (default true — telemetry Y↑ but SVG Y↓) */
  invertY?: boolean;
}

/* ── Mapper class ─────────────────────────────────────────────────── */

export class CoordMapper {
  private bbox: BBox = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
  private cfg: Required<MapperConfig>;
  private pathSamples: PathSample[] = [];

  // Pre‑computed transform constants
  private scaleX = 1;
  private scaleY = 1;
  private offsetX = 0;
  private offsetY = 0;

  constructor(config: MapperConfig) {
    this.cfg = {
      padding: 0.08,
      invertY: true,
      ...config,
    };
  }

  /* ── Step 1 — Set reference telemetry bounding box ────────────── */

  setReferenceBounds(xs: number[], ys: number[]): void {
    if (xs.length === 0 || ys.length === 0) return;
    this.bbox = {
      xMin: Math.min(...xs),
      xMax: Math.max(...xs),
      yMin: Math.min(...ys),
      yMax: Math.max(...ys),
    };
    this.recompute();
  }

  setBBox(bbox: BBox): void {
    this.bbox = bbox;
    this.recompute();
  }

  /* ── Step 2–5 — Pre-compute affine transform constants ────────── */

  private recompute(): void {
    const { width, height, padding } = this.cfg;
    const { xMin, xMax, yMin, yMax } = this.bbox;

    const rangeX = xMax - xMin || 1;
    const rangeY = yMax - yMin || 1;

    // Step 3 — aspect ratio
    const trackAspect = rangeX / rangeY;
    const viewAspect = width / height;

    const usable = 1 - padding * 2;
    let sx: number, sy: number, ox: number, oy: number;

    if (trackAspect > viewAspect) {
      // Track is wider → fit to width
      sx = (width * usable) / rangeX;
      sy = sx; // uniform scale
      ox = width * padding;
      oy = (height - rangeY * sy) / 2;
    } else {
      // Track is taller → fit to height
      sy = (height * usable) / rangeY;
      sx = sy; // uniform scale
      ox = (width - rangeX * sx) / 2;
      oy = height * padding;
    }

    this.scaleX = sx;
    this.scaleY = sy;
    this.offsetX = ox;
    this.offsetY = oy;
  }

  /* ── Map a single telemetry point ─────────────────────────────── */

  map(rawX: number, rawY: number): Point {
    const { xMin, yMin, yMax } = this.bbox;
    const { invertY, height, padding } = this.cfg;

    let x = (rawX - xMin) * this.scaleX + this.offsetX;
    let y: number;

    if (invertY) {
      y = (yMax - rawY) * this.scaleY + this.offsetY;
    } else {
      y = (rawY - yMin) * this.scaleY + this.offsetY;
    }

    return { x, y };
  }

  /* ── Map + snap to nearest pre-sampled path point ─────────────── */

  mapSnapped(rawX: number, rawY: number): Point & { progress: number } {
    const mapped = this.map(rawX, rawY);
    if (this.pathSamples.length === 0) {
      return { ...mapped, progress: 0 };
    }
    return this.snapToPath(mapped.x, mapped.y);
  }

  /* ── Path sampling for SVG track outlines ─────────────────────── */

  sampleSVGPath(pathEl: SVGPathElement, n: number = 600): void {
    const total = pathEl.getTotalLength();
    this.pathSamples = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const pt = pathEl.getPointAtLength(t * total);
      this.pathSamples.push({ x: pt.x, y: pt.y, progress: t });
    }
  }

  setPathSamples(samples: PathSample[]): void {
    this.pathSamples = samples;
  }

  getPathSamples(): PathSample[] {
    return this.pathSamples;
  }

  /* ── Snap a viewport-space point to nearest path sample ───────── */

  snapToPath(x: number, y: number): Point & { progress: number } {
    let bestDist = Infinity;
    let bestSample: PathSample = { x, y, progress: 0 };
    for (const s of this.pathSamples) {
      const d = (s.x - x) ** 2 + (s.y - y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        bestSample = s;
      }
    }
    return { x: bestSample.x, y: bestSample.y, progress: bestSample.progress };
  }

  /* ── Convert path progress back to viewport XY ────────────────── */

  progressToXY(pathEl: SVGPathElement, progress: number): Point {
    const total = pathEl.getTotalLength();
    const pt = pathEl.getPointAtLength(Math.max(0, Math.min(1, progress)) * total);
    return { x: pt.x, y: pt.y };
  }

  /* ── Catmull-Rom spline interpolation for smooth curves ────────── */

  static catmullRom(
    p0: Point,
    p1: Point,
    p2: Point,
    p3: Point,
    t: number,
    alpha = 0.5,
  ): Point {
    const t2 = t * t;
    const t3 = t2 * t;

    const x =
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);

    const y =
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);

    return { x, y };
  }
}

/* ── Standalone interpolation helpers ─────────────────────────────── */

/** Linear interpolation between two points */
export function lerp(p1: Point, p2: Point, t: number): Point {
  return {
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t,
  };
}

/** Scalar lerp */
export function lerpScalar(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Distance between two points */
export function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/** Ghost smoothing — weighted average of last N target positions */
export function ghostSmooth(history: Point[], weights?: number[]): Point {
  if (history.length === 0) return { x: 0, y: 0 };
  const w = weights || history.map((_, i) => i + 1); // newer = heavier
  const wSum = w.reduce((a, b) => a + b, 0);
  let x = 0, y = 0;
  for (let i = 0; i < history.length; i++) {
    x += history[i].x * w[i];
    y += history[i].y * w[i];
  }
  return { x: x / wSum, y: y / wSum };
}
