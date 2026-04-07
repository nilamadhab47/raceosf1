"use client";

/**
 * ReplayPanel — event timeline scrubber with clip playback controls.
 *
 * Features:
 *   - Event timeline with colored markers
 *   - Speed controls (0.25x–2x)
 *   - Clickable event list → plays event clip
 *   - Camera mode selector
 *   - Share clip button per event
 */

import { useCallback, useMemo, useState } from "react";
import { useEventEngine, type RaceEvent, type RaceEventType } from "@/engines/EventEngine";
import { useReplayEngine, REPLAY_SPEED_OPTIONS } from "@/engines/ReplayEngine";
import { useTimeline } from "@/engines/Timeline";
import { Play, Pause, Share2, Repeat } from "lucide-react";

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



/* ── Component ────────────────────────────────────────────────────── */

export function ReplayPanel() {
  const events = useEventEngine((s) => s.events);
  const { isReplayMode, activeClip, activeEvent, replaySpeed, openEvent, closeEvent, setReplaySpeed } =
    useReplayEngine();
  const { totalLaps, raceProgress } = useTimeline();
  const [filter, setFilter] = useState<RaceEventType | "all">("all");

  const filteredEvents = useMemo(() => {
    if (filter === "all") return events;
    return events.filter((e) => e.type === filter);
  }, [events, filter]);

  // Latest 20, reversed (newest first)
  const displayEvents = useMemo(
    () => [...filteredEvents].reverse().slice(0, 20),
    [filteredEvents],
  );

  const onPlayClip = useCallback(
    (event: RaceEvent) => {
      if (activeEvent?.id === event.id) {
        closeEvent();
      } else {
        openEvent(event);
      }
    },
    [openEvent, closeEvent, activeEvent],
  );

  const onStop = useCallback(() => {
    closeEvent();
  }, [closeEvent]);

  const onShareClip = useCallback((event: RaceEvent) => {
    const params = new URLSearchParams({
      clip: `${event.type}_${event.drivers.join("-")}_${event.lap}`,
      speed: String(replaySpeed),
    });
    const url = `${window.location.origin}${window.location.pathname}?${params}`;
    navigator.clipboard.writeText(url).catch(() => {});
  }, [replaySpeed]);

  return (
    <div className="h-full flex flex-col text-[11px]">
      {/* ── Replay status bar ── */}
      {isReplayMode && activeClip && (
        <div className="px-3 py-1.5 border-b border-f1-border bg-f1-red/5 flex items-center gap-2">
          <Repeat className="w-3 h-3 text-f1-red animate-pulse" />
          <span className="text-[10px] font-display font-bold uppercase tracking-wider text-f1-red">
            REPLAY
          </span>
          <span className="text-[10px] font-mono text-white/60 flex-1 truncate">
            {activeClip.label}
          </span>
          <button
            onClick={onStop}
            className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-f1-red/20 text-f1-red hover:bg-f1-red/30 transition-colors"
          >
            Exit
          </button>
        </div>
      )}

      {/* ── Controls bar ── */}
      <div className="px-3 py-1.5 border-b border-f1-border flex items-center gap-2 shrink-0">
        {/* Speed selector */}
        <span className="text-[9px] font-display font-bold uppercase tracking-wider text-f1-text-muted">
          Speed
        </span>
        <div className="flex gap-0.5">
          {REPLAY_SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setReplaySpeed(s)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-colors ${
                replaySpeed === s
                  ? "bg-f1-red/20 text-f1-red border border-f1-red/30"
                  : "text-f1-text-muted hover:bg-white/5"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>


      </div>

      {/* ── Event timeline (mini-map) ── */}
      <div className="px-3 py-2 border-b border-f1-border shrink-0">
        <div className="relative h-4 bg-white/5 rounded-full overflow-hidden">
          {/* Progress indicator */}
          <div
            className="absolute inset-y-0 left-0 bg-white/5 rounded-full"
            style={{ width: `${Math.min(100, (raceProgress / Math.max(totalLaps, 1)) * 100)}%` }}
          />
          {/* Event markers */}
          {events.map((e) => {
            const pct = totalLaps > 0 ? (e.lap / totalLaps) * 100 : 0;
            return (
              <div
                key={e.id}
                className="absolute top-0.5 w-1.5 h-3 rounded-sm cursor-pointer hover:scale-150 transition-transform"
                style={{
                  left: `${pct}%`,
                  backgroundColor: EVENT_COLORS[e.type] || "#888",
                  opacity: e.severity === "high" ? 1 : e.severity === "medium" ? 0.7 : 0.5,
                }}
                title={`L${e.lap}: ${e.message}`}
                onClick={() => onPlayClip(e)}
              />
            );
          })}
        </div>
      </div>

      {/* ── Filter pills ── */}
      <div className="px-3 py-1.5 border-b border-f1-border flex items-center gap-1 shrink-0 overflow-x-auto">
        <button
          onClick={() => setFilter("all")}
          className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider transition-colors ${
            filter === "all" ? "bg-white/10 text-white" : "text-f1-text-muted hover:bg-white/5"
          }`}
        >
          All ({events.length})
        </button>
        {(Object.keys(EVENT_COLORS) as RaceEventType[]).map((type) => {
          const count = events.filter((e) => e.type === type).length;
          if (count === 0) return null;
          return (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                filter === type
                  ? "text-white"
                  : "text-f1-text-muted hover:bg-white/5"
              }`}
              style={filter === type ? { backgroundColor: `${EVENT_COLORS[type]}30`, color: EVENT_COLORS[type] } : {}}
            >
              {EVENT_ICONS[type]} {count}
            </button>
          );
        })}
      </div>

      {/* ── Event list ── */}
      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
        {displayEvents.length === 0 ? (
          <div className="flex items-center justify-center h-full text-f1-text-dim text-[11px]">
            No events detected yet
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {displayEvents.map((event) => {
              const isActive = activeEvent?.id === event.id;
              return (
                <button
                  key={event.id}
                  onClick={() => onPlayClip(event)}
                  className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all group ${
                    isActive ? "bg-white/10 ring-1 ring-white/20" : "hover:bg-white/5"
                  }`}
                >
                  {/* Type indicator */}
                  <div
                    className="w-1 h-8 rounded-full shrink-0"
                    style={{ backgroundColor: EVENT_COLORS[event.type] }}
                  />

                  {/* Icon */}
                  <span className="text-sm shrink-0">{EVENT_ICONS[event.type]}</span>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-white/90 truncate">
                        {event.message}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[9px] text-white/30 font-mono">
                      <span>L{event.lap}</span>
                      <span>·</span>
                      <span>{event.drivers.join(" vs ")}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {isActive ? (
                      <Pause className="w-3.5 h-3.5 text-white/60" />
                    ) : (
                      <Play className="w-3.5 h-3.5 text-white/60" />
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); onShareClip(event); }}
                      className="p-0.5 rounded hover:bg-white/10"
                      title="Copy clip URL"
                    >
                      <Share2 className="w-3 h-3 text-white/40" />
                    </button>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
