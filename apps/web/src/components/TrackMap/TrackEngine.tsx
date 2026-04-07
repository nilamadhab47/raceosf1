"use client";

import {
  useEffect,
  useRef,
  useState,
  memo,
  useCallback,
  useMemo,
} from "react";
import gsap from "gsap";
import { useF1Store } from "@/store/f1-store";
import { useTimeline } from "@/engines/Timeline";
import { resolveTrack } from "@/lib/trackMapping";
import { api } from "@/lib/api";
import type { DriverPosition } from "@/lib/types";

/* ─── Types ────────────────────────────────────────────────────────── */

interface PathPoint {
  x: number;
  y: number;
  progress: number; // 0–1
}

interface CarState {
  driver: string;
  fullName: string;
  team: string;
  teamColor: string;
  position: number;
  lapTime: number | null;
  progress: number; // 0–1 along track
  x: number;
  y: number;
  targetX: number;
  targetY: number;
}

export type LayerKey =
  | "cars"
  | "labels"
  | "battles"
  | "racingLine"
  | "sectors"
  | "gaps"
  | "tyres";

/* ─── Path sampler — pre-sample track at N points ────────────────── */

function samplePath(path: SVGPathElement, n = 500): PathPoint[] {
  const total = path.getTotalLength();
  const pts: PathPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const pt = path.getPointAtLength(t * total);
    pts.push({ x: pt.x, y: pt.y, progress: t });
  }
  return pts;
}

/** Binary-search to find nearest path progress for a raw (x,y) in 0–1000 overlay space */
function nearestProgress(
  samples: PathPoint[],
  rawX: number,
  rawY: number,
  svgVB: { w: number; h: number },
  overlaySize: number
): number {
  // Scale raw overlay coords into SVG viewBox space
  const sx = (rawX / overlaySize) * svgVB.w;
  const sy = (rawY / overlaySize) * svgVB.h;
  let bestDist = Infinity;
  let bestT = 0;
  for (const pt of samples) {
    const d = (pt.x - sx) ** 2 + (pt.y - sy) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestT = pt.progress;
    }
  }
  return bestT;
}

/** Convert path progress (0–1) to overlay coordinates */
function progressToXY(
  path: SVGPathElement,
  progress: number,
  svgVB: { w: number; h: number },
  overlaySize: number
): { x: number; y: number } {
  const total = path.getTotalLength();
  const pt = path.getPointAtLength(progress * total);
  return {
    x: (pt.x / svgVB.w) * overlaySize,
    y: (pt.y / svgVB.h) * overlaySize,
  };
}

/* ─── CarDot — 60fps GSAP animated car ─────────────────────────── */

interface CarDotProps {
  car: CarState;
  isBattle: boolean;
  isHovered: boolean;
  isFocused: boolean;
  onHover: (d: string | null) => void;
  onClick: (d: string) => void;
  showLabel: boolean;
  showGap: boolean;
  showTyre: boolean;
  compound?: string | null;
  gapToLeader?: number | null;
}

