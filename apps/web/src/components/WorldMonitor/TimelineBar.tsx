"use client";

/**
 * TimelineBar — unified playback controller.
 *
 * This is the SINGLE source of truth for race progression.
 * Play/Pause/Speed/Seek all sync both the frontend rAF timeline
 * AND the backend simulation (via API calls).
 */

import { useEffect, useRef, useCallback, memo } from "react";
import { useTimeline, SPEED_OPTIONS } from "@/engines/Timeline";
import { useF1Store } from "@/store/f1-store";
import { api } from "@/lib/api";

/** Convert timeline speed multiplier to backend seconds-per-lap */
const BASE_LAP_SECONDS = 12;
const toBackendSpeed = (timelineSpeed: number) => BASE_LAP_SECONDS / timelineSpeed;

export const TimelineBar = memo(function TimelineBar() {
  const {
    currentLap,
    totalLaps,
    isPlaying,
    speed,
    progress,
    play,
    pause,
    togglePlay,
    seek,
    setSpeed,
    stepForward,
    stepBackward,
    tick,
    syncFromLive,
    setTotalLaps,
  } = useTimeline();

  const { session, liveState, fetchLiveState } = useF1Store();
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const simActiveRef = useRef(false);

  // Reset timeline and set total laps from session
  useEffect(() => {
    if (!session) return;
    seek(1);
    if (session.total_laps) setTotalLaps(session.total_laps);
    // Stop any running backend sim on GP switch
    api.stopLive().catch(() => {});
    simActiveRef.current = false;
  }, [session, setTotalLaps, seek]);

  // ── Unified Play: start both rAF + backend sim ──
  const handlePlay = useCallback(async () => {
    play();
    try {
      await api.startLive(toBackendSpeed(speed));
      simActiveRef.current = true;
      fetchLiveState();
    } catch {}
  }, [play, speed, fetchLiveState]);

  // ── Unified Pause: stop both rAF + backend sim ──
  const handlePause = useCallback(async () => {
    pause();
    try {
      await api.stopLive();
      simActiveRef.current = false;
    } catch {}
  }, [pause]);

  // ── Unified Toggle ──
  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      handlePause();
    } else {
      handlePlay();
    }
  }, [isPlaying, handlePlay, handlePause]);

  // ── Unified Speed Change: restart backend sim at new speed ──
  const handleSetSpeed = useCallback(async (newSpeed: number) => {
    setSpeed(newSpeed);
    if (simActiveRef.current) {
      try {
        await api.stopLive();
        await api.startLive(toBackendSpeed(newSpeed));
        fetchLiveState();
      } catch {}
    }
  }, [setSpeed, fetchLiveState]);

  // ── Unified Seek: pause sim, seek timeline, restart if was playing ──
  const handleSeek = useCallback(async (lap: number) => {
    const wasPlaying = useTimeline.getState().isPlaying;
    if (simActiveRef.current) {
      await api.stopLive().catch(() => {});
      simActiveRef.current = false;
    }
    seek(lap);
    if (wasPlaying) {
      try {
        await api.startLive(toBackendSpeed(speed));
        simActiveRef.current = true;
        fetchLiveState();
      } catch {}
    }
  }, [seek, speed, fetchLiveState]);

  // ── Unified Step: pause sim, step timeline ──
  const handleStepForward = useCallback(async () => {
    if (simActiveRef.current) {
      await api.stopLive().catch(() => {});
      simActiveRef.current = false;
    }
    pause();
    stepForward();
  }, [pause, stepForward]);

  const handleStepBackward = useCallback(async () => {
    if (simActiveRef.current) {
      await api.stopLive().catch(() => {});
      simActiveRef.current = false;
    }
    pause();
    stepBackward();
  }, [pause, stepBackward]);

  // Sync from live — safety net, only snap forward for drift correction
  useEffect(() => {
    if (liveState?.is_running) {
      syncFromLive(liveState.current_lap, liveState.total_laps, true);
    }
  }, [liveState, syncFromLive]);

  // Poll live state while sim is active
  useEffect(() => {
    if (!simActiveRef.current || !isPlaying) return;
    const interval = setInterval(() => fetchLiveState(), 2000);
    return () => clearInterval(interval);
  }, [isPlaying, fetchLiveState]);

  // rAF-based animation loop — calls tick(deltaMs) every frame
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    lastTimeRef.current = performance.now();

    const loop = () => {
      const now = performance.now();
      const dt = Math.min(now - lastTimeRef.current, 50);
      lastTimeRef.current = now;
      tick(dt);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, tick]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          handleTogglePlay();
          break;
        case "ArrowRight":
          e.preventDefault();
          handleStepForward();
          break;
        case "ArrowLeft":
          e.preventDefault();
          handleStepBackward();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleTogglePlay, handleStepForward, handleStepBackward]);

  // Scrubber
  const scrubberRef = useRef<HTMLDivElement>(null);
  const handleScrub = useCallback(
    (e: React.MouseEvent) => {
      if (!scrubberRef.current) return;
      const rect = scrubberRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const lap = Math.max(1, Math.round(pct * (totalLaps - 1) + 1));
      handleSeek(lap);
    },
    [totalLaps, handleSeek],
  );

  const handleDrag = useCallback(
    (e: React.MouseEvent) => {
      if (e.buttons !== 1) return;
      handleScrub(e);
    },
    [handleScrub],
  );

  const formatLap = (l: number) => String(l).padStart(2, "0");

  return (
    <div className="w-full glass-panel border-t border-f1-red/[0.08] px-4 py-2 flex items-center gap-3">
      {/* Step back */}
      <button
        onClick={handleStepBackward}
        disabled={currentLap <= 1}
        className="w-7 h-7 flex items-center justify-center rounded-md text-f1-text-dim hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30"
        title="Previous lap (←)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="19,20 9,12 19,4" />
          <line x1="5" y1="19" x2="5" y2="5" />
        </svg>
      </button>

      {/* Play / Pause */}
      <button
        onClick={handleTogglePlay}
        className="w-9 h-9 flex items-center justify-center rounded-lg bg-f1-red/10 border border-f1-red/20 text-f1-red hover:bg-f1-red/20 shadow-glow-red transition-colors"
        title={isPlaying ? "Pause (Space)" : "Play (Space)"}
      >
        {isPlaying ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        )}
      </button>

      {/* Step forward */}
      <button
        onClick={handleStepForward}
        disabled={currentLap >= totalLaps}
        className="w-7 h-7 flex items-center justify-center rounded-md text-f1-text-dim hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30"
        title="Next lap (→)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="5,4 15,12 5,20" />
          <line x1="19" y1="5" x2="19" y2="19" />
        </svg>
      </button>

      {/* Lap counter */}
      <div className="flex items-center gap-1.5 min-w-[90px]">
        <span className="text-[10px] font-display font-bold uppercase tracking-wider text-f1-text-muted">LAP</span>
        <span className="text-base font-display font-black text-white tabular-nums">{formatLap(currentLap)}</span>
        <span className="text-[10px] font-mono text-f1-text-muted">/ {formatLap(totalLaps)}</span>
      </div>

      {/* Scrubber */}
      <div
        ref={scrubberRef}
        className="flex-1 h-7 flex items-center cursor-pointer group"
        onClick={handleScrub}
        onMouseMove={handleDrag}
      >
        <div className="w-full h-1.5 rounded-full bg-f1-surface-2 relative overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full rounded-full bg-f1-red transition-[width] duration-75"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-glow-red border-2 border-f1-red transition-[left] duration-75 group-hover:scale-125"
            style={{ left: `calc(${progress}% - 7px)` }}
          />
        </div>
      </div>

      {/* Speed selector */}
      <div className="flex items-center gap-0.5">
        {SPEED_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => handleSetSpeed(s)}
            className={`px-2 py-1 text-[10px] font-mono font-bold rounded transition-all ${
              speed === s
                ? "bg-f1-red/15 text-f1-red border border-f1-red/30"
                : "text-f1-text-muted hover:text-f1-text-dim hover:bg-white/5"
            }`}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
});
