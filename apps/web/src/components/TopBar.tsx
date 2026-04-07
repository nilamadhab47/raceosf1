"use client";

import { useEffect, useState, memo } from "react";
import { useF1Store } from "@/store/f1-store";
import { api } from "@/lib/api";
import type { AvailableSession } from "@/lib/types";
import { motion } from "framer-motion";

const TopBarInner = () => {
  const { session, liveState, loading, loadSession, fetchLiveState } = useF1Store();
  const [sessions, setSessions] = useState<AvailableSession[]>([]);
  const [simRunning, setSimRunning] = useState(false);

  useEffect(() => {
    api.getAvailableSessions().then(setSessions).catch(() => {});
  }, []);

  useEffect(() => {
    if (!simRunning) return;
    const interval = setInterval(() => {
      fetchLiveState();
    }, 2000);
    return () => clearInterval(interval);
  }, [simRunning, fetchLiveState]);

  const handleLoadSession = async (year: number, gp: string) => {
    await loadSession(year, gp);
  };

  const handleStartSim = async () => {
    await api.startLive(3.0);
    setSimRunning(true);
    fetchLiveState();
  };

  const handleStopSim = async () => {
    await api.stopLive();
    setSimRunning(false);
    fetchLiveState();
  };

  return (
    <header className="flex items-center justify-between px-6 py-2.5 border-b relative"
      style={{
        background: "var(--f1-surface-glass)",
        borderColor: "var(--f1-border)",
        backdropFilter: "blur(20px)",
      }}>
      {/* Subtle top glow line */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{
        background: "linear-gradient(90deg, transparent, var(--f1-accent-green), var(--f1-accent-purple), transparent)",
        opacity: 0.3,
      }} />

      {/* Left: Logo */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-2 h-2 rounded-full" style={{
              background: "var(--f1-accent-green)",
              boxShadow: "0 0 8px var(--f1-accent-green)",
              animation: "pulse-glow 2s ease-in-out infinite",
            }} />
          </div>
          <h1 className="text-base font-black tracking-tight">
            F1 <span style={{ color: "var(--f1-accent-purple)" }}>Intelligence</span>
          </h1>
        </div>

        {session && (
          <div className="flex items-center gap-2 ml-3 pl-3 border-l" style={{ borderColor: "var(--f1-border)" }}>
            <span className="text-[11px] font-bold uppercase tracking-wide">{session.name}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-md font-mono"
              style={{ background: "rgba(255,255,255,0.05)", color: "var(--f1-text-dim)" }}>
              {session.circuit}
            </span>
          </div>
        )}
      </div>

      {/* Center: Live bar */}
      <div className="flex items-center gap-4">
        {liveState && liveState.is_running && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 px-4 py-1.5 rounded-full border"
            style={{
              background: "rgba(255, 45, 85, 0.08)",
              borderColor: "rgba(255, 45, 85, 0.2)",
            }}
          >
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{
                background: "var(--f1-accent-red)",
                animation: "live-pulse 1.5s ease-in-out infinite",
              }} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "var(--f1-accent-red)" }}>
                LIVE
              </span>
            </div>
            <span className="text-[11px] font-mono font-bold tabular-nums">
              LAP {liveState.current_lap}/{liveState.total_laps}
            </span>
            <div className="w-24 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${liveState.progress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                style={{ background: "linear-gradient(90deg, var(--f1-accent-green), var(--f1-accent-cyan))" }}
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-2">
        <select
          className="text-[10px] px-3 py-1.5 rounded-lg border appearance-none cursor-pointer font-medium"
          style={{
            background: "var(--f1-surface-glass)",
            borderColor: "var(--f1-border)",
            color: "var(--f1-text)",
          }}
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

        {!simRunning ? (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleStartSim}
            disabled={loading || !session}
            className="text-[10px] px-4 py-1.5 rounded-lg font-black uppercase tracking-wider transition-all disabled:opacity-30"
            style={{
              background: "linear-gradient(135deg, var(--f1-accent-green), #00cc6a)",
              color: "#000",
              boxShadow: "0 0 12px rgba(0, 255, 136, 0.2)",
            }}
          >
            ▶ Simulate
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleStopSim}
            className="text-[10px] px-4 py-1.5 rounded-lg font-black uppercase tracking-wider transition-all"
            style={{
              background: "linear-gradient(135deg, var(--f1-accent-red), #cc0033)",
              color: "#fff",
              boxShadow: "0 0 12px rgba(255, 45, 85, 0.2)",
            }}
          >
            ⏹ Stop
          </motion.button>
        )}

        {loading && (
          <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--f1-accent-purple)", borderTopColor: "transparent" }} />
        )}
      </div>
    </header>
  );
};

export const TopBar = memo(TopBarInner);
