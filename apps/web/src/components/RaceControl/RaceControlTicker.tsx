"use client";

import { memo } from "react";
import { useF1Store } from "@/store/f1-store";
import type { FlagMode } from "@/lib/types";

interface DisplayMessage {
  type: "flag" | "penalty" | "pit" | "incident" | "info";
  message: string;
  time?: string;
}

const flagColors: Record<string, string> = {
  flag: "text-f1-amber",
  penalty: "text-f1-red",
  pit: "text-f1-cyan",
  incident: "text-f1-red",
  info: "text-f1-text-dim",
};

const flagIcons: Record<string, string> = {
  flag: "🏁",
  penalty: "⚠️",
  pit: "🔧",
  incident: "🚨",
  info: "ℹ️",
};

const FLAG_BADGE: Record<FlagMode, { label: string; color: string } | null> = {
  green: { label: "GREEN", color: "bg-f1-green/15 text-f1-green border-f1-green/30" },
  yellow: { label: "YELLOW", color: "bg-f1-amber/15 text-f1-amber border-f1-amber/30" },
  sc: { label: "SAFETY CAR", color: "bg-f1-amber/20 text-f1-amber border-f1-amber/40 animate-pulse" },
  vsc: { label: "VSC", color: "bg-f1-amber/15 text-f1-amber border-f1-amber/30 animate-pulse" },
  red: { label: "RED FLAG", color: "bg-f1-red/20 text-f1-red border-f1-red/40 animate-pulse" },
  chequered: { label: "FINISHED", color: "bg-white/10 text-white border-white/20" },
};

const RaceControlTickerInner = () => {
  const { liveState, insights, flagMode, raceControlMessages } = useF1Store();

  // Use WebSocket race control messages if available, otherwise derive from insights
  const messages: DisplayMessage[] = raceControlMessages.length > 0
    ? raceControlMessages.slice(0, 8).map((rc) => ({
        type: rc.category === "Flag" || rc.category === "SafetyCar" ? "flag" as const
          : rc.category === "Drs" ? "info" as const : "info" as const,
        message: rc.message,
        time: rc.lap > 0 ? `L${rc.lap}` : rc.time || undefined,
      }))
    : insights.slice(0, 6).map((insight) => ({
        type: insight.severity === "alert" ? "incident" as const : insight.severity === "warning" ? "flag" as const : "info" as const,
        message: insight.message,
        time: insight.lap > 0 ? `L${insight.lap}` : undefined,
      }));

  const badge = FLAG_BADGE[flagMode];

  if (messages.length === 0 && !liveState?.is_running) return null;

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-f1-border-solid flex items-center justify-between">
        <h2 className="text-[13px] font-display font-bold uppercase tracking-[0.2em] text-f1-text-dim">
          Race Control
        </h2>
        <div className="flex items-center gap-2">
          {badge && (
            <span className={`text-[13px] px-1.5 py-0.5 rounded border font-display font-black tracking-wider ${badge.color}`}>
              {badge.label}
            </span>
          )}
          {liveState?.is_running && (
            <div className="w-1.5 h-1.5 rounded-full bg-f1-red animate-live-pulse" />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[13px] font-body text-f1-text-muted">No messages</p>
          </div>
        ) : (
          <div className="divide-y divide-f1-border-solid/30">
            {messages.map((msg, i) => (
              <div key={i} className="flex items-start gap-2 px-4 py-2 hover:bg-white/[0.02] transition-colors">
                <span className="text-[13px] shrink-0">{flagIcons[msg.type]}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] leading-relaxed font-body ${flagColors[msg.type]}`}>
                    {msg.message}
                  </p>
                </div>
                {msg.time && (
                  <span className="text-[13px] font-mono text-f1-text-muted shrink-0">{msg.time}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const RaceControlTicker = memo(RaceControlTickerInner);
