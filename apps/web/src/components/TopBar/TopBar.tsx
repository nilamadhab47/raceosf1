"use client";

import { useEffect, useState, memo } from "react";
import { useF1Store } from "@/store/f1-store";
import { useTimeline } from "@/engines/Timeline";
import { api } from "@/lib/api";
import type { AvailableSession, FlagMode } from "@/lib/types";
import { WeatherWidget } from "@/components/Weather/WeatherWidget";
import { RaceOSLogo } from "@/components/shared/RaceOSLogo";
import { useOnboardingStore } from "@/store/onboarding-store";
import { useSettingsStore } from "@/store/settings-store";

const FLAG_CONFIG: Record<FlagMode, { label: string; bg: string; text: string; glow: string; border: string } | null> = {
  green: null,
  yellow: { label: "⚠ YELLOW FLAG", bg: "bg-f1-amber/10", text: "text-f1-amber", glow: "shadow-glow-amber", border: "border-f1-amber/30" },
  sc: { label: "🚗 SAFETY CAR DEPLOYED", bg: "bg-f1-amber/15", text: "text-f1-amber", glow: "shadow-glow-amber", border: "border-f1-amber/40" },
  vsc: { label: "⚡ VIRTUAL SAFETY CAR", bg: "bg-f1-amber/10", text: "text-f1-amber", glow: "shadow-glow-amber", border: "border-f1-amber/30" },
  red: { label: "🛑 RED FLAG — SESSION SUSPENDED", bg: "bg-f1-red/15", text: "text-f1-red", glow: "shadow-glow-red", border: "border-f1-red/40" },
  chequered: { label: "🏁 CHEQUERED FLAG", bg: "bg-white/5", text: "text-white", glow: "", border: "border-white/20" },
};

