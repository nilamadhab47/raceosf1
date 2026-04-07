"use client";

import { useEffect, useState, useMemo, useCallback, memo } from "react";
import { useF1Store } from "@/store/f1-store";
import { api } from "@/lib/api";
import type { TrackMapData, DriverPosition } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";

const TrackMapInner = () => {
  const { session, liveState } = useF1Store();
  const [trackData, setTrackData] = useState<TrackMapData | null>(null);
  const [driverPositions, setDriverPositions] = useState<DriverPosition[]>([]);
  const [hoveredDriver, setHoveredDriver] = useState<string | null>(null);
  const [currentLap, setCurrentLap] = useState(10);

  // Load track outline
  useEffect(() => {
    if (!session) return;
    api.getTrackMap().then(setTrackData).catch(() => {});
  }, [session]);

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
    }, 3000);
    return () => clearInterval(interval);
  }, [liveState]);

  // Build SVG path from track coordinates
  const trackPath = useMemo(() => {
    if (!trackData || trackData.x.length === 0) return "";
    const points = trackData.x.map((x, i) => `${x},${trackData.y[i]}`);
    return `M ${points.join(" L ")} Z`;
  }, [trackData]);

  // Detect battles (cars within ~2 positions of each other with close gaps)
  const battles = useMemo(() => {
    const battleSet = new Set<string>();
    for (let i = 0; i < driverPositions.length - 1; i++) {
      const a = driverPositions[i];
      const b = driverPositions[i + 1];
      const dist = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
      if (dist < 40) {
        battleSet.add(a.driver);
        battleSet.add(b.driver);
      }
    }
    return battleSet;
  }, [driverPositions]);

  if (!session) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-2">🏁</p>
          <p className="text-xs" style={{ color: "var(--f1-text-dim)" }}>Load a session to view track map</p>
        </div>
      </div>
    );
  }

  if (!trackData) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--f1-accent-purple)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: "var(--f1-border)" }}>
        <div className="flex items-center gap-2">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--f1-text-dim)" }}>
            Circuit Map
          </h2>
          {battles.size > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium animate-pulse"
              style={{ background: "rgba(255, 45, 85, 0.15)", color: "var(--f1-accent-red)" }}>
              {Math.floor(battles.size / 2)} BATTLE{battles.size > 2 ? "S" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono" style={{ color: "var(--f1-text-dim)" }}>
            LAP {currentLap}
          </span>
          {!liveState?.is_running && (
            <input
              type="range"
              min={1}
              max={session.total_laps || 57}
              value={currentLap}
              onChange={(e) => setCurrentLap(parseInt(e.target.value))}
              className="w-20 h-1 appearance-none rounded-full cursor-pointer"
              style={{ background: "var(--f1-surface-2)" }}
            />
          )}
        </div>
      </div>

      {/* SVG Track Map */}
      <div className="flex-1 relative p-2">
        <svg viewBox="0 0 1000 1000" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          <defs>
            {/* Glow filter */}
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-strong" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Gradient for track */}
            <linearGradient id="track-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#00d4ff" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.3" />
            </linearGradient>
          </defs>

          {/* Track glow layer */}
          <path d={trackPath} className="track-outline-glow" />

          {/* Track outline */}
          <path
            d={trackPath}
            fill="none"
            stroke="url(#track-gradient)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Track surface */}
          <path
            d={trackPath}
            fill="none"
            stroke="var(--f1-border)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Corner numbers */}
          {trackData.corners.map((c) => (
            <g key={c.number}>
              <circle cx={c.x} cy={c.y} r="10" fill="var(--f1-surface)" stroke="var(--f1-border)" strokeWidth="1" />
              <text
                x={c.x}
                y={c.y + 3.5}
                textAnchor="middle"
                fontSize="8"
                fill="var(--f1-text-dim)"
                fontWeight="600"
              >
                {c.number}
              </text>
            </g>
          ))}

          {/* Driver dots */}
          {driverPositions.map((dp) => {
            const isBattle = battles.has(dp.driver);
            const isHovered = hoveredDriver === dp.driver;
            return (
              <g
                key={dp.driver}
                onMouseEnter={() => setHoveredDriver(dp.driver)}
                onMouseLeave={() => setHoveredDriver(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Glow ring for battles */}
                {isBattle && (
                  <circle
                    cx={dp.x}
                    cy={dp.y}
                    r="14"
                    fill="none"
                    stroke={dp.team_color}
                    strokeWidth="2"
                    opacity="0.4"
                    className="animate-pulse"
                  />
                )}

                {/* Trail glow */}
                <circle
                  cx={dp.x}
                  cy={dp.y}
                  r={isHovered ? 16 : 10}
                  fill={dp.team_color}
                  opacity={isHovered ? 0.2 : 0.1}
                  filter="url(#glow)"
                />

                {/* Driver dot */}
                <circle
                  cx={dp.x}
                  cy={dp.y}
                  r={isHovered ? 8 : 6}
                  fill={dp.team_color}
                  stroke="#fff"
                  strokeWidth={isHovered ? 2 : 1}
                  filter={isBattle ? "url(#glow-strong)" : "url(#glow)"}
                  className="driver-dot"
                  style={{ "--dot-color": dp.team_color } as React.CSSProperties}
                />

                {/* Driver label */}
                <text
                  x={dp.x}
                  y={dp.y - 12}
                  textAnchor="middle"
                  fontSize={isHovered ? "10" : "8"}
                  fill="#fff"
                  fontWeight="700"
                  style={{ textShadow: `0 0 8px ${dp.team_color}` }}
                >
                  {dp.driver}
                </text>

                {/* Hover tooltip */}
                {isHovered && (
                  <g>
                    <rect
                      x={dp.x + 12}
                      y={dp.y - 24}
                      width="90"
                      height="40"
                      rx="4"
                      fill="var(--f1-surface)"
                      stroke={dp.team_color}
                      strokeWidth="1"
                      opacity="0.95"
                    />
                    <text x={dp.x + 16} y={dp.y - 10} fontSize="9" fill="#fff" fontWeight="600">
                      P{dp.position} {dp.full_name}
                    </text>
                    <text x={dp.x + 16} y={dp.y + 2} fontSize="8" fill="var(--f1-text-dim)">
                      {dp.team}
                    </text>
                    <text x={dp.x + 16} y={dp.y + 12} fontSize="8" fill="var(--f1-accent-green)">
                      {dp.lap_time ? `${dp.lap_time.toFixed(3)}s` : "—"}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Mini legend */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-t overflow-x-auto" style={{ borderColor: "var(--f1-border)" }}>
        {driverPositions.slice(0, 10).map((dp) => (
          <div
            key={dp.driver}
            className="flex items-center gap-1 shrink-0 cursor-pointer"
            onMouseEnter={() => setHoveredDriver(dp.driver)}
            onMouseLeave={() => setHoveredDriver(null)}
          >
            <div className="w-2 h-2 rounded-full" style={{ background: dp.team_color }} />
            <span className="text-[9px] font-bold" style={{
              color: hoveredDriver === dp.driver ? "#fff" : "var(--f1-text-dim)",
            }}>
              {dp.driver}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const TrackMap = memo(TrackMapInner);
