"use client";

import { useEffect, useRef, memo } from "react";
import { useF1Store } from "@/store/f1-store";
import { formatLapTime, formatGap, getCompoundClass } from "@/lib/utils";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";

const LeaderboardInner = () => {
  const { leaderboard, fetchLeaderboard, liveState, session } = useF1Store();
  const prevPositions = useRef<Record<string, number>>({});

  useEffect(() => {
    if (session) fetchLeaderboard();
  }, [session, fetchLeaderboard]);

  useEffect(() => {
    if (!liveState?.is_running) return;
    const interval = setInterval(() => {
      fetchLeaderboard(liveState.current_lap);
    }, 3000);
    return () => clearInterval(interval);
  }, [liveState, fetchLeaderboard]);

  // Track position changes
  const getPositionDelta = (driver: string, currentPos: number): number => {
    const prev = prevPositions.current[driver];
    if (prev == null) return 0;
    return prev - currentPos;
  };

  useEffect(() => {
    const map: Record<string, number> = {};
    leaderboard.forEach((e) => { map[e.driver] = e.position; });
    prevPositions.current = map;
  }, [leaderboard]);

  if (leaderboard.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--f1-border)" }}>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--f1-text-dim)" }}>
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
      <div className="px-4 py-3 border-b" style={{ borderColor: "var(--f1-border)" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--f1-text-dim)" }}>
            Race Standings
          </h2>
          <span className="text-[9px] font-mono" style={{ color: "var(--f1-text-dim)" }}>
            {leaderboard.length} drivers
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <LayoutGroup>
          <AnimatePresence mode="popLayout">
            {leaderboard.map((entry, idx) => {
              const delta = getPositionDelta(entry.driver, entry.position);
              const isFastestLap = entry.last_lap_time === fastestLapTime && fastestLapTime < Infinity;
              const isLeader = idx === 0;

              return (
                <motion.div
                  key={entry.driver}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.8 }}
                  className="group relative"
                >
                  <div
                    className="flex items-center gap-2 px-3 py-2 mx-1 my-0.5 rounded-lg transition-all duration-200 hover:bg-white/[0.03]"
                    style={{
                      borderLeft: isFastestLap ? "2px solid var(--f1-accent-purple)" : "2px solid transparent",
                      background: isLeader ? "linear-gradient(90deg, rgba(0, 255, 136, 0.04), transparent)" : undefined,
                    }}
                  >
                    {/* Position */}
                    <div className="w-7 flex flex-col items-center">
                      <span className="text-sm font-black tabular-nums" style={{
                        color: idx === 0 ? "var(--f1-accent-green)"
                          : idx === 1 ? "var(--f1-accent-cyan)"
                          : idx === 2 ? "var(--f1-accent-yellow)"
                          : "var(--f1-text)",
                      }}>
                        {entry.position || idx + 1}
                      </span>
                      {delta !== 0 && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="text-[8px] font-bold"
                          style={{ color: delta > 0 ? "var(--f1-accent-green)" : "var(--f1-accent-red)" }}
                        >
                          {delta > 0 ? `▲${delta}` : `▼${Math.abs(delta)}`}
                        </motion.span>
                      )}
                    </div>

                    {/* Team color bar */}
                    <div className="w-1 h-9 rounded-full shrink-0 transition-shadow duration-300"
                      style={{
                        background: entry.team_color,
                        boxShadow: isFastestLap ? `0 0 8px ${entry.team_color}` : undefined,
                      }}
                    />

                    {/* Driver info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-extrabold tracking-wide">{entry.driver}</span>
                        <span className="text-[10px] truncate" style={{ color: "var(--f1-text-dim)" }}>
                          {entry.team}
                        </span>
                        {isFastestLap && (
                          <span className="text-[8px] px-1 py-0.5 rounded font-bold"
                            style={{ background: "rgba(168, 85, 247, 0.2)", color: "var(--f1-accent-purple)" }}>
                            FL
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono" style={{
                          color: isFastestLap ? "var(--f1-accent-purple)" : "var(--f1-text-dim)",
                        }}>
                          {formatLapTime(entry.last_lap_time ?? 0)}
                        </span>
                      </div>
                    </div>

                    {/* Tyre badge */}
                    {entry.compound && (
                      <div className="flex items-center gap-1">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black ${getCompoundClass(entry.compound)}`}>
                          {entry.compound?.[0]}
                        </div>
                        <span className="text-[9px] font-mono tabular-nums" style={{ color: "var(--f1-text-dim)" }}>
                          {entry.tyre_life}
                        </span>
                      </div>
                    )}

                    {/* Gap */}
                    <div className="w-[72px] text-right">
                      <span className="text-[11px] font-mono tabular-nums" style={{
                        color: isLeader ? "var(--f1-accent-green)" : "var(--f1-text-dim)",
                      }}>
                        {formatGap(entry.gap_to_leader)}
                      </span>
                    </div>
                  </div>

                  {idx < leaderboard.length - 1 && (
                    <div className="mx-4 h-px" style={{ background: "var(--f1-border)", opacity: 0.3 }} />
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </LayoutGroup>
      </div>
    </div>
  );
};

export const Leaderboard = memo(LeaderboardInner);
