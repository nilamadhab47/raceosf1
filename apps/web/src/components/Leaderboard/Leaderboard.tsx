"use client";

import { useEffect, useRef, useLayoutEffect, useCallback, memo } from "react";
import { useF1Store } from "@/store/f1-store";
import { useTimeline } from "@/engines/Timeline";
import { formatLapTime, formatGap, getCompoundClass } from "@/lib/utils";
import gsap from "gsap";

const ROW_HEIGHT = 48; // approximate height of each driver row in px

const LeaderboardInner = () => {
  const { leaderboard, fetchLeaderboard, session } = useF1Store();
  const setFocusedDriver = useF1Store((s) => s.setFocusedDriver);
  const { currentLap, isPlaying } = useTimeline();
  const prevPositions = useRef<Record<string, number>>({});
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const setRowRef = useCallback(
    (driver: string) => (el: HTMLDivElement | null) => {
      rowRefs.current[driver] = el;
    },
    []
  );

  useEffect(() => {
    if (session) fetchLeaderboard();
  }, [session, fetchLeaderboard]);

  // Subscribe to timeline lap changes (simulation playback)
  useEffect(() => {
    if (!session || currentLap < 1) return;
    fetchLeaderboard(currentLap);
  }, [session, currentLap, fetchLeaderboard]);

  const getPositionDelta = (driver: string, currentPos: number): number => {
    const prev = prevPositions.current[driver];
    if (prev == null) return 0;
    return prev - currentPos;
  };

  // Animate position changes after render
  useLayoutEffect(() => {
    if (leaderboard.length === 0) return;

    leaderboard.forEach((entry, idx) => {
      const prevIdx = prevPositions.current[entry.driver];
      if (prevIdx == null) return;

      const currentIdx = idx;
      const prevPosition = prevIdx - 1; // convert from 1-based position to 0-based index
      const delta = prevPosition - currentIdx;

      if (delta !== 0) {
        const el = rowRefs.current[entry.driver];
        if (!el) return;

        // Start from old position offset, animate to 0
        gsap.fromTo(
          el,
          { y: delta * ROW_HEIGHT },
          { y: 0, duration: 0.5, ease: "power2.out" }
        );
      }
    });

    // Update prev positions after animation
    const map: Record<string, number> = {};
    leaderboard.forEach((e, i) => {
      map[e.driver] = i + 1; // store as 1-based
    });
    prevPositions.current = map;
  }, [leaderboard]);

  if (leaderboard.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 py-3 border-b border-f1-border-solid">
          <h2 className="text-[13px] font-display font-bold uppercase tracking-[0.2em] text-f1-text-dim">
            Race Standings
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="space-y-2 w-full px-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="skeleton h-10 rounded-lg" style={{ animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const fastestLapTime = leaderboard
    .filter(e => e.last_lap_time != null)
    .reduce((min, e) => (e.last_lap_time! < min ? e.last_lap_time! : min), Infinity);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-f1-red/[0.08]">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-display font-bold uppercase tracking-[0.2em] text-f1-text-dim">
            Race Standings
          </h2>
          <span className="text-[11px] font-mono text-f1-text-muted">
            {leaderboard.length} drivers
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {leaderboard.map((entry, idx) => {
          const delta = getPositionDelta(entry.driver, entry.position);
          const isFastestLap = entry.last_lap_time === fastestLapTime && fastestLapTime < Infinity;
          const isLeader = idx === 0;

          return (
            <div key={entry.driver} ref={setRowRef(entry.driver)} className="group relative">
              <div
                className="flex items-center gap-2 px-3 py-2 mx-1 my-0.5 rounded-lg transition-all duration-200 hover:bg-white/[0.03] cursor-pointer"
                onClick={() => setFocusedDriver(entry.driver)}
                style={{
                  borderLeft: isFastestLap ? "2px solid var(--f1-accent-purple)" : "2px solid transparent",
                  background: isLeader ? "rgba(225, 6, 0, 0.1)" : undefined,
                  boxShadow: isLeader ? "inset 0 0 40px rgba(225, 6, 0, 0.08), 0 0 15px rgba(225, 6, 0, 0.05)" : undefined,
                }}
              >
                {/* Position */}
                <div className="w-9 flex flex-col items-center">
                  <span className={`font-display font-black tabular-nums ${
                    idx === 0 ? "text-xl text-f1-red drop-shadow-[0_0_8px_rgba(225,6,0,0.6)]" :
                    idx === 1 ? "text-lg text-f1-cyan drop-shadow-[0_0_6px_rgba(0,210,190,0.4)]" :
                    idx === 2 ? "text-lg text-f1-gold drop-shadow-[0_0_6px_rgba(255,215,0,0.4)]" : "text-base text-f1-text"
                  }`}>
                    {entry.position || idx + 1}
                  </span>
                  {delta !== 0 && (
                    <span className={`text-[10px] font-bold ${delta > 0 ? "text-f1-green" : "text-f1-red"}`}>
                      {delta > 0 ? `▲${delta}` : `▼${Math.abs(delta)}`}
                    </span>
                  )}
                </div>

                {/* Team color bar */}
                <div
                  className="w-1 h-9 rounded-full shrink-0 transition-shadow duration-300"
                  style={{
                    background: entry.team_color,
                    boxShadow: isFastestLap ? `0 0 8px ${entry.team_color}` : undefined,
                  }}
                />

                {/* Driver info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-body font-extrabold tracking-wide text-f1-text">{entry.driver}</span>
                    <span className="text-[13px] truncate text-f1-text-dim">{entry.team}</span>
                    {isFastestLap && (
                      <span className="text-[13px] px-1 py-0.5 rounded font-bold bg-f1-purple/20 text-f1-purple">
                        FL
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[13px] font-mono ${isFastestLap ? "text-f1-purple" : "text-f1-text-dim"}`}>
                      {formatLapTime(entry.last_lap_time ?? 0)}
                    </span>
                  </div>
                </div>

                {/* Tyre badge */}
                {entry.compound && (
                  <div className="flex items-center gap-1">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[13px] font-black ${getCompoundClass(entry.compound)}`}>
                      {entry.compound?.[0]}
                    </div>
                    <span className="text-[13px] font-mono tabular-nums text-f1-text-dim">
                      {entry.tyre_life}
                    </span>
                  </div>
                )}

                {/* Gap */}
                <div className="w-[72px] text-right">
                  <span className={`text-[13px] font-mono font-bold tabular-nums ${isLeader ? "text-f1-red" : "text-f1-text-dim"}`}>
                    {isLeader ? (
                      <span className="text-[10px] font-display font-black tracking-widest text-f1-red">LEADER</span>
                    ) : formatGap(entry.gap_to_leader)}
                  </span>
                </div>
              </div>

              {idx < leaderboard.length - 1 && (
                <div className="mx-4 h-px bg-f1-border-solid opacity-30" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const Leaderboard = memo(LeaderboardInner);