const CarDot = memo(function CarDot({
  car,
  isBattle,
  isHovered,
  isFocused,
  onHover,
  onClick,
  showLabel,
  showGap,
  showTyre,
  compound,
  gapToLeader,
}: CarDotProps) {
  const gRef = useRef<SVGGElement>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  // Smooth 60fps position animation
  useEffect(() => {
    if (!gRef.current) return;
    tweenRef.current?.kill();
    tweenRef.current = gsap.to(gRef.current, {
      attr: { transform: `translate(${car.targetX}, ${car.targetY})` },
      duration: 1.6,
      ease: "power1.out",
      overwrite: true,
    });
  }, [car.targetX, car.targetY]);

  const r = isHovered || isFocused ? 10 : 7;
  const dim = !isHovered && !isFocused ? 0.7 : 1;

  const COMPOUND_COLORS: Record<string, string> = {
    SOFT: "#ff3333",
    MEDIUM: "#ffcc00",
    HARD: "#cccccc",
    INTERMEDIATE: "#22cc44",
    WET: "#2277ff",
  };

  return (
    <g
      ref={gRef}
      transform={`translate(${car.x}, ${car.y})`}
      style={{ pointerEvents: "all", cursor: "pointer", opacity: dim }}
      onMouseEnter={() => onHover(car.driver)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(car.driver)}
    >
      {/* Battle pulse ring */}
      {isBattle && (
        <circle
          r={18}
          fill="none"
          stroke={car.teamColor}
          strokeWidth={2}
          opacity={0.5}
          className="animate-pulse"
        />
      )}

      {/* Outer glow */}
      <circle
        r={isHovered || isFocused ? 22 : 14}
        fill={car.teamColor}
        opacity={0.12}
        filter="url(#car-glow)"
      />

      {/* Trail tail — little comet effect */}
      <circle r={r + 2} fill={car.teamColor} opacity={0.25} />

      {/* Main dot */}
      <circle
        r={r}
        fill={car.teamColor}
        stroke={isFocused ? "#fff" : "rgba(255,255,255,0.6)"}
        strokeWidth={isFocused ? 2.5 : 1.5}
        filter={isBattle ? "url(#car-glow-strong)" : "url(#car-glow)"}
      />

      {/* Position number inside dot */}
      <text
        y={3.5}
        textAnchor="middle"
        fontSize="7"
        fill="#000"
        fontWeight="900"
        fontFamily="var(--font-orbitron)"
      >
        {car.position}
      </text>

      {/* Driver code label */}
      {showLabel && (
        <text
          y={-15}
          textAnchor="middle"
          fontSize={isHovered || isFocused ? "11" : "9"}
          fill="#fff"
          fontWeight="700"
          fontFamily="var(--font-jetbrains)"
          style={{ textShadow: `0 0 10px ${car.teamColor}` }}
        >
          {car.driver}
        </text>
      )}

      {/* Gap badge */}
      {showGap && gapToLeader != null && car.position > 1 && (
        <g>
          <rect
            x={12}
            y={-8}
            width={42}
            height={16}
            rx={4}
            fill="rgba(0,0,0,0.8)"
            stroke={car.teamColor}
            strokeWidth={0.5}
          />
          <text
            x={33}
            y={4}
            textAnchor="middle"
            fontSize="8"
            fill="#00ff88"
            fontFamily="var(--font-jetbrains)"
          >
            +{gapToLeader.toFixed(1)}
          </text>
        </g>
      )}

      {/* Tyre indicator */}
      {showTyre && compound && (
        <circle
          cx={r + 4}
          cy={r + 4}
          r={4}
          fill={COMPOUND_COLORS[compound.toUpperCase()] || "#888"}
          stroke="#000"
          strokeWidth={0.5}
        />
      )}

      {/* Hover detail tooltip */}
      {(isHovered || isFocused) && (
        <g>
          <rect
            x={16}
            y={-36}
            width={120}
            height={54}
            rx={6}
            fill="rgba(10,10,15,0.95)"
            stroke={car.teamColor}
            strokeWidth={1}
          />
          <text
            x={22}
            y={-20}
            fontSize="10"
            fill="#fff"
            fontWeight="700"
            fontFamily="var(--font-jetbrains)"
          >
            P{car.position} {car.fullName}
          </text>
          <text
            x={22}
            y={-7}
            fontSize="8"
            fill="#6b6b88"
            fontFamily="var(--font-exo2)"
          >
            {car.team}
          </text>
          <text
            x={22}
            y={6}
            fontSize="9"
            fill="#00ff88"
            fontFamily="var(--font-jetbrains)"
          >
            {car.lapTime ? `${car.lapTime.toFixed(3)}s` : "—"}
          </text>
          {compound && (
            <text
              x={22}
              y={18}
              fontSize="8"
              fill={
                COMPOUND_COLORS[compound.toUpperCase()] || "#888"
              }
              fontFamily="var(--font-jetbrains)"
            >
              {compound.toUpperCase()}{" "}
            </text>
          )}
        </g>
      )}
    </g>
  );
});

