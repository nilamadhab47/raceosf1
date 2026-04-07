"use client";

import { useEffect, useRef, useState, memo } from "react";
import { useF1Store } from "@/store/f1-store";
import gsap from "gsap";

interface PitEvent {
  driver: string;
  teamColor: string;
  oldCompound: string;
  newCompound: string;
  timestamp: number;
}

const COMPOUND_ICON: Record<string, string> = {
  SOFT: "🔴", MEDIUM: "🟡", HARD: "⚪", INTERMEDIATE: "🟢", WET: "🔵",
};

const PitStopTimerInner = () => {
  const { leaderboard, liveState } = useF1Store();
  const [activePits, setActivePits] = useState<PitEvent[]>([]);
  const prevStintsRef = useRef<Record<string, number>>({});
  const prevCompoundsRef = useRef<Record<string, string>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Detect pit stops by watching stint changes in leaderboard
  useEffect(() => {
    if (!liveState?.is_running || leaderboard.length === 0) return;

    const newPits: PitEvent[] = [];
    leaderboard.forEach((entry) => {
      const prevStint = prevStintsRef.current[entry.driver];
      const prevCompound = prevCompoundsRef.current[entry.driver];
      const currentStint = entry.stint ?? 0;
      const currentCompound = entry.compound ?? "";

      if (prevStint != null && currentStint > prevStint) {
        newPits.push({
          driver: entry.driver,
          teamColor: entry.team_color,
          oldCompound: prevCompound || "?",
          newCompound: currentCompound || "?",
          timestamp: Date.now(),
        });
      }

      prevStintsRef.current[entry.driver] = currentStint;
      prevCompoundsRef.current[entry.driver] = currentCompound;
    });

    if (newPits.length > 0) {
      setActivePits((prev) => [...prev, ...newPits].slice(-4));
    }
  }, [leaderboard, liveState]);

  // Auto-dismiss pit events after 6 seconds
  useEffect(() => {
    if (activePits.length === 0) return;
    timerRef.current = setInterval(() => {
      setActivePits((prev) => prev.filter((p) => Date.now() - p.timestamp < 6000));
    }, 500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activePits.length]);

  if (activePits.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-[90] flex flex-col gap-2 pointer-events-none">
      {activePits.map((pit) => (
        <PitCard key={`${pit.driver}-${pit.timestamp}`} pit={pit} />
      ))}
    </div>
  );
};

const PitCard = ({ pit }: { pit: PitEvent }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!cardRef.current) return;
    gsap.fromTo(cardRef.current,
      { opacity: 0, x: 60, scale: 0.9 },
      { opacity: 1, x: 0, scale: 1, duration: 0.4, ease: "back.out(1.4)" }
    );

    // Fade out after 5s
    gsap.to(cardRef.current, {
      opacity: 0, x: 40, delay: 5, duration: 0.5, ease: "power2.in",
    });
  }, []);

  // Running timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(((Date.now() - pit.timestamp) / 1000));
    }, 100);
    return () => clearInterval(interval);
  }, [pit.timestamp]);

  return (
    <div
      ref={cardRef}
      className="flex items-center gap-3 px-4 py-2.5 rounded-xl border bg-f1-surface/95 backdrop-blur-xl"
      style={{ borderColor: `${pit.teamColor}40` }}
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-f1-cyan/10 text-sm">
        🔧
      </div>
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-display font-black" style={{ color: pit.teamColor }}>
            {pit.driver}
          </span>
          <span className="text-[13px] font-display font-bold uppercase tracking-wider text-f1-cyan">
            PIT STOP
          </span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[13px]">{COMPOUND_ICON[pit.oldCompound] || "⬜"}</span>
          <span className="text-[13px] text-f1-text-muted">→</span>
          <span className="text-[13px]">{COMPOUND_ICON[pit.newCompound] || "⬜"}</span>
          <span className="text-[13px] font-mono text-f1-text-dim ml-1">
            {pit.oldCompound[0]} → {pit.newCompound[0]}
          </span>
        </div>
      </div>
      {/* Timer */}
      <div className="ml-auto text-right">
        <span className="text-sm font-mono font-black tabular-nums text-f1-cyan">
          {elapsed.toFixed(1)}s
        </span>
      </div>
    </div>
  );
};

export const PitStopTimer = memo(PitStopTimerInner);
