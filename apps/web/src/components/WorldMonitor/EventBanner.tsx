"use client";

/**
 * EventBanner — floating broadcast-style event overlay on the track canvas.
 *
 * Shows active events with slide-in/out animation.
 * Severity-colored left border: red=incident, orange=battle, green=overtake, purple=FL.
 */

import { useEffect, useState } from "react";
import { useEventEngine, type RaceEvent, type RaceEventType } from "@/engines/EventEngine";

/* ── Style config ─────────────────────────────────────────────────── */

const EVENT_COLORS: Record<RaceEventType, string> = {
  incident: "#E10600",
  battle: "#FFD000",
  overtake: "#00D2BE",
  fastest_lap: "#6C2BFF",
  pit_stop: "#00D2BE",
};

const EVENT_ICONS: Record<RaceEventType, string> = {
  incident: "⚠",
  battle: "⚔",
  overtake: "🏎",
  fastest_lap: "⏱",
  pit_stop: "🔧",
};

const EVENT_LABELS: Record<RaceEventType, string> = {
  incident: "INCIDENT",
  battle: "BATTLE",
  overtake: "OVERTAKE",
  fastest_lap: "FASTEST LAP",
  pit_stop: "PIT STOP",
};

/* ── Component ────────────────────────────────────────────────────── */

export function EventBanner() {
  const activeEvents = useEventEngine((s) => s.activeEvents);
  const [displayed, setDisplayed] = useState<RaceEvent | null>(null);
  const [visible, setVisible] = useState(false);

  // Pick highest-priority active event to display
  useEffect(() => {
    if (activeEvents.length === 0) {
      // Fade out
      setVisible(false);
      const timer = setTimeout(() => setDisplayed(null), 400);
      return () => clearTimeout(timer);
    }

    const priorityOrder: RaceEventType[] = ["incident", "battle", "overtake", "fastest_lap", "pit_stop"];
    const sorted = [...activeEvents].sort(
      (a, b) => priorityOrder.indexOf(a.type) - priorityOrder.indexOf(b.type),
    );
    const best = sorted[0];

    // Only switch if different event
    if (!displayed || displayed.id !== best.id) {
      setVisible(false);
      const timer = setTimeout(() => {
        setDisplayed(best);
        setVisible(true);
      }, displayed ? 300 : 0);
      return () => clearTimeout(timer);
    }
  }, [activeEvents, displayed]);

  if (!displayed) return null;

  const color = EVENT_COLORS[displayed.type] || "#fff";
  const icon = EVENT_ICONS[displayed.type] || "📡";
  const label = EVENT_LABELS[displayed.type] || displayed.type.toUpperCase();

  return (
    <div
      className="absolute top-12 left-1/2 z-20 pointer-events-none"
      style={{
        transform: `translateX(-50%) translateY(${visible ? "0" : "-20px"})`,
        opacity: visible ? 1 : 0,
        transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div
        className="flex items-center gap-2.5 px-4 py-2 rounded-lg"
        style={{
          background: "#111111",
          borderLeft: `3px solid ${color}`,
          boxShadow: `0 0 12px ${color}33, 0 4px 12px rgba(0,0,0,0.5)`,
        }}
      >
        {/* Type badge */}
        <div
          className="flex items-center gap-1.5 px-2 py-0.5 rounded"
          style={{ background: `${color}20` }}
        >
          <span className="text-sm">{icon}</span>
          <span
            className="text-[10px] font-display font-bold uppercase tracking-[0.15em]"
            style={{ color }}
          >
            {label}
          </span>
        </div>

        {/* Message */}
        <span className="text-[11px] font-mono font-semibold text-white/90 whitespace-nowrap">
          {displayed.message}
        </span>

        {/* Lap tag */}
        <span className="text-[9px] font-mono text-white/30 ml-1">
          L{displayed.lap}
        </span>
      </div>
    </div>
  );
}
