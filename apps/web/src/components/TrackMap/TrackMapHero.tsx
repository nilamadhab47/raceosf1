"use client";

import { useEffect, useRef, useState, memo, useCallback } from "react";
import gsap from "gsap";
import { useF1Store } from "@/store/f1-store";
import { resolveTrack } from "@/lib/trackMapping";
import { api } from "@/lib/api";

/* ───── CarDot ──────────────────────────────────────────────────────── */

interface CarDotProps {
  driver: string;
  teamColor: string;
  position: number;
  isBattle: boolean;
  isHovered: boolean;
  onHover: (driver: string | null) => void;
  fullName: string;
  team: string;
  lapTime: number | null;
  x: number;
  y: number;
}

const CarDot = memo(function CarDot({
  driver, teamColor, position, isBattle, isHovered, onHover,
  fullName, team, lapTime, x, y,
}: CarDotProps) {
  const gRef = useRef<SVGGElement>(null);

  // GSAP smooth position transition
  useEffect(() => {
    if (!gRef.current) return;
    gsap.to(gRef.current, {
      attr: { transform: `translate(${x}, ${y})` },
      duration: 0.8,
      ease: "power2.out",
      overwrite: true,
    });
  }, [x, y]);

  const r = isHovered ? 8 : 6;

  return (
    <g
      ref={gRef}
      transform={`translate(${x}, ${y})`}
      style={{ pointerEvents: "all", cursor: "pointer" }}
      onMouseEnter={() => onHover(driver)}
      onMouseLeave={() => onHover(null)}
    >
      {/* Battle glow ring */}
      {isBattle && (
        <circle r={14} fill="none" stroke={teamColor} strokeWidth={2} opacity={0.4} className="animate-pulse" />
      )}

      {/* Trail glow */}
      <circle r={isHovered ? 18 : 12} fill={teamColor} opacity={isHovered ? 0.2 : 0.08} filter="url(#car-glow)" />

      {/* Car dot */}
      <circle
        r={r}
        fill={teamColor}
        stroke="#fff"
        strokeWidth={isHovered ? 2 : 1}
        filter={isBattle ? "url(#car-glow-strong)" : "url(#car-glow)"}
        style={{ transition: "r 0.2s ease" }}
      />

      {/* Position number */}
      <text y={3} textAnchor="middle" fontSize="7" fill="#000" fontWeight="900" fontFamily="var(--font-orbitron)">
        {position}
      </text>

      {/* Driver code */}
      <text
        y={-13}
        textAnchor="middle"
        fontSize={isHovered ? "10" : "8"}
        fill="#fff"
        fontWeight="700"
        fontFamily="var(--font-jetbrains)"
        style={{ textShadow: `0 0 8px ${teamColor}` }}
      >
        {driver}
      </text>

      {/* Hover tooltip */}
      {isHovered && (
        <g>
          <rect x={14} y={-28} width="100" height="46" rx="6" fill="#12121a" stroke={teamColor} strokeWidth="1" opacity="0.95" />
          <text x={20} y={-13} fontSize="9" fill="#fff" fontWeight="700" fontFamily="var(--font-jetbrains)">
            P{position} {fullName}
          </text>
          <text x={20} y={0} fontSize="8" fill="#6b6b88" fontFamily="var(--font-exo2)">
            {team}
          </text>
          <text x={20} y={12} fontSize="8" fill="#00ff88" fontFamily="var(--font-jetbrains)">
            {lapTime ? `${lapTime.toFixed(3)}s` : "—"}
          </text>
        </g>
      )}
    </g>
  );
});

/* ───── Helpers ─────────────────────────────────────────────────────── */

/**
 * Given an SVGPathElement and raw x/y coordinates (from the API overlay space),
 * find the closest progress (0-1) along the path using binary search.
 */
function xyToProgress(
  path: SVGPathElement,
  rawX: number,
  rawY: number,
  scaleX: number,
  scaleY: number,
  offsetX: number,
  offsetY: number,
): number {
  const px = (rawX - offsetX) / scaleX;
  const py = (rawY - offsetY) / scaleY;
  const total = path.getTotalLength();
  const samples = 200;
  let bestDist = Infinity;
  let bestT = 0;

  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * total;
    const pt = path.getPointAtLength(t);
    const d = (pt.x - px) ** 2 + (pt.y - py) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestT = t;
    }
  }
  return bestT / total;
}

/**
 * Compute point on SVG path from progress 0-1, then scale to overlay space.
 */
function progressToOverlay(
  path: SVGPathElement,
  progress: number,
  scaleX: number,
  scaleY: number,
  offsetX: number,
  offsetY: number,
): { x: number; y: number } {
  const total = path.getTotalLength();
  const pt = path.getPointAtLength(progress * total);
  return {
    x: pt.x * scaleX + offsetX,
    y: pt.y * scaleY + offsetY,
  };
}

/* ───── TrackMapHero ───────────────────────────────────────────────── */

