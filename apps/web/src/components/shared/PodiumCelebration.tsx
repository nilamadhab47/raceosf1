"use client";

import { useEffect, useRef, useState } from "react";
import { useF1Store } from "@/store/f1-store";
import gsap from "gsap";
import { Trophy, Flag } from "lucide-react";

const PODIUM_HEIGHTS = [120, 90, 70]; // px heights for P1, P2, P3 bars

export function PodiumCelebration() {
  const flagMode = useF1Store((s) => s.flagMode);
  const leaderboard = useF1Store((s) => s.leaderboard);
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevFlag = useRef(flagMode);

  // Trigger when flagMode transitions to "chequered"
  useEffect(() => {
    if (flagMode === "chequered" && prevFlag.current !== "chequered" && !dismissed) {
      setShow(true);
    }
    prevFlag.current = flagMode;
  }, [flagMode, dismissed]);

  // GSAP entrance animation
  useEffect(() => {
    if (!show || !containerRef.current) return;

    const el = containerRef.current;
    const items = el.querySelectorAll("[data-podium-item]");
    const bars = el.querySelectorAll("[data-podium-bar]");

    gsap.fromTo(
      el,
      { opacity: 0, scale: 0.9 },
      { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.4)" }
    );

    gsap.fromTo(
      bars,
      { height: 0 },
      { height: (i: number) => PODIUM_HEIGHTS[i] ?? 60, duration: 0.8, stagger: 0.15, ease: "power3.out", delay: 0.3 }
    );

    gsap.fromTo(
      items,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.15, ease: "power2.out", delay: 0.6 }
    );

    // Auto-dismiss after 8 seconds
    const timer = setTimeout(() => {
      gsap.to(el, {
        opacity: 0,
        y: -30,
        duration: 0.5,
        ease: "power2.in",
        onComplete: () => {
          setShow(false);
          setDismissed(true);
        },
      });
    }, 8000);

    return () => clearTimeout(timer);
  }, [show]);

  // Reset dismissed state when flag changes away from chequered
  useEffect(() => {
    if (flagMode !== "chequered") setDismissed(false);
  }, [flagMode]);

  if (!show || leaderboard.length < 3) return null;

  const podium = leaderboard.slice(0, 3);
  // Display order: P2, P1, P3 (classic podium layout)
  const displayOrder = [podium[1], podium[0], podium[2]];
  const posLabels = [2, 1, 3];

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center pointer-events-none">
      <div
        ref={containerRef}
        className="pointer-events-auto bg-f1-surface/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl min-w-[400px] cursor-pointer"
        onClick={() => {
          setShow(false);
          setDismissed(true);
        }}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Flag className="w-5 h-5 text-white/50" />
            <span className="text-[13px] font-display uppercase tracking-[0.3em] text-white/40">
              Chequered Flag
            </span>
            <Flag className="w-5 h-5 text-white/50" />
          </div>
          <h2 className="text-lg font-display font-black text-f1-green tracking-wider">
            RACE COMPLETE
          </h2>
        </div>

        {/* Podium */}
        <div className="flex items-end justify-center gap-2">
          {displayOrder.map((entry, i) => {
            const pos = posLabels[i];
            return (
              <div
                key={entry.driver}
                data-podium-item
                className="flex flex-col items-center w-28"
              >
                {/* Trophy for P1 */}
                {pos === 1 && (
                  <Trophy className="w-6 h-6 text-f1-gold mb-1 animate-pulse" />
                )}

                {/* Driver name */}
                <span
                  className="text-sm font-display font-black tracking-wide mb-1"
                  style={{ color: entry.team_color }}
                >
                  {entry.driver}
                </span>
                <span className="text-[13px] font-body text-white/40 mb-2 truncate max-w-full">
                  {entry.full_name}
                </span>

                {/* Podium bar */}
                <div
                  data-podium-bar
                  className="w-full rounded-t-lg flex items-start justify-center pt-3"
                  style={{
                    height: 0, // Animated via GSAP
                    background: `linear-gradient(180deg, ${entry.team_color}40, ${entry.team_color}15)`,
                    borderTop: `3px solid ${entry.team_color}`,
                  }}
                >
                  <span
                    className={`text-2xl font-display font-black ${
                      pos === 1
                        ? "text-f1-gold"
                        : pos === 2
                          ? "text-f1-cyan"
                          : "text-f1-amber"
                    }`}
                  >
                    P{pos}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-4 text-[13px] text-white/20 font-body">
          Click to dismiss
        </div>
      </div>
    </div>
  );
}
