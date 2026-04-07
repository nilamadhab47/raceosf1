"use client";

import { useEffect, useMemo, memo } from "react";
import { useF1Store } from "@/store/f1-store";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

const TelemetryChartInner = () => {
  const {
    drivers,
    telemetry1,
    telemetry2,
    selectedDriver1,
    selectedDriver2,
    selectedLap,
    setSelectedDriver,
    setSelectedLap,
    fetchTelemetry,
    session,
  } = useF1Store();

  useEffect(() => {
    if (selectedDriver1 && selectedLap > 0) {
      fetchTelemetry(selectedDriver1, selectedLap, 1);
    }
  }, [selectedDriver1, selectedLap, fetchTelemetry]);

  useEffect(() => {
    if (selectedDriver2 && selectedLap > 0) {
      fetchTelemetry(selectedDriver2, selectedLap, 2);
    }
  }, [selectedDriver2, selectedLap, fetchTelemetry]);

  const speedData = useMemo(() => {
    if (!telemetry1 && !telemetry2) return [];
    const maxLen = Math.max(
      telemetry1?.distance.length || 0,
      telemetry2?.distance.length || 0
    );
    const data = [];
    for (let i = 0; i < maxLen; i++) {
      data.push({
        distance: Math.round(telemetry1?.distance[i] ?? telemetry2?.distance[i] ?? 0),
        [`${selectedDriver1}_speed`]: telemetry1?.speed[i] ?? null,
        [`${selectedDriver2}_speed`]: telemetry2?.speed[i] ?? null,
        [`${selectedDriver1}_throttle`]: telemetry1?.throttle[i] ?? null,
        [`${selectedDriver2}_throttle`]: telemetry2?.throttle[i] ?? null,
        [`${selectedDriver1}_brake`]: telemetry1?.brake[i] ?? null,
        [`${selectedDriver2}_brake`]: telemetry2?.brake[i] ?? null,
      });
    }
    return data;
  }, [telemetry1, telemetry2, selectedDriver1, selectedDriver2]);

  const driver1Color = drivers.find((d) => d.abbreviation === selectedDriver1)?.team_color || "#00ff88";
  const driver2Color = drivers.find((d) => d.abbreviation === selectedDriver2)?.team_color || "#a855f7";

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="glass-panel rounded-lg px-3 py-2 text-[10px] border" style={{ borderColor: "var(--f1-border-glow)" }}>
        <p className="font-mono mb-1" style={{ color: "var(--f1-text-dim)" }}>Dist: {label}m</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.stroke }} className="font-mono">
            {p.name}: <span className="font-bold">{Math.round(p.value)}</span>
          </p>
        ))}
      </div>
    );
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: "var(--f1-text-dim)" }}>
        <div className="text-center space-y-3">
          <div className="text-4xl">📊</div>
          <p className="text-sm">Load a session to view telemetry</p>
        </div>
      </div>
    );
  }

  const noData = speedData.length === 0;

  return (
    <div className="h-full flex flex-col">
      {/* Controls bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b" style={{ borderColor: "var(--f1-border)" }}>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: driver1Color, boxShadow: `0 0 6px ${driver1Color}60` }} />
          <select
            value={selectedDriver1}
            onChange={(e) => setSelectedDriver(1, e.target.value)}
            className="text-[11px] px-2 py-1 rounded-md border font-medium"
            style={{ background: "var(--f1-surface-glass)", borderColor: "var(--f1-border)", color: "var(--f1-text)" }}
          >
            {drivers.map((d) => (
              <option key={d.abbreviation} value={d.abbreviation}>{d.abbreviation}</option>
            ))}
          </select>
        </div>

        <span className="text-[10px] font-bold" style={{ color: "var(--f1-text-dim)" }}>VS</span>

        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: driver2Color, boxShadow: `0 0 6px ${driver2Color}60` }} />
          <select
            value={selectedDriver2}
            onChange={(e) => setSelectedDriver(2, e.target.value)}
            className="text-[11px] px-2 py-1 rounded-md border font-medium"
            style={{ background: "var(--f1-surface-glass)", borderColor: "var(--f1-border)", color: "var(--f1-text)" }}
          >
            {drivers.map((d) => (
              <option key={d.abbreviation} value={d.abbreviation}>{d.abbreviation}</option>
            ))}
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--f1-text-dim)" }}>Lap</span>
          <input
            type="number"
            min={1}
            max={session?.total_laps || 70}
            value={selectedLap}
            onChange={(e) => setSelectedLap(parseInt(e.target.value) || 1)}
            className="w-14 text-[11px] px-2 py-1 rounded-md border text-center font-mono font-bold"
            style={{ background: "var(--f1-surface-glass)", borderColor: "var(--f1-border)", color: "var(--f1-text)" }}
          />
        </div>
      </div>

      {/* Charts */}
      {noData ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="space-y-2 w-full px-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-28 rounded-lg" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-rows-3 gap-0 min-h-0">
          {/* Speed Chart */}
          <div className="px-2 pt-2 relative">
            <div className="flex items-center gap-2 px-2 mb-1">
              <h3 className="text-[10px] uppercase tracking-[0.15em] font-bold" style={{ color: "var(--f1-text-dim)" }}>
                Speed
              </h3>
              <span className="text-[8px] font-mono" style={{ color: "var(--f1-text-dim)" }}>km/h</span>
            </div>
            <ResponsiveContainer width="100%" height="88%">
              <AreaChart data={speedData}>
                <defs>
                  <linearGradient id="speedGrad1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={driver1Color} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={driver1Color} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="speedGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={driver2Color} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={driver2Color} stopOpacity={0} />
                  </linearGradient>
                  <filter id="glow1">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="distance" tick={{ fontSize: 8, fill: "#666" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 8, fill: "#666" }} domain={[0, 370]} axisLine={false} tickLine={false} width={30} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey={`${selectedDriver1}_speed`}
                  stroke={driver1Color}
                  fill="url(#speedGrad1)"
                  strokeWidth={2}
                  dot={false}
                  name={selectedDriver1}
                  filter="url(#glow1)"
                />
                <Area
                  type="monotone"
                  dataKey={`${selectedDriver2}_speed`}
                  stroke={driver2Color}
                  fill="url(#speedGrad2)"
                  strokeWidth={2}
                  dot={false}
                  name={selectedDriver2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Throttle Chart */}
          <div className="px-2 pt-1">
            <div className="flex items-center gap-2 px-2 mb-1">
              <h3 className="text-[10px] uppercase tracking-[0.15em] font-bold" style={{ color: "var(--f1-text-dim)" }}>
                Throttle
              </h3>
              <span className="text-[8px] font-mono" style={{ color: "var(--f1-text-dim)" }}>%</span>
            </div>
            <ResponsiveContainer width="100%" height="88%">
              <AreaChart data={speedData}>
                <defs>
                  <linearGradient id="throttleGrad1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={driver1Color} stopOpacity={0.12} />
                    <stop offset="100%" stopColor={driver1Color} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="throttleGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={driver2Color} stopOpacity={0.12} />
                    <stop offset="100%" stopColor={driver2Color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="distance" tick={{ fontSize: 8, fill: "#666" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 8, fill: "#666" }} domain={[0, 105]} axisLine={false} tickLine={false} width={30} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey={`${selectedDriver1}_throttle`}
                  stroke={driver1Color}
                  fill="url(#throttleGrad1)"
                  strokeWidth={1.5}
                  dot={false}
                  name={selectedDriver1}
                />
                <Area
                  type="monotone"
                  dataKey={`${selectedDriver2}_throttle`}
                  stroke={driver2Color}
                  fill="url(#throttleGrad2)"
                  strokeWidth={1.5}
                  dot={false}
                  name={selectedDriver2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Brake Chart */}
          <div className="px-2 pt-1">
            <div className="flex items-center gap-2 px-2 mb-1">
              <h3 className="text-[10px] uppercase tracking-[0.15em] font-bold" style={{ color: "var(--f1-text-dim)" }}>
                Brake
              </h3>
            </div>
            <ResponsiveContainer width="100%" height="88%">
              <AreaChart data={speedData}>
                <defs>
                  <linearGradient id="brakeGrad1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={driver1Color} stopOpacity={0.12} />
                    <stop offset="100%" stopColor={driver1Color} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="brakeGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={driver2Color} stopOpacity={0.12} />
                    <stop offset="100%" stopColor={driver2Color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="distance" tick={{ fontSize: 8, fill: "#666" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 8, fill: "#666" }} domain={[0, 105]} axisLine={false} tickLine={false} width={30} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey={`${selectedDriver1}_brake`}
                  stroke={driver1Color}
                  fill="url(#brakeGrad1)"
                  strokeWidth={1.5}
                  dot={false}
                  name={selectedDriver1}
                />
                <Area
                  type="monotone"
                  dataKey={`${selectedDriver2}_brake`}
                  stroke={driver2Color}
                  fill="url(#brakeGrad2)"
                  strokeWidth={1.5}
                  dot={false}
                  name={selectedDriver2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Driver legend bar */}
      {!noData && (
        <div className="flex items-center justify-center gap-6 py-2 border-t" style={{ borderColor: "var(--f1-border)" }}>
          <div className="flex items-center gap-2">
            <div className="w-4 h-[2px] rounded-full" style={{ background: driver1Color, boxShadow: `0 0 4px ${driver1Color}` }} />
            <span className="text-[10px] font-bold">{selectedDriver1}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-[2px] rounded-full" style={{ background: driver2Color, boxShadow: `0 0 4px ${driver2Color}` }} />
            <span className="text-[10px] font-bold">{selectedDriver2}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export const TelemetryChart = memo(TelemetryChartInner);
