"use client";

import { useState, memo } from "react";
import { useF1Store } from "@/store/f1-store";
import { api } from "@/lib/api";
import type { StrategyResult } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";

const StrategySimulatorInner = () => {
  const { drivers, session } = useF1Store();
  const [driver, setDriver] = useState("");
  const [pitLap, setPitLap] = useState(20);
  const [compound, setCompound] = useState("MEDIUM");
  const [result, setResult] = useState<StrategyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSimulate = async () => {
    if (!driver || !pitLap) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.simulateStrategy(driver, pitLap, compound);
      setResult(res);
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const getRecommendationStyle = (rec: string) => {
    switch (rec) {
      case "PIT": return { bg: "rgba(0, 255, 136, 0.1)", color: "var(--f1-accent-green)", border: "rgba(0, 255, 136, 0.25)", label: "PIT NOW", icon: "🟢" };
      case "STAY OUT": return { bg: "rgba(255, 51, 102, 0.1)", color: "var(--f1-accent-red)", border: "rgba(255, 51, 102, 0.25)", label: "STAY OUT", icon: "🔴" };
      default: return { bg: "rgba(255, 215, 0, 0.1)", color: "var(--f1-accent-yellow)", border: "rgba(255, 215, 0, 0.25)", label: "MARGINAL", icon: "🟡" };
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b" style={{ borderColor: "var(--f1-border)" }}>
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--f1-text-dim)" }}>
          Strategy Simulator
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Inputs */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[9px] uppercase tracking-wider block mb-1 font-bold" style={{ color: "var(--f1-text-dim)" }}>
              Driver
            </label>
            <select
              value={driver}
              onChange={(e) => setDriver(e.target.value)}
              className="w-full text-[10px] px-2 py-1.5 rounded-lg border font-medium"
              style={{ background: "var(--f1-surface-glass)", borderColor: "var(--f1-border)", color: "var(--f1-text)" }}
            >
              <option value="">Select...</option>
              {drivers.map((d) => (
                <option key={d.abbreviation} value={d.abbreviation}>{d.abbreviation}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-wider block mb-1 font-bold" style={{ color: "var(--f1-text-dim)" }}>
              Pit Lap
            </label>
            <input
              type="number"
              min={1}
              max={session?.total_laps || 70}
              value={pitLap}
              onChange={(e) => setPitLap(parseInt(e.target.value) || 1)}
              className="w-full text-[10px] px-2 py-1.5 rounded-lg border text-center font-mono font-bold"
              style={{ background: "var(--f1-surface-glass)", borderColor: "var(--f1-border)", color: "var(--f1-text)" }}
            />
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-wider block mb-1 font-bold" style={{ color: "var(--f1-text-dim)" }}>
              Compound
            </label>
            <select
              value={compound}
              onChange={(e) => setCompound(e.target.value)}
              className="w-full text-[10px] px-2 py-1.5 rounded-lg border font-medium"
              style={{ background: "var(--f1-surface-glass)", borderColor: "var(--f1-border)", color: "var(--f1-text)" }}
            >
              <option value="SOFT">🔴 Soft</option>
              <option value="MEDIUM">🟡 Medium</option>
              <option value="HARD">⚪ Hard</option>
            </select>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSimulate}
          disabled={!driver || loading || !session}
          className="w-full text-[10px] py-2 rounded-lg font-black uppercase tracking-wider transition-all disabled:opacity-30"
          style={{
            background: "linear-gradient(135deg, var(--f1-accent-purple), #7c3aed)",
            color: "#fff",
            boxShadow: "0 0 12px rgba(168, 85, 247, 0.2)",
          }}
        >
          {loading ? "Simulating..." : "Run Strategy"}
        </motion.button>

        {error && (
          <p className="text-[10px] px-2 py-1.5 rounded-lg" style={{ background: "rgba(255, 51, 102, 0.08)", color: "var(--f1-accent-red)" }}>
            {error}
          </p>
        )}

        {/* Result */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-2"
            >
              {/* Recommendation badge */}
              <div
                className="rounded-lg p-3 text-center border"
                style={{
                  background: getRecommendationStyle(result.recommendation).bg,
                  borderColor: getRecommendationStyle(result.recommendation).border,
                }}
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg">{getRecommendationStyle(result.recommendation).icon}</span>
                  <span className="text-sm font-black uppercase tracking-[0.15em]" style={{
                    color: getRecommendationStyle(result.recommendation).color,
                  }}>
                    {getRecommendationStyle(result.recommendation).label}
                  </span>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-1.5">
                <div className="rounded-lg p-2.5 border" style={{ background: "rgba(255,255,255,0.02)", borderColor: "var(--f1-border)" }}>
                  <span className="text-[8px] uppercase block font-bold tracking-wider" style={{ color: "var(--f1-text-dim)" }}>Time Delta</span>
                  <span className="text-sm font-mono font-black" style={{
                    color: result.time_delta_vs_no_stop < 0 ? "var(--f1-accent-green)" : "var(--f1-accent-red)",
                  }}>
                    {result.time_delta_vs_no_stop > 0 ? "+" : ""}{result.time_delta_vs_no_stop.toFixed(1)}s
                  </span>
                </div>
                <div className="rounded-lg p-2.5 border" style={{ background: "rgba(255,255,255,0.02)", borderColor: "var(--f1-border)" }}>
                  <span className="text-[8px] uppercase block font-bold tracking-wider" style={{ color: "var(--f1-text-dim)" }}>Position</span>
                  <span className="text-sm font-mono font-black">
                    P{result.current_position} → P{result.projected_position}
                  </span>
                </div>
                <div className="rounded-lg p-2.5 border" style={{ background: "rgba(255,255,255,0.02)", borderColor: "var(--f1-border)" }}>
                  <span className="text-[8px] uppercase block font-bold tracking-wider" style={{ color: "var(--f1-text-dim)" }}>Old Pace</span>
                  <span className="text-[11px] font-mono font-bold">{result.old_pace_avg.toFixed(3)}s</span>
                </div>
                <div className="rounded-lg p-2.5 border" style={{ background: "rgba(255,255,255,0.02)", borderColor: "var(--f1-border)" }}>
                  <span className="text-[8px] uppercase block font-bold tracking-wider" style={{ color: "var(--f1-text-dim)" }}>New Pace</span>
                  <span className="text-[11px] font-mono font-bold">{result.new_pace_base.toFixed(3)}s</span>
                </div>
              </div>

              <p className="text-[10px] leading-relaxed" style={{ color: "var(--f1-text-dim)" }}>
                {result.explanation}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export const StrategySimulator = memo(StrategySimulatorInner);
