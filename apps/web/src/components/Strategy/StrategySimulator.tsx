"use client";

import { useState, memo } from "react";
import { useF1Store } from "@/store/f1-store";
import { api } from "@/lib/api";
import type { StrategyResult } from "@/lib/types";

const COMPOUNDS = [
  { value: "SOFT", label: "Soft", emoji: "🔴", color: "#ff3333" },
  { value: "MEDIUM", label: "Medium", emoji: "🟡", color: "#ffcc00" },
  { value: "HARD", label: "Hard", emoji: "⚪", color: "#cccccc" },
];

const getRecStyle = (rec: string) => {
  switch (rec) {
    case "PIT":      return { bg: "bg-f1-green/10", border: "border-f1-green/25", color: "text-f1-green", label: "PIT NOW", icon: "🟢" };
    case "STAY OUT": return { bg: "bg-f1-red/10",   border: "border-f1-red/25",   color: "text-f1-red",   label: "STAY OUT", icon: "🔴" };
    default:         return { bg: "bg-f1-amber/10",  border: "border-f1-amber/25", color: "text-f1-amber", label: "MARGINAL", icon: "🟡" };
  }
};

interface StrategyStop {
  lap: number;
  compound: string;
}

const StrategySimulatorInner = () => {
  const { drivers, session } = useF1Store();
  const [driver, setDriver] = useState("");
  const [stops, setStops] = useState<StrategyStop[]>([{ lap: 20, compound: "MEDIUM" }]);
  const [results, setResults] = useState<StrategyResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);

  const totalLaps = session?.total_laps || 57;

  const addStop = () => {
    if (stops.length >= 3) return;
    const lastLap = stops[stops.length - 1]?.lap ?? 20;
    setStops([...stops, { lap: Math.min(lastLap + 15, totalLaps - 5), compound: "HARD" }]);
  };

  const removeStop = (idx: number) => {
    if (stops.length <= 1) return;
    setStops(stops.filter((_, i) => i !== idx));
  };

  const updateStop = (idx: number, field: "lap" | "compound", value: string | number) => {
    const updated = [...stops];
    if (field === "lap") updated[idx] = { ...updated[idx], lap: value as number };
    else updated[idx] = { ...updated[idx], compound: value as string };
    setStops(updated);
  };

  const handleSimulate = async () => {
    if (!driver || stops.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      // Simulate each stop independently
      const allResults: StrategyResult[] = [];
      for (const stop of stops) {
        const res = await api.simulateStrategy(driver, stop.lap, stop.compound);
        allResults.push(res);
      }
      setResults(allResults);
      setShowTimeline(true);
    } catch (e) {
      setError((e as Error).message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Build stint segments for visual timeline
  const stintSegments = (() => {
    const sorted = [...stops].sort((a, b) => a.lap - b.lap);
    const segs: { start: number; end: number; compound: string; color: string }[] = [];
    let start = 1;
    // First stint: starting compound (assume SOFT if not known)
    const firstCompound = "SOFT";
    for (let i = 0; i < sorted.length; i++) {
      const comp = i === 0 ? firstCompound : sorted[i - 1].compound;
      segs.push({
        start,
        end: sorted[i].lap,
        compound: comp,
        color: COMPOUNDS.find((c) => c.value === comp)?.color || "#888",
      });
      start = sorted[i].lap + 1;
    }
    // Final stint
    const lastComp = sorted[sorted.length - 1].compound;
    segs.push({
      start,
      end: totalLaps,
      compound: lastComp,
      color: COMPOUNDS.find((c) => c.value === lastComp)?.color || "#888",
    });
    return segs;
  })();

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-f1-border-solid">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-display font-bold uppercase tracking-[0.2em] text-f1-text-dim">
            Strategy Simulator
          </h2>
          <span className="text-[9px] font-mono text-f1-text-muted">
            {stops.length} stop{stops.length > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Driver selector */}
        <div>
          <label className="text-[10px] uppercase tracking-wider block mb-1 font-display font-bold text-f1-text-dim">Driver</label>
          <select
            value={driver}
            onChange={(e) => setDriver(e.target.value)}
            className="w-full text-xs px-2 py-1.5 rounded-lg border font-mono bg-f1-surface/50 border-f1-border-solid text-f1-text"
          >
            <option value="">Select driver...</option>
            {drivers.map((d) => (
              <option key={d.abbreviation} value={d.abbreviation}>{d.abbreviation} — {d.full_name}</option>
            ))}
          </select>
        </div>

        {/* Pit stops */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-wider font-display font-bold text-f1-text-dim">Pit Stops</label>
            {stops.length < 3 && (
              <button
                onClick={addStop}
                className="text-[10px] font-display font-bold uppercase tracking-wider text-f1-red hover:text-f1-red/80 transition-colors"
              >
                + Add Stop
              </button>
            )}
          </div>
          {stops.map((stop, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-f1-border-solid">
              <span className="text-[10px] font-display font-bold text-white/20 w-5 text-center">{idx + 1}</span>
              <div className="flex-1">
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-[9px] text-white/30">Lap</span>
                  <input
                    type="number"
                    min={1}
                    max={totalLaps}
                    value={stop.lap}
                    onChange={(e) => updateStop(idx, "lap", parseInt(e.target.value) || 1)}
                    className="w-14 text-xs px-1.5 py-0.5 rounded border text-center font-mono font-bold bg-f1-surface/50 border-f1-border-solid text-f1-text"
                  />
                </div>
              </div>
              <div className="flex gap-1">
                {COMPOUNDS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => updateStop(idx, "compound", c.value)}
                    className={`w-6 h-6 rounded-full text-[10px] font-black border-2 transition-all ${
                      stop.compound === c.value
                        ? "scale-110 border-white/50"
                        : "border-transparent opacity-40 hover:opacity-70"
                    }`}
                    style={{ background: c.color }}
                    title={c.label}
                  >
                    {c.value[0]}
                  </button>
                ))}
              </div>
              {stops.length > 1 && (
                <button
                  onClick={() => removeStop(idx)}
                  className="text-white/20 hover:text-f1-red text-xs transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Visual Timeline */}
        {showTimeline && (
          <div>
            <label className="text-[10px] uppercase tracking-wider block mb-1.5 font-display font-bold text-f1-text-dim">Strategy Timeline</label>
            <div className="flex rounded-lg overflow-hidden h-6 bg-white/5">
              {stintSegments.map((seg, i) => {
                const width = ((seg.end - seg.start + 1) / totalLaps) * 100;
                return (
                  <div
                    key={i}
                    className="flex items-center justify-center text-[8px] font-mono font-bold text-black/80 relative group border-r border-black/20 last:border-r-0"
                    style={{ width: `${width}%`, background: seg.color }}
                    title={`${seg.compound}: Lap ${seg.start}–${seg.end} (${seg.end - seg.start + 1} laps)`}
                  >
                    {width > 12 && (
                      <span>{seg.compound[0]} L{seg.start}-{seg.end}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[8px] font-mono text-white/20">Lap 1</span>
              <span className="text-[8px] font-mono text-white/20">Lap {totalLaps}</span>
            </div>
          </div>
        )}

        <button
          onClick={handleSimulate}
          disabled={!driver || loading || !session}
          className="w-full text-xs py-2 rounded-lg font-display font-black uppercase tracking-wider transition-all disabled:opacity-30 bg-f1-red text-white hover:brightness-110 active:scale-[0.98]"
        >
          {loading ? "Simulating..." : `Run ${stops.length}-Stop Strategy`}
        </button>

        {error && (
          <p className="text-xs px-2 py-1.5 rounded-lg bg-f1-red/5 text-f1-red">{error}</p>
        )}

        {/* Results */}
        {results.length > 0 && results.map((result, idx) => (
          <div key={idx} className="space-y-2">
            {stops.length > 1 && (
              <div className="text-[10px] font-display font-bold uppercase tracking-wider text-white/30 mt-1">
                Stop {idx + 1} — Lap {stops[idx]?.lap}
              </div>
            )}
            {/* Recommendation badge */}
            {(() => {
              const s = getRecStyle(result.recommendation);
              return (
                <div className={`rounded-lg p-2.5 text-center border ${s.bg} ${s.border}`}>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-base">{s.icon}</span>
                    <span className={`text-xs font-display font-black uppercase tracking-[0.15em] ${s.color}`}>
                      {s.label}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded-lg p-2 border bg-white/[0.02] border-f1-border-solid">
                <span className="text-[10px] uppercase block font-display font-bold tracking-wider text-f1-text-dim">Time Delta</span>
                <span className={`text-xs font-mono font-black ${result.time_delta_vs_no_stop < 0 ? "text-f1-green" : "text-f1-red"}`}>
                  {result.time_delta_vs_no_stop > 0 ? "+" : ""}{result.time_delta_vs_no_stop.toFixed(1)}s
                </span>
              </div>
              <div className="rounded-lg p-2 border bg-white/[0.02] border-f1-border-solid">
                <span className="text-[10px] uppercase block font-display font-bold tracking-wider text-f1-text-dim">Position</span>
                <span className="text-xs font-mono font-black text-f1-text">
                  P{result.current_position} → P{result.projected_position}
                </span>
              </div>
              <div className="rounded-lg p-2 border bg-white/[0.02] border-f1-border-solid">
                <span className="text-[10px] uppercase block font-display font-bold tracking-wider text-f1-text-dim">Old Pace</span>
                <span className="text-xs font-mono font-bold text-f1-text">{result.old_pace_avg.toFixed(3)}s</span>
              </div>
              <div className="rounded-lg p-2 border bg-white/[0.02] border-f1-border-solid">
                <span className="text-[10px] uppercase block font-display font-bold tracking-wider text-f1-text-dim">New Pace</span>
                <span className="text-xs font-mono font-bold text-f1-text">{result.new_pace_base.toFixed(3)}s</span>
              </div>
            </div>

            <p className="text-[10px] leading-relaxed font-body text-f1-text-dim">{result.explanation}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export const StrategySimulator = memo(StrategySimulatorInner);