const TrackMapHeroInner = () => {
  const { session, liveState } = useF1Store();
  const [svgContent, setSvgContent] = useState<string>("");
  const [hoveredDriver, setHoveredDriver] = useState<string | null>(null);
  const [driverPositions, setDriverPositions] = useState<any[]>([]);
  const [currentLap, setCurrentLap] = useState(10);
  const trackPathRef = useRef<SVGPathElement | null>(null);
  const svgWrapperRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);

  // Resolve track SVG
  const trackInfo = session ? resolveTrack(session.circuit) : null;

  // Load SVG content
  useEffect(() => {
    if (!trackInfo) return;
    fetch(`/tracks/${trackInfo.svg}`)
      .then((r) => r.text())
      .then((svg) => setSvgContent(svg))
      .catch(() => {});
  }, [trackInfo]);

  // Extract the main <path> from the rendered SVG for MotionPath
  useEffect(() => {
    if (!svgContent || !svgWrapperRef.current) return;
    // Wait for DOM update
    const timeout = setTimeout(() => {
      const svgEl = svgWrapperRef.current?.querySelector("svg");
      if (!svgEl) return;
      // Find the longest path (the track outline)
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
      trackPathRef.current = longest;
    }, 100);
    return () => clearTimeout(timeout);
  }, [svgContent]);

  // GSAP draw-on animation for the track path
  useEffect(() => {
    if (!svgContent || !svgWrapperRef.current) return;
    const timeout = setTimeout(() => {
      const svgEl = svgWrapperRef.current?.querySelector("svg");
      if (!svgEl) return;
      const paths = svgEl.querySelectorAll("path");
      paths.forEach((p) => {
        try {
          const len = p.getTotalLength();
          gsap.fromTo(
            p,
            { strokeDasharray: len, strokeDashoffset: len },
            { strokeDashoffset: 0, duration: 1.5, ease: "power2.inOut" }
          );
        } catch {}
      });
    }, 100);
    return () => clearTimeout(timeout);
  }, [svgContent]);

  // Update lap from simulation
  useEffect(() => {
    if (liveState?.is_running && liveState.current_lap > 0) {
      setCurrentLap(liveState.current_lap);
    }
  }, [liveState]);

  // Fetch driver positions
  useEffect(() => {
    if (!session || currentLap < 1) return;
    api.getDriverPositions(currentLap).then(setDriverPositions).catch(() => {});
  }, [session, currentLap]);

  // Auto-refresh during simulation
  useEffect(() => {
    if (!liveState?.is_running) return;
    const interval = setInterval(() => {
      if (liveState.current_lap > 0) {
        api.getDriverPositions(liveState.current_lap).then(setDriverPositions).catch(() => {});
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [liveState]);

  // Battle detection
  const battles = new Set<string>();
  for (let i = 0; i < driverPositions.length - 1; i++) {
    const a = driverPositions[i];
    const b = driverPositions[i + 1];
    if (a && b) {
      const dist = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
      if (dist < 40) {
        battles.add(a.driver);
        battles.add(b.driver);
      }
    }
  }

  const onHover = useCallback((driver: string | null) => setHoveredDriver(driver), []);

  if (!session) {
    return (
      <div className="h-full flex items-center justify-center bg-f1-bg">
        <div className="text-center space-y-3">
          <div className="text-5xl">🏁</div>
          <p className="text-sm font-body text-f1-text-dim">Load a session to view track map</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative overflow-hidden bg-f1-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-f1-border-solid">
        <div className="flex items-center gap-3">
          <h2 className="text-[13px] font-display font-bold uppercase tracking-[0.2em] text-f1-text-dim">
            {trackInfo?.name || session.circuit}
          </h2>
          {trackInfo && (
            <span className="text-[13px] font-mono text-f1-text-muted">
              {trackInfo.length}km · {trackInfo.laps} laps
            </span>
          )}
          {battles.size > 0 && (
            <span className="text-[13px] px-2 py-0.5 rounded-full font-bold animate-pulse bg-f1-red/10 text-f1-red">
              {Math.floor(battles.size / 2)} BATTLE{battles.size > 2 ? "S" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-mono font-bold text-f1-text-dim">
            LAP {currentLap}
          </span>
          {!liveState?.is_running && (
            <input
              type="range"
              min={1}
              max={session.total_laps || 57}
              value={currentLap}
              onChange={(e) => setCurrentLap(parseInt(e.target.value))}
              className="w-24 h-1 appearance-none rounded-full cursor-pointer bg-f1-surface-2"
            />
          )}
        </div>
      </div>

      {/* Track SVG */}
      <div className="flex-1 relative p-4">
        {svgContent ? (
          <div
            ref={svgWrapperRef}
            className="w-full h-full flex items-center justify-center [&_svg]:max-h-full [&_svg]:max-w-full [&_svg]:w-auto [&_svg]:h-auto [&_path]:stroke-white/20 [&_path]:fill-none"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-f1-purple animate-spin" />
          </div>
        )}

        {/* Car dot overlay — mapped to overlay viewBox via raw x/y with GSAP transitions */}
        {driverPositions.length > 0 && (
          <svg
            ref={overlayRef}
            viewBox="0 0 1000 1000"
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <filter id="car-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="car-glow-strong" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {driverPositions.map((dp) => (
              <CarDot
                key={dp.driver}
                driver={dp.driver}
                teamColor={dp.team_color}
                position={dp.position}
                isBattle={battles.has(dp.driver)}
                isHovered={hoveredDriver === dp.driver}
                onHover={onHover}
                fullName={dp.full_name}
                team={dp.team}
                lapTime={dp.lap_time}
                x={dp.x}
                y={dp.y}
              />
            ))}
          </svg>
        )}
      </div>

      {/* Mini driver legend */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-t border-f1-border-solid overflow-x-auto">
        {driverPositions.slice(0, 12).map((dp) => (
          <div
            key={dp.driver}
            className="flex items-center gap-1 shrink-0 cursor-pointer"
            onMouseEnter={() => onHover(dp.driver)}
            onMouseLeave={() => onHover(null)}
          >
            <div className="w-2 h-2 rounded-full" style={{ background: dp.team_color }} />
            <span className={`text-[13px] font-mono font-bold ${hoveredDriver === dp.driver ? "text-white" : "text-f1-text-dim"}`}>
              {dp.driver}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const TrackMapHero = memo(TrackMapHeroInner);
