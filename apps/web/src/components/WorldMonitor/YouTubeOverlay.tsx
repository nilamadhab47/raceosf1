"use client";

/**
 * YouTubeOverlay — YouTube iframe API integration for race event replays.
 *
 * Features:
 *   - Maps race events (overtakes, incidents, pit stops) to YouTube timestamps
 *   - Auto-triggers on timeline match
 *   - Plays muted by default
 *   - Expandable overlay
 *   - Close/minimize
 */

import { useState, useCallback, useRef, useEffect, memo } from "react";
import { useTimeline } from "@/engines/Timeline";

/* ── Types ────────────────────────────────────────────────────────── */

export interface VideoEvent {
  lap: number;
  event: "overtake" | "crash" | "pit_stop" | "start" | "finish" | "sc" | "highlight";
  label: string;
  videoId: string;
  timestamp: number; // seconds into the YouTube video
}

interface YouTubeOverlayProps {
  events?: VideoEvent[];
}

/* ── Component ────────────────────────────────────────────────────── */

export const YouTubeOverlay = memo(function YouTubeOverlay({ events = [] }: YouTubeOverlayProps) {
  const { currentLap } = useTimeline();
  const [activeEvent, setActiveEvent] = useState<VideoEvent | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(new Set<number>());
  const lastTriggeredLap = useRef(-1);

  // Auto-trigger on lap match
  useEffect(() => {
    if (events.length === 0 || currentLap === lastTriggeredLap.current) return;
    lastTriggeredLap.current = currentLap;

    const match = events.find((e) => e.lap === currentLap && !dismissed.has(e.lap));
    if (match) {
      setActiveEvent(match);
      setExpanded(false);
    }
  }, [currentLap, events, dismissed]);

  const dismiss = useCallback(() => {
    if (activeEvent) {
      setDismissed((prev) => new Set(prev).add(activeEvent.lap));
    }
    setActiveEvent(null);
    setExpanded(false);
  }, [activeEvent]);

  if (!activeEvent) return null;

  const embedUrl = `https://www.youtube-nocookie.com/embed/${activeEvent.videoId}?start=${activeEvent.timestamp}&autoplay=1&mute=1&rel=0&modestbranding=1`;
  const w = expanded ? 640 : 320;
  const h = expanded ? 360 : 180;

  return (
    <div
      className={`fixed z-50 transition-all duration-300 ${
        expanded ? "bottom-20 right-8" : "bottom-20 right-4"
      }`}
    >
      <div
        className="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-2xl"
        style={{ width: w }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-f1-surface/90 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-display font-bold uppercase tracking-wider text-f1-red">
              ▶ {activeEvent.event.toUpperCase()}
            </span>
            <span className="text-[9px] font-mono text-f1-text-muted">
              Lap {activeEvent.lap}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-f1-text-muted hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors"
            >
              {expanded ? "⊟" : "⊞"}
            </button>
            <button
              onClick={dismiss}
              className="text-f1-text-muted hover:text-f1-red text-xs px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Label */}
        <div className="px-3 py-1 bg-f1-surface/60">
          <p className="text-[10px] text-f1-text-dim truncate">{activeEvent.label}</p>
        </div>

        {/* YouTube iframe */}
        <div style={{ height: h }} className="bg-black">
          <iframe
            src={embedUrl}
            width="100%"
            height="100%"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={activeEvent.label}
            className="w-full h-full"
          />
        </div>
      </div>
    </div>
  );
});
