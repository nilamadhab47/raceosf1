"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useF1Store } from "@/store/f1-store";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";

export function ReplayScrubber() {
  const selectedLap = useF1Store((s) => s.selectedLap);
  const liveState = useF1Store((s) => s.liveState);
  const session = useF1Store((s) => s.session);
  const setSelectedLap = useF1Store((s) => s.setSelectedLap);
  const fetchLeaderboard = useF1Store((s) => s.fetchLeaderboard);
  const fetchInsights = useF1Store((s) => s.fetchInsights);

  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalLaps = liveState?.total_laps ?? 70;

  const goToLap = useCallback(
    (lap: number) => {
      const clamped = Math.max(1, Math.min(totalLaps, lap));
      setSelectedLap(clamped);
      fetchLeaderboard(clamped);
      fetchInsights(clamped);
    },
    [totalLaps, setSelectedLap, fetchLeaderboard, fetchInsights]
  );

  // Auto-advance when playing
  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      const store = useF1Store.getState();
      const currentLap = store.selectedLap;
      const maxLap = store.liveState?.total_laps ?? 70;
      if (currentLap >= maxLap) {
        setPlaying(false);
        return;
      }
      const next = currentLap + 1;
      store.setSelectedLap(next);
      store.fetchLeaderboard(next);
      store.fetchInsights(next);
    }, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing]);

  if (!session) return null;

  const progress = totalLaps > 1 ? ((selectedLap - 1) / (totalLaps - 1)) * 100 : 0;

  return (
    <div className="shrink-0 bg-f1-surface border-t border-white/5 px-4 py-1.5 flex items-center gap-3">
      {/* Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => goToLap(1)}
          className="p-1 text-white/40 hover:text-white/80 transition-colors"
          title="Go to Lap 1"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setPlaying(!playing)}
          className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all"
          title={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <Pause className="w-3.5 h-3.5" />
          ) : (
            <Play className="w-3.5 h-3.5 ml-0.5" />
          )}
        </button>
        <button
          onClick={() => goToLap(totalLaps)}
          className="p-1 text-white/40 hover:text-white/80 transition-colors"
          title="Go to last lap"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Lap indicator */}
      <span className="text-[13px] font-mono text-f1-text-dim w-16 shrink-0">
        Lap{" "}
        <span className="text-f1-cyan font-bold">{selectedLap}</span>
        <span className="text-white/20">/{totalLaps}</span>
      </span>

      {/* Scrubber track */}
      <div className="flex-1 relative group cursor-pointer h-6 flex items-center">
        <input
          type="range"
          min={1}
          max={totalLaps}
          value={selectedLap}
          onChange={(e) => goToLap(Number(e.target.value))}
          className="w-full h-1 appearance-none bg-white/10 rounded-full outline-none
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-f1-cyan
            [&::-webkit-slider-thumb]:shadow-glow-cyan
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-125"
        />
        {/* Progress fill overlay */}
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-f1-cyan/30 rounded-full pointer-events-none"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Speed hint */}
      {playing && (
        <span className="text-[13px] font-mono text-f1-green animate-pulse shrink-0">
          2s/lap
        </span>
      )}
    </div>
  );
}
