"use client";

import { useEffect, useState, useCallback } from "react";
import { useF1Store } from "@/store/f1-store";
import { Keyboard, X } from "lucide-react";

const SHORTCUTS = [
  { key: "←", label: "Previous lap" },
  { key: "→", label: "Next lap" },
  { key: "M", label: "Toggle mute" },
  { key: "A", label: "Toggle auto-commentary" },
  { key: "?", label: "Show / hide shortcuts" },
  { key: "Esc", label: "Close overlay" },
];

export function KeyboardShortcuts() {
  const [showHelp, setShowHelp] = useState(false);

  const selectedLap = useF1Store((s) => s.selectedLap);
  const liveState = useF1Store((s) => s.liveState);
  const voiceMuted = useF1Store((s) => s.voiceMuted);
  const autoCommentary = useF1Store((s) => s.autoCommentary);
  const setSelectedLap = useF1Store((s) => s.setSelectedLap);
  const setVoiceMuted = useF1Store((s) => s.setVoiceMuted);
  const setAutoCommentary = useF1Store((s) => s.setAutoCommentary);
  const fetchLeaderboard = useF1Store((s) => s.fetchLeaderboard);
  const fetchInsights = useF1Store((s) => s.fetchInsights);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      // Ignore when typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const totalLaps = liveState?.total_laps ?? 70;

      switch (e.key) {
        case "ArrowLeft": {
          e.preventDefault();
          const prev = Math.max(1, selectedLap - 1);
          if (prev !== selectedLap) {
            setSelectedLap(prev);
            fetchLeaderboard(prev);
            fetchInsights(prev);
          }
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          const next = Math.min(totalLaps, selectedLap + 1);
          if (next !== selectedLap) {
            setSelectedLap(next);
            fetchLeaderboard(next);
            fetchInsights(next);
          }
          break;
        }
        case "m":
        case "M":
          e.preventDefault();
          setVoiceMuted(!voiceMuted);
          break;
        case "a":
        case "A":
          e.preventDefault();
          setAutoCommentary(!autoCommentary);
          break;
        case "?":
          e.preventDefault();
          setShowHelp((v) => !v);
          break;
        case "Escape":
          if (showHelp) {
            e.preventDefault();
            setShowHelp(false);
          }
          break;
      }
    },
    [
      selectedLap,
      liveState,
      voiceMuted,
      autoCommentary,
      showHelp,
      setSelectedLap,
      setVoiceMuted,
      setAutoCommentary,
      fetchLeaderboard,
      fetchInsights,
    ]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  if (!showHelp) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70"
      onClick={() => setShowHelp(false)}
    >
      <div
        className="bg-f1-surface border border-f1-border rounded-[6px] p-6 w-80 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-f1-cyan">
            <Keyboard className="w-5 h-5" />
            <span className="font-display text-sm uppercase tracking-wider">
              Keyboard Shortcuts
            </span>
          </div>
          <button
            onClick={() => setShowHelp(false)}
            className="text-white/40 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          {SHORTCUTS.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-white/60">{s.label}</span>
              <kbd className="bg-white/10 border border-white/20 rounded px-2 py-0.5 font-mono text-[13px] text-white/80 min-w-[2rem] text-center">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-white/10 text-[13px] text-white/30 text-center">
          Press <kbd className="bg-white/10 rounded px-1">?</kbd> to toggle
        </div>
      </div>
    </div>
  );
}
