"use client";

import { useEffect, useState, memo } from "react";
import { api } from "@/lib/api";
import { useF1Store } from "@/store/f1-store";
import type { DriverStints } from "@/lib/types";

const COMPOUND_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  SOFT:       { bg: "bg-red-500",    text: "text-red-500",    label: "S" },
  MEDIUM:     { bg: "bg-yellow-400", text: "text-yellow-400", label: "M" },
  HARD:       { bg: "bg-white",      text: "text-white",      label: "H" },
  INTERMEDIATE: { bg: "bg-green-400", text: "text-green-400", label: "I" },
  WET:        { bg: "bg-blue-400",   text: "text-blue-400",   label: "W" },
  UNKNOWN:    { bg: "bg-gray-500",   text: "text-gray-500",   label: "?" },
};

const StintBarInner = () => {
  const session = useF1Store((s) => s.session);
  const [data, setData] = useState<DriverStints[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    api.getStints()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  if (!session) return null;

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-f1-border-solid flex items-center justify-between">
        <h2 className="text-[13px] font-display font-bold uppercase tracking-[0.2em] text-f1-text-dim">
          Tyre Strategy
        </h2>
        {/* Legend */}
        <div className="flex items-center gap-2">
          {["SOFT", "MEDIUM", "HARD"].map((c) => {
            const cc = COMPOUND_COLORS[c];
            return (
              <div key={c} className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${cc.bg}`} />
                <span className="text-[7px] font-mono text-f1-text-muted">{c[0]}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 rounded-full border-2 border-t-transparent border-f1-purple animate-spin" />
          </div>
        )}

        {!loading && data.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-[13px] font-body text-f1-text-muted">No stint data</p>
          </div>
        )}

        {data.slice(0, 20).map((d) => {
          const totalLaps = d.total_laps || 1;
          return (
            <div key={d.driver} className="flex items-center gap-2 group">
              {/* Driver label */}
              <div className="w-12 flex items-center gap-1 shrink-0">
                <span className="text-[13px] font-mono font-bold text-f1-text-dim">P{d.position}</span>
                <span
                  className="text-[13px] font-mono font-bold"
                  style={{ color: d.team_color }}
                >
                  {d.driver}
                </span>
              </div>

              {/* Stint bar */}
              <div className="flex-1 flex h-4 rounded-sm overflow-hidden border border-f1-border-solid/30 bg-f1-surface/30">
                {d.stints.map((stint, i) => {
                  const width = (stint.laps / totalLaps) * 100;
                  const cc = COMPOUND_COLORS[stint.compound] || COMPOUND_COLORS.UNKNOWN;
                  return (
                    <div
                      key={i}
                      className={`relative flex items-center justify-center ${cc.bg} opacity-80 hover:opacity-100 transition-opacity`}
                      style={{ width: `${width}%`, minWidth: width > 3 ? undefined : "4px" }}
                      title={`Stint ${stint.stint}: ${stint.compound} — Laps ${stint.start_lap}–${stint.end_lap} (${stint.laps} laps)`}
                    >
                      {width > 8 && (
                        <span className="text-[7px] font-mono font-black text-black/70 leading-none">
                          {cc.label}{stint.laps}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Total laps */}
              <span className="text-[7px] font-mono text-f1-text-muted w-6 text-right shrink-0">
                {d.stints.reduce((s, st) => s + st.laps, 0)}L
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const StintBar = memo(StintBarInner);
