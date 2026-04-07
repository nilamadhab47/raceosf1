"use client";

import { useEffect, useRef, memo, useState } from "react";
import { useF1Store } from "@/store/f1-store";
import { useTimeline } from "@/engines/Timeline";
import type { FlagMode, LeaderboardEntry } from "@/lib/types";

/* ── Types ────────────────────────────────────────────────────────── */

interface RaceUpdate {
  id: string;
  type: "battle" | "fastest" | "pit" | "overtake" | "flag" | "tyre" | "info";
  message: string;
  lap: number;
  timestamp: number;
}

const UPDATE_CONFIG: Record<
  RaceUpdate["type"],
  { icon: string; color: string; border: string }
> = {
  battle:   { icon: "⚔️",  color: "text-f1-red",   border: "border-f1-red/20" },
  fastest:  { icon: "⏱️",  color: "text-f1-purple", border: "border-f1-purple/20" },
  pit:      { icon: "🔧",  color: "text-f1-cyan",   border: "border-f1-cyan/20" },
  overtake: { icon: "🔄",  color: "text-f1-green",  border: "border-f1-green/20" },
  flag:     { icon: "🏁",  color: "text-f1-amber",  border: "border-f1-amber/20" },
  tyre:     { icon: "🛞",  color: "text-f1-amber",  border: "border-f1-amber/20" },
  info:     { icon: "ℹ️",  color: "text-f1-text-dim", border: "border-f1-border" },
};

const FLAG_BADGE: Record<FlagMode, { label: string; cls: string } | null> = {
  green:     { label: "GREEN",      cls: "bg-f1-green/15 text-f1-green border-f1-green/30" },
  yellow:    { label: "YELLOW",     cls: "bg-f1-amber/15 text-f1-amber border-f1-amber/30" },
  sc:        { label: "SAFETY CAR", cls: "bg-f1-amber/20 text-f1-amber border-f1-amber/40 animate-pulse" },
  vsc:       { label: "VSC",        cls: "bg-f1-amber/15 text-f1-amber border-f1-amber/30 animate-pulse" },
  red:       { label: "RED FLAG",   cls: "bg-f1-red/20 text-f1-red border-f1-red/40 animate-pulse" },
  chequered: { label: "FINISHED",   cls: "bg-white/10 text-white border-white/20" },
};

const MAX_UPDATES = 12;

/* ── Helper: format lap time ──────────────────────────────────────── */

function fmtLap(seconds: number | null): string {
  if (seconds == null) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return mins > 0 ? `${mins}:${secs.padStart(6, "0")}` : `${secs}s`;
}

/* ── Component ────────────────────────────────────────────────────── */

