"use client";

import { useEffect, useRef, useState } from "react";
import { useF1Store } from "@/store/f1-store";
import gsap from "gsap";

export function FastestLapCelebration() {
  const { leaderboard } = useF1Store();
  const [celebration, setCelebration] = useState<{
    driver: string;
    time: number;
    team_color: string;
  } | null>(null);
  const prevFastest = useRef<string>("");
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (leaderboard.length === 0) return;

    const validEntries = leaderboard.filter((e) => e.last_lap_time != null);
    if (validEntries.length === 0) return;

    const fastest = validEntries.reduce((min, e) =>
      e.last_lap_time! < (min.last_lap_time ?? Infinity) ? e : min
    );

    const key = `${fastest.driver}-${fastest.last_lap_time}`;
    if (key !== prevFastest.current && prevFastest.current !== "") {
      setCelebration({
        driver: fastest.driver,
        time: fastest.last_lap_time!,
        team_color: fastest.team_color,
      });

      // Auto-dismiss after 3s
      setTimeout(() => setCelebration(null), 3000);
    }
    prevFastest.current = key;
  }, [leaderboard]);

  useEffect(() => {
    if (!celebration || !overlayRef.current) return;

    const el = overlayRef.current;
    gsap.fromTo(
      el,
      { opacity: 0, scale: 0.8, y: 20 },
      { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "back.out(1.7)" }
    );

    // Animate out
    gsap.to(el, {
      opacity: 0,
      y: -20,
      delay: 2.5,
      duration: 0.4,
      ease: "power2.in",
    });
  }, [celebration]);

  if (!celebration) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
      <div
        ref={overlayRef}
        className="flex items-center gap-3 px-6 py-3 rounded-xl border border-f1-purple/40 bg-f1-surface/90 backdrop-blur-xl shadow-glow-purple"
      >
        <span className="text-lg font-display font-black text-f1-purple animate-pulse-glow">
          FL
        </span>
        <div>
          <span
            className="text-sm font-display font-black tracking-wide"
            style={{ color: celebration.team_color }}
          >
            {celebration.driver}
          </span>
          <span className="text-[13px] font-mono text-f1-purple ml-2">
            {celebration.time.toFixed(3)}s
          </span>
        </div>
        <span className="text-[13px] text-f1-text-dim">FASTEST LAP</span>
      </div>
    </div>
  );
}