const TopBarInner = () => {
  const {
    session, loading, loadSession, fetchLiveState, wsConnected,
    mode, liveAvailable, rateLimit, fetchMode, fetchRateLimit, flagMode,
  } = useF1Store();
  const { isPlaying, currentLap, totalLaps, progress: timelineProgress, speed, play, pause } = useTimeline();
  const startTour = useOnboardingStore((s) => s.startTour);
  const openSettings = useSettingsStore((s) => s.openSettings);
  const [sessions, setSessions] = useState<AvailableSession[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    api.getAvailableSessions().then(setSessions).catch(() => {});
    fetchMode();
  }, []);

  // Poll rate limit when in live mode
  useEffect(() => {
    if (mode !== "live") return;
    fetchRateLimit();
    const interval = setInterval(fetchRateLimit, 5000);
    return () => clearInterval(interval);
  }, [mode, fetchRateLimit]);

  // Poll live state while playing (for WebSocket broadcast data)
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => fetchLiveState(), 2000);
    return () => clearInterval(interval);
  }, [isPlaying, fetchLiveState]);

  const handleLoadSession = async (year: number, gp: string) => {
    await loadSession(year, gp);
  };

  /** Simulate = Timeline play + backend sim start */
  const handleStartSim = async () => {
    const BASE_LAP_SECONDS = 12;
    const backendSpeed = BASE_LAP_SECONDS / speed;
    play();
    try {
      await api.startLive(backendSpeed);
      fetchLiveState();
    } catch {}
  };

  /** Stop = Timeline pause + backend sim stop */
  const handleStopSim = async () => {
    pause();
    try {
      await api.stopLive();
    } catch {}
  };

  const handleSyncData = async () => {
    if (syncing) return;
    setSyncing(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);
    try {
      await api.db.syncLatest();
    } catch (e) {
      console.warn("Sync finished (may have timed out):", e);
    } finally {
      clearTimeout(timeout);
      setSyncing(false);
    }
  };

  return (
    <div>
    <header className="flex items-center justify-between px-6 py-2.5 border-b border-f1-red/[0.15] relative bg-black/80 backdrop-blur-sm">
      {/* Top accent line — tinted by flag */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent ${
        flagMode === "sc" || flagMode === "vsc" || flagMode === "yellow" ? "via-f1-amber" :
        flagMode === "red" ? "via-f1-red" : "via-f1-red/60"
      } to-transparent`} />

      {/* Left: Branding */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-2.5 h-2.5 rounded-full bg-f1-red shadow-glow-red animate-pulse-glow" />
            <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-f1-red/30 animate-ping" />
          </div>
          <RaceOSLogo size="small" />
        </div>

        {session && (
          <div className="flex items-center gap-2.5 ml-3 pl-3 border-l border-f1-red/[0.12]">
            <span className="text-sm font-display font-bold uppercase tracking-wide text-f1-text">{session.name}</span>
            <span className="text-[13px] px-2 py-0.5 rounded-md font-mono bg-white/[0.04] border border-white/[0.06] text-f1-text-dim">
              {session.circuit}
            </span>
          </div>
        )}
      </div>

      {/* Center: Live simulation bar + Weather */}
      <div className="flex items-center gap-4">
        <WeatherWidget />
        {isPlaying && (
          <div className="flex items-center gap-3 px-5 py-2 rounded-full border bg-f1-red/[0.06] border-f1-red/25 shadow-glow-red">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-f1-red animate-live-pulse" />
              <span className="text-sm font-display font-black uppercase tracking-[0.25em] text-f1-red">
                LIVE
              </span>
            </div>
            <div className="w-px h-5 bg-f1-red/20" />
            <span className="text-lg font-display font-black tabular-nums tracking-wide text-f1-text">
              LAP <span className="text-4xl text-f1-red drop-shadow-[0_0_12px_rgba(225,6,0,0.5)]">{currentLap}</span>
              <span className="text-f1-text-dim text-base">/{totalLaps}</span>
            </span>
            <div className="w-28 h-1.5 rounded-full overflow-hidden bg-white/[0.06]">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-f1-red to-f1-red/70"
                style={{ width: `${timelineProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-2">
        <select
          className="text-[13px] px-3 py-1.5 rounded-lg border appearance-none cursor-pointer font-body font-medium bg-f1-surface/50 border-f1-border-solid text-f1-text"
          onChange={(e) => {
            const [year, gp] = e.target.value.split("|");
            if (year && gp) handleLoadSession(parseInt(year), gp);
          }}
          defaultValue=""
        >
          <option value="" disabled>Load Session...</option>
          {sessions.map((s) => (
            <option key={`${s.year}-${s.gp}`} value={`${s.year}|${s.gp}`}>
              {s.name}
            </option>
          ))}
        </select>

        {/* Sync data from APIs to DB */}
        <button
          onClick={handleSyncData}
          disabled={syncing}
          className="text-[13px] px-3 py-1.5 rounded-lg font-display font-bold uppercase tracking-wider transition-all border bg-f1-surface-2 border-f1-border text-f1-text-dim hover:text-f1-text disabled:opacity-40"
          title="Fetch latest 2026 race data from APIs and save to database"
        >
          {syncing ? (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full border-2 border-f1-red border-t-transparent animate-spin" />
              Syncing...
            </span>
          ) : (
            "⟳ Sync Data"
          )}
        </button>

        {!isPlaying ? (
          <button
            onClick={handleStartSim}
            disabled={loading || !session}
            data-tour="simulate"
            className="text-[13px] px-5 py-2 rounded-lg font-display font-black uppercase tracking-wider transition-all disabled:opacity-30 bg-f1-red text-white hover:brightness-110 active:scale-[0.97] shadow-glow-red hover:shadow-[0_0_25px_rgba(225,6,0,0.4)]"
          >
            ▶ Simulate
          </button>
        ) : (
          <button
            onClick={handleStopSim}
            className="text-[13px] px-4 py-1.5 rounded-lg font-display font-black uppercase tracking-wider transition-all bg-f1-surface-2 border border-f1-border text-f1-text hover:brightness-110 active:scale-[0.97]"
          >
            ⏹ Stop
          </button>
        )}

        {loading && (
          <div className="w-4 h-4 rounded-full border-2 border-f1-red border-t-transparent animate-spin" />
        )}

        {/* WebSocket indicator */}
        <div className="flex items-center gap-1 ml-2" title={wsConnected ? "WebSocket connected" : "WebSocket disconnected"}>
          <div className={`w-1.5 h-1.5 rounded-full ${wsConnected ? "bg-f1-green" : "bg-f1-text-muted"}`} />
          <span className="text-[13px] font-mono text-f1-text-muted uppercase">
            WS
          </span>
        </div>

        {/* Settings button */}
        <button
          onClick={openSettings}
          data-tour="settings"
          className="ml-1 w-7 h-7 flex items-center justify-center rounded-lg border border-f1-border text-f1-text-dim hover:text-f1-text hover:border-f1-red/30 transition-colors"
          title="Settings — toggle panels"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        {/* Tour guide button */}
        <button
          onClick={startTour}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-f1-border text-f1-text-dim hover:text-f1-text hover:border-f1-red/30 transition-colors"
          title="Start guided tour"
        >
          ?
        </button>

        {/* Mode toggle */}
        {liveAvailable && (
          <button
            onClick={async () => {
              const next = mode === "simulation" ? "live" : "simulation";
              await api.setMode(next);
              fetchMode();
            }}
            className={`ml-1 text-[13px] px-2 py-1 rounded font-display font-black uppercase tracking-wider border transition-colors ${
              mode === "live"
                ? "bg-f1-red/10 border-f1-red/30 text-f1-red"
                : "bg-white/5 border-f1-border text-f1-text-dim hover:text-f1-text"
            }`}
          >
            {mode === "live" ? "● LIVE" : "SIM"}
          </button>
        )}

        {/* Rate limit counter */}
        {rateLimit && mode === "live" && (
          <div className="flex items-center gap-1 ml-1" title="RapidAPI rate limit">
            <span className={`text-[13px] font-mono tabular-nums ${
              rateLimit.remaining < 4 ? "text-f1-red" : "text-f1-text-dim"
            }`}>
              API: {rateLimit.remaining}/{rateLimit.limit}
            </span>
          </div>
        )}
      </div>
    </header>

    {/* Flag banner */}
    {FLAG_CONFIG[flagMode] && (
      <div className={`flex items-center justify-center gap-2 px-4 py-1.5 border-b ${FLAG_CONFIG[flagMode]!.bg} ${FLAG_CONFIG[flagMode]!.border} ${FLAG_CONFIG[flagMode]!.glow}`}>
        <span className={`text-[13px] font-display font-black uppercase tracking-[0.25em] animate-pulse ${FLAG_CONFIG[flagMode]!.text}`}>
          {FLAG_CONFIG[flagMode]!.label}
        </span>
      </div>
    )}
    </div>
  );
};

export const TopBar = memo(TopBarInner);