/* ─── Sector dividers ── drawn on the path at 33% and 66% ──────── */

function SectorLines({
  path,
  svgVB,
  overlaySize,
}: {
  path: SVGPathElement;
  svgVB: { w: number; h: number };
  overlaySize: number;
}) {
  const sectors = [1 / 3, 2 / 3];
  return (
    <>
      {sectors.map((t, i) => {
        const { x, y } = progressToXY(path, t, svgVB, overlaySize);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={4} fill="none" stroke="#ffaa00" strokeWidth={1.5} opacity={0.6} />
            <text
              x={x}
              y={y - 8}
              textAnchor="middle"
              fontSize="8"
              fill="#ffaa00"
              fontWeight="600"
              opacity={0.7}
            >
              S{i + 1}
            </text>
          </g>
        );
      })}
    </>
  );
}

/* ─── Racing line glow — a dimmed copy of the actual track path ─── */

function RacingLineOverlay({ svgContent }: { svgContent: string }) {
  return (
    <div
      className="absolute inset-0 pointer-events-none [&_svg]:w-full [&_svg]:h-full [&_path]:stroke-f1-green/15 [&_path]:fill-none [&_path]:stroke-[6]"
      style={{ filter: "blur(3px)" }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}

/* ─── Main TrackEngine ─────────────────────────────────────────── */

interface TrackEngineProps {
  layers: Record<LayerKey, boolean>;
}

export const TrackEngine = memo(function TrackEngine({ layers }: TrackEngineProps) {
  const { session, leaderboard, focusedDriver, setFocusedDriver } =
    useF1Store();
  const { currentLap, isPlaying } = useTimeline();

  const [svgContent, setSvgContent] = useState("");
  const [hoveredDriver, setHoveredDriver] = useState<string | null>(null);
  const [driverPositions, setDriverPositions] = useState<DriverPosition[]>([]);
  const [carStates, setCarStates] = useState<CarState[]>([]);

  const trackPathRef = useRef<SVGPathElement | null>(null);
  const samplesRef = useRef<PathPoint[]>([]);
  const svgWrapperRef = useRef<HTMLDivElement>(null);
  const svgVBRef = useRef({ w: 500, h: 500 });

  const OVERLAY_SIZE = 1000;
  const trackInfo = session ? resolveTrack(session.circuit) : null;

  // ── Load SVG ──
  useEffect(() => {
    if (!trackInfo) return;
    fetch(`/tracks/${trackInfo.svg}`)
      .then((r) => r.text())
      .then(setSvgContent)
      .catch(() => {});
  }, [trackInfo]);

  // ── Extract main path + pre-sample ──
  useEffect(() => {
    if (!svgContent || !svgWrapperRef.current) return;
    const timeout = setTimeout(() => {
      const svgEl = svgWrapperRef.current?.querySelector("svg");
      if (!svgEl) return;

      // Read actual SVG viewBox
      const vb = svgEl.getAttribute("viewBox");
      if (vb) {
        const parts = vb.split(/[\s,]+/).map(Number);
        if (parts.length >= 4) {
          svgVBRef.current = { w: parts[2], h: parts[3] };
        }
      } else {
        const w = parseFloat(svgEl.getAttribute("width") || "500");
        const h = parseFloat(svgEl.getAttribute("height") || "500");
        svgVBRef.current = { w, h };
      }

      // Find longest path = track outline
      const paths = svgEl.querySelectorAll("path");
      let longest: SVGPathElement | null = null;
      let maxLen = 0;
      paths.forEach((p) => {
        try {
          const len = p.getTotalLength();
          if (len > maxLen) {
            maxLen = len;
            longest = p;
          }
        } catch {}
      });
      if (longest) {
        trackPathRef.current = longest;
        samplesRef.current = samplePath(longest, 600);
      }
    }, 60);
    return () => clearTimeout(timeout);
  }, [svgContent]);

  // ── GSAP draw-on animation ──
  useEffect(() => {
    if (!svgContent || !svgWrapperRef.current) return;
    const timeout = setTimeout(() => {
      const svgEl = svgWrapperRef.current?.querySelector("svg");
      if (!svgEl) return;
      svgEl.querySelectorAll("path").forEach((p) => {
        try {
          const len = p.getTotalLength();
          gsap.fromTo(
            p,
            { strokeDasharray: len, strokeDashoffset: len },
            { strokeDashoffset: 0, duration: 1.8, ease: "power2.inOut" }
          );
        } catch {}
      });
    }, 60);
    return () => clearTimeout(timeout);
  }, [svgContent]);

  // ── Fetch positions on lap change ──
  useEffect(() => {
    if (!session || currentLap < 1) return;
    api.getDriverPositions(currentLap).then(setDriverPositions).catch(() => {});
  }, [session, currentLap]);

  // ── Auto-refresh while playing ──
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      if (currentLap > 0) {
        api
          .getDriverPositions(currentLap)
          .then(setDriverPositions)
          .catch(() => {});
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [isPlaying, currentLap]);

  // ── Project positions onto track path → car states ──
  useEffect(() => {
    const path = trackPathRef.current;
    if (!path || driverPositions.length === 0) return;

    const svgVB = svgVBRef.current;

    const states: CarState[] = driverPositions.map((dp) => {
      // Find progress along path
      const prog = nearestProgress(
        samplesRef.current,
        dp.x,
        dp.y,
        svgVB,
        OVERLAY_SIZE
      );
      // Get smooth point on path
      const { x, y } = progressToXY(path, prog, svgVB, OVERLAY_SIZE);
      // Find previous state for continuity
      const prev = carStates.find((c) => c.driver === dp.driver);
      return {
        driver: dp.driver,
        fullName: dp.full_name,
        team: dp.team,
        teamColor: `#${dp.team_color}`,
        position: dp.position,
        lapTime: dp.lap_time,
        progress: prog,
        x: prev?.targetX ?? x,
        y: prev?.targetY ?? y,
        targetX: x,
        targetY: y,
      };
    });

    setCarStates(states);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverPositions]);

  // Leaderboard data for gap/tyre info
  const lbMap = useMemo(() => {
    const m = new Map<string, { gap: number | null; compound: string | null }>();
    leaderboard.forEach((e) =>
      m.set(e.driver, { gap: e.gap_to_leader, compound: e.compound })
    );
    return m;
  }, [leaderboard]);

  // Battle detection (cars close on track progress)
  const battles = useMemo(() => {
    const set = new Set<string>();
    const sorted = [...carStates].sort((a, b) => a.progress - b.progress);
    for (let i = 0; i < sorted.length - 1; i++) {
      const diff = Math.abs(sorted[i + 1].progress - sorted[i].progress);
      // ~2% of track ≈ battle proximity
      if (diff < 0.025 || diff > 0.975) {
        set.add(sorted[i].driver);
        set.add(sorted[i + 1].driver);
      }
    }
    return set;
  }, [carStates]);

  const onHover = useCallback((d: string | null) => setHoveredDriver(d), []);
  const onClickCar = useCallback(
    (d: string) => setFocusedDriver(focusedDriver === d ? null : d),
    [focusedDriver, setFocusedDriver]
  );

  if (!session) {
    return (
      <div className="h-full flex items-center justify-center bg-f1-bg">
        <div className="text-center space-y-3">
          <div className="text-6xl">🏁</div>
          <p className="text-sm font-body text-f1-text-dim">
            Load a session to view the track
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative overflow-hidden bg-f1-bg">
      {/* Top-right: Track name badge */}
      <div className="absolute top-4 right-4 z-10 glass-panel rounded-lg px-4 py-2 pointer-events-none">
        <h2 className="text-xs font-display font-bold uppercase tracking-[0.25em] text-f1-text-dim">
          {trackInfo?.name || session.circuit}
        </h2>
        {trackInfo && (
          <p className="text-[10px] font-mono text-f1-text-muted mt-0.5">
            {trackInfo.length}km · {trackInfo.laps} laps ·{" "}
            {trackInfo.country}
          </p>
        )}
      </div>

      {/* Top-left: Lap badge */}
      <div className="absolute top-4 left-4 z-10 glass-panel rounded-lg px-4 py-2 flex items-center gap-3">
        <span className="text-xs font-display font-bold uppercase tracking-wider text-f1-text-dim">
          LAP
        </span>
        <span className="text-lg font-mono font-bold text-white">
          {currentLap}
        </span>
        <span className="text-xs font-mono text-f1-text-muted">
          / {session.total_laps || "—"}
        </span>

      </div>

      {/* Battle count badge */}
      {layers.battles && battles.size > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-1.5 rounded-full glass-panel animate-pulse border border-f1-red/30">
          <span className="text-xs font-display font-bold uppercase tracking-wider text-f1-red">
            ⚔ {Math.floor(battles.size / 2)} BATTLE
            {battles.size > 2 ? "S" : ""}
          </span>
        </div>
      )}

      {/* Racing line layer */}
      {layers.racingLine && svgContent && (
        <RacingLineOverlay svgContent={svgContent} />
      )}

      {/* Track SVG — base layer, fills entire space */}
      <div className="absolute inset-0 flex items-center justify-center p-8">
        {svgContent ? (
          <div
            ref={svgWrapperRef}
            className="w-full h-full flex items-center justify-center [&_svg]:max-h-full [&_svg]:max-w-full [&_svg]:w-auto [&_svg]:h-auto [&_path]:stroke-white/15 [&_path]:fill-none [&_path]:stroke-[3]"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        ) : (
          <div className="w-12 h-12 rounded-full border-2 border-t-transparent border-f1-purple animate-spin" />
        )}
      </div>

      {/* Car overlay — mapped via 1000x1000 viewBox */}
      {layers.cars && carStates.length > 0 && (
        <svg
          viewBox={`0 0 ${OVERLAY_SIZE} ${OVERLAY_SIZE}`}
          className="absolute inset-0 w-full h-full pointer-events-none"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <filter
              id="car-glow"
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter
              id="car-glow-strong"
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Sector lines */}
          {layers.sectors && trackPathRef.current && (
            <SectorLines
              path={trackPathRef.current}
              svgVB={svgVBRef.current}
              overlaySize={OVERLAY_SIZE}
            />
          )}

          {/* Cars */}
          {carStates.map((car) => {
            const lb = lbMap.get(car.driver);
            return (
              <CarDot
                key={car.driver}
                car={car}
                isBattle={battles.has(car.driver)}
                isHovered={hoveredDriver === car.driver}
                isFocused={focusedDriver === car.driver}
                onHover={onHover}
                onClick={onClickCar}
                showLabel={layers.labels}
                showGap={layers.gaps}
                showTyre={layers.tyres}
                compound={lb?.compound}
                gapToLeader={lb?.gap}
              />
            );
          })}
        </svg>
      )}

      {/* Bottom driver bar */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center gap-2 px-4 py-2 bg-gradient-to-t from-f1-bg/95 to-transparent">
        {carStates
          .sort((a, b) => a.position - b.position)
          .slice(0, 15)
          .map((car) => (
            <div
              key={car.driver}
              className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer transition-all ${
                hoveredDriver === car.driver || focusedDriver === car.driver
                  ? "bg-white/10 scale-105"
                  : "hover:bg-white/5"
              }`}
              onMouseEnter={() => onHover(car.driver)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onClickCar(car.driver)}
            >
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: car.teamColor }}
              />
              <span className="text-[10px] font-mono font-bold text-f1-text-dim">
                {car.driver}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
});
