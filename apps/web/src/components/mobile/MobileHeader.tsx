"use client";

import { useState, useEffect, memo, useCallback } from "react";
import { useF1Store } from "@/store/f1-store";
import { useTimeline } from "@/engines/Timeline";
import { api } from "@/lib/api";
import { WeatherWidget } from "@/components/Weather/WeatherWidget";
import { RaceOSLogo } from "@/components/shared/RaceOSLogo";
import type { AvailableSession } from "@/lib/types";

const MobileHeaderInner = () => {
  const { session, loading, loadSession, wsConnected, flagMode } = useF1Store();
  const { isPlaying, play, pause, speed } = useTimeline();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessions, setSessions] = useState<AvailableSession[]>([]);

  useEffect(() => {
    api.getAvailableSessions().then(setSessions).catch(() => {});
  }, []);

  const handleLoadSession = useCallback(async (year: number, gp: string) => {
    setMenuOpen(false);
    await loadSession(year, gp);
  }, [loadSession]);

  const handleSimToggle = useCallback(async () => {
    if (isPlaying) {
      pause();
      try { await api.stopLive(); } catch {}
    } else {
      const BASE_LAP_SECONDS = 12;
      const backendSpeed = BASE_LAP_SECONDS / speed;
      play();
      try { await api.startLive(backendSpeed); } catch {}
    }
  }, [isPlaying, play, pause, speed]);

  // Flag color for top accent
  const flagAccent =
    flagMode === "sc" || flagMode === "vsc" || flagMode === "yellow"
      ? "via-f1-amber"
      : flagMode === "red"
      ? "via-f1-red"
      : "via-f1-red/60";

  return (
    <>
      <header className="relative shrink-0 bg-black/80 backdrop-blur-sm border-b border-f1-red/[0.15]">
        {/* Top accent line */}
        <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent ${flagAccent} to-transparent`} />

        <div className="flex items-center justify-between px-3 py-2">
          {/* Left: Logo + WS */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-f1-red shadow-glow-red animate-pulse-glow" />
            </div>
            <RaceOSLogo size="small" />
            <div className={`w-1.5 h-1.5 rounded-full ml-1 ${wsConnected ? "bg-f1-green" : "bg-f1-text-muted"}`} />
          </div>

          {/* Center: Session name */}
          {session && (
            <div className="flex-1 text-center mx-2 truncate">
              <span className="text-[11px] font-display font-bold uppercase tracking-wide text-f1-text truncate">
                {session.name}
              </span>
            </div>
          )}

          {/* Right: Controls */}
          <div className="flex items-center gap-1.5">
            <WeatherWidget />

            {/* Sim toggle */}
            <button
              onClick={handleSimToggle}
              disabled={loading || !session}
              className={`px-2.5 py-1 rounded-md text-[10px] font-display font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-30 ${
                isPlaying
                  ? "bg-f1-surface-2 border border-f1-border text-f1-text"
                  : "bg-f1-red text-white shadow-glow-red"
              }`}
            >
              {isPlaying ? "⏹" : "▶"}
            </button>

            {/* Hamburger */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-7 h-7 flex items-center justify-center rounded-md border border-f1-border text-f1-text-dim active:bg-white/5"
              aria-label="Menu"
            >
              {menuOpen ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── Slide-down menu ── */}
      {menuOpen && (
        <div className="absolute top-[48px] left-0 right-0 z-50 bg-f1-surface border-b border-f1-red/20 shadow-panel-hero max-h-[60vh] overflow-y-auto mobile-scroll">
          <div className="p-3 border-b border-f1-border">
            <span className="text-[9px] font-display font-bold uppercase tracking-[0.2em] text-f1-text-muted">
              Load Session
            </span>
          </div>
          <div className="p-2 flex flex-col gap-1">
            {sessions.map((s) => (
              <button
                key={`${s.year}-${s.gp}`}
                onClick={() => handleLoadSession(s.year, s.gp)}
                className="w-full text-left px-3 py-2.5 rounded-md text-[13px] font-body text-f1-text-dim hover:text-f1-text active:bg-f1-red/10 transition-colors"
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export const MobileHeader = memo(MobileHeaderInner);
