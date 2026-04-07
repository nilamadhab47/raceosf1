"use client";

import { useEffect, useState } from "react";
import { useF1Store } from "@/store/f1-store";
import { api } from "@/lib/api";
import type { GapEvolutionData } from "@/lib/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TrendingUp } from "lucide-react";

export function GapEvolutionChart() {
  const session = useF1Store((s) => s.session);
  const selectedLap = useF1Store((s) => s.selectedLap);
  const [data, setData] = useState<GapEvolutionData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    api
      .getGapEvolution(5)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (!data || data.drivers.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-3 py-2 border-b border-f1-border flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-f1-text-dim" />
          <span className="text-[13px] font-display uppercase tracking-wider text-f1-text-dim">
            Gap Evolution
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center text-[13px] text-f1-text-dim font-body">
          {loading ? "Loading gap data..." : "No gap data"}
        </div>
      </div>
    );
  }

  // Transform to recharts format: [{lap: 1, VER: 0, NOR: 1.2, ...}, ...]
  const chartData = data.laps.map((lap, i) => {
    const point: Record<string, number | null> = { lap };
    for (const d of data.drivers) {
      point[d.driver] = d.gaps[i];
    }
    return point;
  });

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-f1-border flex items-center gap-2">
        <TrendingUp className="w-3.5 h-3.5 text-f1-text-dim" />
        <span className="text-[13px] font-display uppercase tracking-wider text-f1-text-dim">
          Gap to Leader
        </span>
        <div className="ml-auto flex items-center gap-2">
          {data.drivers.map((d) => (
            <div key={d.driver} className="flex items-center gap-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: `#${d.team_color.replace("#", "")}` }}
              />
              <span className="text-[13px] font-mono text-white/50">
                {d.driver}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 px-1 py-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
          >
            <XAxis
              dataKey="lap"
              tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
              tickLine={false}
              axisLine={false}
              width={32}
              tickFormatter={(v: number) => `${v}s`}
            />
            <Tooltip
              contentStyle={{
                background: "#111111",
                border: "1px solid #1F1F1F",
                borderRadius: 8,
                fontSize: 10,
                fontFamily: "var(--font-mono)",
              }}
              labelFormatter={(l) => `Lap ${l}`}
              formatter={(value: number, name: string) => {
                const drv = data.drivers.find((d) => d.driver === name);
                return [
                  `${value != null ? `+${value.toFixed(3)}s` : "—"}`,
                  drv?.full_name ?? name,
                ];
              }}
            />
            {selectedLap > 0 && (
              <ReferenceLine
                x={selectedLap}
                stroke="rgba(225,6,0,0.3)"
                strokeDasharray="3 3"
              />
            )}
            {data.drivers.map((d) => (
              <Line
                key={d.driver}
                type="monotone"
                dataKey={d.driver}
                stroke={`#${d.team_color.replace("#", "")}`}
                strokeWidth={1.5}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