const RaceUpdatesInner = () => {
  const { leaderboard, insights, flagMode, raceControlMessages, fetchRaceControl } =
    useF1Store();
  const { currentLap, isPlaying } = useTimeline();

  const [updates, setUpdates] = useState<RaceUpdate[]>([]);
  const prevLeaderboardRef = useRef<LeaderboardEntry[]>([]);
  const prevFlagRef = useRef<FlagMode>("green");
  const prevFastestRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* ── Fetch race control on lap change ───────────────────────────── */

  useEffect(() => {
    if (currentLap < 1) return;
    fetchRaceControl(currentLap);
  }, [currentLap, fetchRaceControl]);

  /* ── Derive updates on data change ──────────────────────────────── */

  useEffect(() => {
    const prev = prevLeaderboardRef.current;
    const now = leaderboard;
    if (now.length === 0) return;

    const newUpdates: RaceUpdate[] = [];
    const ts = Date.now();

    // 1. Detect overtakes
    if (prev.length > 0) {
      const prevMap = new Map(prev.map((e) => [e.driver, e.position]));
      for (const entry of now) {
        const prevPos = prevMap.get(entry.driver);
        if (prevPos != null && prevPos > entry.position) {
          // Driver gained position(s)
          const overtaken = prev.find((p) => p.position === entry.position);
          if (overtaken) {
            newUpdates.push({
              id: `overtake-${entry.driver}-${currentLap}-${ts}`,
              type: "overtake",
              message: `${entry.driver} overtakes ${overtaken.driver} for P${entry.position}`,
              lap: currentLap,
              timestamp: ts,
            });
          }
        }
      }
    }

    // 2. Detect fastest lap
    const validTimes = now
      .filter((e) => e.last_lap_time != null && e.last_lap_time > 0)
      .sort((a, b) => a.last_lap_time! - b.last_lap_time!);

    if (validTimes.length > 0) {
      const fastest = validTimes[0];
      if (
        prevFastestRef.current == null ||
        fastest.last_lap_time! < prevFastestRef.current
      ) {
        prevFastestRef.current = fastest.last_lap_time!;
        newUpdates.push({
          id: `fastest-${fastest.driver}-${currentLap}-${ts}`,
          type: "fastest",
          message: `${fastest.driver} sets fastest lap: ${fmtLap(fastest.last_lap_time)}`,
          lap: currentLap,
          timestamp: ts,
        });
      }
    }

    // 3. Detect battles (gap < 1.0s between adjacent positions)
    const sorted = [...now].sort((a, b) => a.position - b.position);
    for (let i = 0; i < sorted.length - 1; i++) {
      const ahead = sorted[i];
      const behind = sorted[i + 1];
      if (
        ahead.gap_to_leader != null &&
        behind.gap_to_leader != null
      ) {
        const gap = Math.abs(behind.gap_to_leader - ahead.gap_to_leader);
        if (gap < 1.0 && gap > 0) {
          newUpdates.push({
            id: `battle-${ahead.driver}-${behind.driver}-${currentLap}-${ts}`,
            type: "battle",
            message: `${ahead.driver} vs ${behind.driver} — gap ${gap.toFixed(1)}s for P${ahead.position}`,
            lap: currentLap,
            timestamp: ts,
          });
        }
      }
    }

    // 4. Detect pit stops (compound changed from previous lap)
    if (prev.length > 0) {
      const prevCompounds = new Map(prev.map((e) => [e.driver, e.compound]));
      for (const entry of now) {
        const prevCompound = prevCompounds.get(entry.driver);
        if (
          prevCompound &&
          entry.compound &&
          prevCompound !== entry.compound
        ) {
          newUpdates.push({
            id: `pit-${entry.driver}-${currentLap}-${ts}`,
            type: "pit",
            message: `${entry.driver} pits L${currentLap} — ${prevCompound} → ${entry.compound}`,
            lap: currentLap,
            timestamp: ts,
          });
        }
      }
    }

    // 5. Flag changes
    if (flagMode !== prevFlagRef.current) {
      const flagNames: Record<FlagMode, string> = {
        green: "Green flag — racing resumes",
        yellow: "Yellow flag on track",
        sc: "Safety Car deployed",
        vsc: "Virtual Safety Car deployed",
        red: "Red flag — session suspended",
        chequered: "Chequered flag — race over",
      };
      // Don't add the initial "green" on mount
      if (prevFlagRef.current !== "green" || flagMode !== "green") {
        newUpdates.push({
          id: `flag-${flagMode}-${currentLap}-${ts}`,
          type: "flag",
          message: flagNames[flagMode],
          lap: currentLap,
          timestamp: ts,
        });
      }
      prevFlagRef.current = flagMode;
    }

    // 6. Tyre alerts from insights
    const tyreInsights = insights.filter(
      (i) => i.type === "degradation" || i.type === "pit_suggestion"
    );
    for (const ins of tyreInsights.slice(0, 2)) {
      newUpdates.push({
        id: `tyre-${ins.driver}-${ins.lap}-${ts}`,
        type: "tyre",
        message: ins.message.replace(/^[^\w]*/, ""), // strip leading emoji
        lap: ins.lap,
        timestamp: ts,
      });
    }

    // 7. Race control messages
    for (const rc of raceControlMessages.slice(0, 3)) {
      newUpdates.push({
        id: `rc-${rc.message.slice(0, 20)}-${rc.lap}-${ts}`,
        type: rc.category === "Flag" || rc.category === "SafetyCar" ? "flag" : "info",
        message: rc.message,
        lap: rc.lap,
        timestamp: ts,
      });
    }

    // De-duplicate by type+driver pattern within same lap
    const seen = new Set<string>();
    const deduped = newUpdates.filter((u) => {
      const key = `${u.type}-${u.message.slice(0, 30)}-${u.lap}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (deduped.length > 0) {
      setUpdates((prev) => {
        // Merge, de-dup by id, keep newest first, cap at MAX_UPDATES
        const merged = [...deduped, ...prev];
        const idSet = new Set<string>();
        const unique = merged.filter((u) => {
          if (idSet.has(u.id)) return false;
          idSet.add(u.id);
          return true;
        });
        return unique.slice(0, MAX_UPDATES);
      });
    }

    prevLeaderboardRef.current = now;
  }, [leaderboard, insights, flagMode, raceControlMessages, currentLap]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0; // newest at top
    }
  }, [updates.length]);

  const badge = FLAG_BADGE[flagMode];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-2 border-b border-f1-border-solid flex items-center justify-between">
        <h2 className="text-[13px] font-display font-bold uppercase tracking-[0.2em] text-f1-text-dim">
          Race Updates
        </h2>
        <div className="flex items-center gap-2">
          {badge && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded border font-display font-black tracking-wider ${badge.cls}`}
            >
              {badge.label}
            </span>
          )}
          {isPlaying && (
            <div className="w-1.5 h-1.5 rounded-full bg-f1-red animate-live-pulse" />
          )}
        </div>
      </div>

      {/* Feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {updates.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[11px] font-body text-f1-text-muted">
              Race updates will appear here during simulation
            </p>
          </div>
        ) : (
          <div className="divide-y divide-f1-border-solid/20">
            {updates.map((u) => {
              const cfg = UPDATE_CONFIG[u.type];
              return (
                <div
                  key={u.id}
                  className={`flex items-start gap-2 px-3 py-2 hover:bg-white/[0.02] transition-colors border-l-2 ${cfg.border}`}
                >
                  <span className="text-sm shrink-0 mt-0.5">{cfg.icon}</span>
                  <p className={`text-[12px] leading-relaxed font-body flex-1 min-w-0 ${cfg.color}`}>
                    {u.message}
                  </p>
                  {u.lap > 0 && (
                    <span className="text-[10px] font-mono text-f1-text-muted shrink-0 mt-0.5">
                      L{u.lap}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export const RaceUpdates = memo(RaceUpdatesInner);
