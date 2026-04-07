"use client";

import { useEffect, useState } from "react";
import { useF1Store } from "@/store/f1-store";
import { api } from "@/lib/api";
import type { DriverStints, LapData } from "@/lib/types";
import { X, Clock, Fuel, TrendingDown, Trophy, Hash, Flag, MapPin, Building2, Wrench } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatLapTime, getCompoundClass } from "@/lib/utils";
import { getDriverMeta, getTeamMeta } from "@/lib/driverData";

export function DriverFocusModal() {
  const focusedDriver = useF1Store((s) => s.focusedDriver);
  const setFocusedDriver = useF1Store((s) => s.setFocusedDriver);
  const leaderboard = useF1Store((s) => s.leaderboard);
  const session = useF1Store((s) => s.session);

  const [lapTimes, setLapTimes] = useState<LapData[]>([]);
  const [stintData, setStintData] = useState<DriverStints | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"performance" | "profile">("performance");

  const entry = leaderboard.find((e) => e.driver === focusedDriver);
  const driverMeta = focusedDriver ? getDriverMeta(focusedDriver) : null;
  const teamMeta = entry ? getTeamMeta(entry.team) : null;

  // Fetch driver lap times and stints when modal opens
  useEffect(() => {
    if (!focusedDriver || !session) return;
    let cancelled = false;
    setLoading(true);
    setActiveTab("performance");

    Promise.all([
      api.getLaps(focusedDriver).catch(() => []),
      api.getStints().catch(() => []),
    ]).then(([laps, stints]) => {
      if (cancelled) return;
      setLapTimes(laps);
      const driverStint = stints.find(
        (s: DriverStints) => s.driver === focusedDriver
      );
      setStintData(driverStint ?? null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [focusedDriver, session]);

  if (!focusedDriver || !entry) return null;

  // Chart data — lap times in seconds
  const chartData = lapTimes
    .filter((l) => l.lap_time != null)
    .map((l) => ({
      lap: l.lap_number,
      time: l.lap_time!,
    }));

  const avgTime =
    chartData.length > 0
      ? chartData.reduce((s, d) => s + d.time, 0) / chartData.length
      : 0;

  const bestTime =
    chartData.length > 0 ? Math.min(...chartData.map((d) => d.time)) : 0;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={() => setFocusedDriver(null)}
    >
      <div
        className="bg-f1-surface border border-white/10 rounded-xl w-[600px] max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Header with Driver Photo ─── */}
        <div
          className="relative overflow-hidden rounded-t-xl"
          style={{
            background: `linear-gradient(135deg, ${entry.team_color}25, ${entry.team_color}08, transparent)`,
          }}
        >
          <div className="flex items-start gap-4 p-4">
            {/* Driver photo */}
            <div className="relative shrink-0">
              <div
                className="w-20 h-20 rounded-full overflow-hidden border-2 bg-f1-surface-2"
                style={{ borderColor: entry.team_color }}
              >
                {driverMeta ? (
                  <img
                    src={driverMeta.photoUrl}
                    alt={entry.full_name}
                    className="w-full h-full object-cover object-top"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-display font-black text-white/30">
                    {entry.driver}
                  </div>
                )}
              </div>
              {driverMeta && (
                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-f1-surface border border-white/10 flex items-center justify-center text-sm">
                  {driverMeta.country_flag}
                </div>
              )}
            </div>

            {/* Driver info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xl font-display font-black text-white truncate">
                  {entry.full_name}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/50 mb-1.5">
                <span className="font-mono font-bold" style={{ color: entry.team_color }}>{entry.driver}</span>
                <span>·</span>
                <span>{entry.team}</span>
                {driverMeta && (
                  <>
                    <span>·</span>
                    <span>{driverMeta.nationality} {driverMeta.country_flag}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                {driverMeta && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 border border-white/5">
                    <Hash className="w-3 h-3 text-white/30" />
                    <span className="text-xs font-mono font-bold text-white/70">{driverMeta.number}</span>
                  </div>
                )}
                <div
                  className="flex items-center gap-1 px-2 py-0.5 rounded border"
                  style={{ background: `${entry.team_color}15`, borderColor: `${entry.team_color}30` }}
                >
                  <Trophy className="w-3 h-3" style={{ color: entry.team_color }} />
                  <span className="text-xs font-display font-bold" style={{ color: entry.team_color }}>
                    P{entry.position}
                  </span>
                </div>
                {entry.compound && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 border border-white/5">
                    <div className={`w-3 h-3 rounded-full ${getCompoundClass(entry.compound)}`} />
                    <span className="text-xs font-mono text-white/70">{entry.compound} L{entry.tyre_life ?? 0}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={() => setFocusedDriver(null)}
              className="text-white/30 hover:text-white transition-colors p-1 rounded hover:bg-white/5"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Team color accent line */}
          <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${entry.team_color}, transparent)` }} />
        </div>

        {/* ─── Tabs ─── */}
        <div className="flex border-b border-white/5">
          <button
            onClick={() => setActiveTab("performance")}
            className={`flex-1 px-4 py-2 text-xs font-display font-bold uppercase tracking-wider transition-colors ${
              activeTab === "performance"
                ? "text-white border-b-2 border-f1-purple"
                : "text-white/30 hover:text-white/50"
            }`}
          >
            Performance
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex-1 px-4 py-2 text-xs font-display font-bold uppercase tracking-wider transition-colors ${
              activeTab === "profile"
                ? "text-white border-b-2 border-f1-purple"
                : "text-white/30 hover:text-white/50"
            }`}
          >
            Driver & Team
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-f1-text-dim">
            Loading driver data...
          </div>
        ) : activeTab === "performance" ? (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-4 gap-px bg-white/5">
              <StatBox
                icon={<Clock className="w-3.5 h-3.5" />}
                label="Last Lap"
                value={formatLapTime(entry.last_lap_time ?? 0)}
              />
              <StatBox
                icon={<TrendingDown className="w-3.5 h-3.5" />}
                label="Best Lap"
                value={bestTime > 0 ? formatLapTime(bestTime) : "—"}
              />
              <StatBox
                icon={<Clock className="w-3.5 h-3.5" />}
                label="Avg Pace"
                value={avgTime > 0 ? formatLapTime(avgTime) : "—"}
              />
              <StatBox
                icon={<Fuel className="w-3.5 h-3.5" />}
                label="Tyre"
                value={`${entry.compound ?? "?"} L${entry.tyre_life ?? 0}`}
              />
            </div>

            {/* Lap time chart */}
            {chartData.length > 0 && (
              <div className="p-3 border-b border-white/5">
                <div className="text-xs font-display uppercase tracking-wider text-f1-text-dim mb-2">
                  Lap Time Trend
                </div>
                <div className="h-32">
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
                      />
                      <YAxis
                        domain={["dataMin - 1", "dataMax + 1"]}
                        tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }}
                        tickLine={false}
                        axisLine={false}
                        width={40}
                        tickFormatter={(v: number) => formatLapTime(v)}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(15,15,25,0.95)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 8,
                          fontSize: 10,
                          fontFamily: "var(--font-mono)",
                        }}
                        labelFormatter={(l) => `Lap ${l}`}
                        formatter={(v: number) => [formatLapTime(v), "Lap Time"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="time"
                        stroke={entry.team_color}
                        strokeWidth={1.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Stints */}
            {stintData && stintData.stints.length > 0 && (
              <div className="p-3">
                <div className="text-xs font-display uppercase tracking-wider text-f1-text-dim mb-2">
                  Tyre Stints
                </div>
                <div className="space-y-1">
                  {stintData.stints.map((s) => (
                    <div
                      key={s.stint}
                      className="flex items-center gap-2 text-xs"
                    >
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${getCompoundClass(s.compound)}`}
                      >
                        {s.compound[0]}
                      </div>
                      <span className="font-mono text-white/60 w-20">
                        Lap {s.start_lap}–{s.end_lap}
                      </span>
                      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full opacity-60"
                          style={{
                            width: `${(s.laps / stintData.total_laps) * 100}%`,
                            backgroundColor: entry.team_color,
                          }}
                        />
                      </div>
                      <span className="font-mono text-white/40 w-10 text-right">
                        {s.laps}L
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* ─── Profile Tab ─── */
          <div className="p-4 space-y-4">
            {/* Driver Info */}
            {driverMeta && (
              <div>
                <div className="text-xs font-display uppercase tracking-wider text-f1-text-dim mb-2">
                  Driver Profile
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <ProfileRow icon={<Flag className="w-3.5 h-3.5" />} label="Nationality" value={`${driverMeta.nationality} ${driverMeta.country_flag}`} />
                  <ProfileRow icon={<Hash className="w-3.5 h-3.5" />} label="Number" value={`#${driverMeta.number}`} />
                  <ProfileRow icon={<Clock className="w-3.5 h-3.5" />} label="Date of Birth" value={driverMeta.dob} />
                  <ProfileRow icon={<Trophy className="w-3.5 h-3.5" />} label="Position" value={`P${entry.position}`} />
                </div>
              </div>
            )}

            {/* Team Info */}
            {teamMeta && (
              <div>
                <div className="text-xs font-display uppercase tracking-wider text-f1-text-dim mb-2">
                  Team Information
                </div>
                <div
                  className="rounded-lg border p-3 space-y-2"
                  style={{ background: `${entry.team_color}08`, borderColor: `${entry.team_color}20` }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: entry.team_color }} />
                    <span className="text-sm font-display font-bold text-white">{teamMeta.fullName}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <ProfileRow icon={<Building2 className="w-3.5 h-3.5" />} label="Base" value={teamMeta.base} />
                    <ProfileRow icon={<Wrench className="w-3.5 h-3.5" />} label="Power Unit" value={teamMeta.engine} />
                    <ProfileRow icon={<Trophy className="w-3.5 h-3.5" />} label="Team Principal" value={teamMeta.principal} />
                    <ProfileRow icon={<Flag className="w-3.5 h-3.5" />} label="Championships" value={String(teamMeta.championships)} />
                  </div>
                </div>
              </div>
            )}

            {!driverMeta && !teamMeta && (
              <div className="text-center py-6 text-xs text-white/30">
                No additional profile data available for {focusedDriver}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="p-3 text-center">
      <div className="flex items-center justify-center gap-1 text-f1-cyan mb-1">
        {icon}
        <span className="text-[10px] font-display uppercase tracking-wider text-white/30">
          {label}
        </span>
      </div>
      <div className="text-xs font-mono font-bold text-white/80">
        {value}
      </div>
    </div>
  );
}

function ProfileRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/[0.02] border border-white/5">
      <div className="text-white/20">{icon}</div>
      <div className="min-w-0">
        <div className="text-[9px] font-display uppercase tracking-wider text-white/25">{label}</div>
        <div className="text-xs font-mono text-white/70 truncate">{value}</div>
      </div>
    </div>
  );
}
