"use client";

import { useEffect, useState } from "react";
import { useF1Store } from "@/store/f1-store";
import { api } from "@/lib/api";
import type { LapData } from "@/lib/types";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { formatLapTime } from "@/lib/utils";

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: "#ff3366",
  MEDIUM: "#ffaa00",
  HARD: "#e0e0e0",
  INTERMEDIATE: "#00cc66",
  WET: "#3399ff",
};

interface ChartPoint {
  lap: number;
  time: number;
  compound: string;
  driver: string;
}

export function LapTimeDistribution() {
  const session = useF1Store((s) => s.session);
  const leaderboard = useF1Store((s) => s.leaderboard);
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch lap times for top 5 drivers
  useEffect(() => {
    if (!session || leaderboard.length === 0) return;
    let cancelled = false;
    setLoading(true);

    const top5 = leaderboard.slice(0, 5).map((e) => e.driver);

    Promise.all(top5.map((drv) => api.getLaps(drv).catch(() => [])))
      .then((results) => {
        if (cancelled) return;
        const allPoints: ChartPoint[] = [];
        results.forEach((laps: LapData[]) => {
          laps.forEach((l) => {
            if (
              l.lap_time != null &&
              l.lap_time > 0 &&
              !l.is_pit_in_lap &&
              !l.is_pit_out_lap
            ) {
              allPoints.push({
                lap: l.lap_number,
                time: l.lap_time,
                compound: l.compound ?? "UNKNOWN",
                driver: l.driver,
              });
            }
          });
        });
        setPoints(allPoints);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session, leaderboard.length > 0 ? leaderboard[0].driver : ""]);

  if (points.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-3 py-2 border-b border-f1-border flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-f1-text-dim" />
          <span className="text-[13px] font-display uppercase tracking-wider text-f1-text-dim">
            Lap Time Distribution
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center text-[13px] text-f1-text-dim font-body">
          {loading ? "Loading lap data..." : "No lap data"}
        </div>
      </div>
    );
  }

  // Compound legend
  const usedCompounds = [...new Set(points.map((p) => p.compound))];

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-f1-border flex items-center gap-2 shrink-0">
        <BarChart3 className="w-3.5 h-3.5 text-f1-text-dim" />
        <span className="text-[13px] font-display uppercase tracking-wider text-f1-text-dim">
          Lap Times
        </span>
        <div className="ml-auto flex items-center gap-2">
          {usedCompounds.map((c) => (
            <div key={c} className="flex items-center gap-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: COMPOUND_COLORS[c] ?? "#666",
                }}
              />
              <span className="text-[13px] font-mono text-white/40">{c[0]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 px-1 py-1">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <XAxis
              dataKey="lap"
              type="number"
              tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
              name="Lap"
            />
            <YAxis
              dataKey="time"
              type="number"
              domain={["dataMin - 1", "dataMax + 1"]}
              tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={(v: number) => formatLapTime(v)}
              name="Time"
            />
            <Tooltip
              contentStyle={{
                background: "rgba(15,15,25,0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                fontSize: 10,
                fontFamily: "var(--font-mono)",
              }}
              formatter={(value: number, name: string) => {
                if (name === "time") return [formatLapTime(value), "Lap Time"];
                return [value, name];
              }}
              labelFormatter={() => ""}
            />
            <Scatter data={points} fill="#fff">
              {points.map((p, i) => (
                <Cell
                  key={i}
                  fill={COMPOUND_COLORS[p.compound] ?? "#666"}
                  fillOpacity={0.6}
                  r={2}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
