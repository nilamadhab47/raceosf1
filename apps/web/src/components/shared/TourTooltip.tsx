"use client";

import { useState, useRef, useCallback } from "react";
import type { TooltipRenderProps } from "react-joyride";
import { api } from "@/lib/api";

export function TourTooltip({
  index,
  size,
  step,
  isLastStep,
  primaryProps,
  skipProps,
  tooltipProps,
}: TooltipRenderProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleVoice = useCallback(async () => {
    // Stop if already playing
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    try {
      const text = `${step.title}. ${typeof step.content === "string" ? step.content : ""}`;
      const blob = await api.synthesizeSpeech(text);
      if (!blob) {
        setIsPlaying(false);
        return;
      }
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.volume = 0.6;
      audio.playbackRate = 1.15;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setIsPlaying(false);
        audioRef.current = null;
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setIsPlaying(false);
        audioRef.current = null;
      };
      await audio.play();
    } catch {
      setIsPlaying(false);
    }
  }, [isPlaying, step]);

  return (
    <div
      {...tooltipProps}
      className="rounded-xl border shadow-2xl"
      style={{
        background: "#111111",
        borderColor: "rgba(225, 6, 0, 0.3)",
        maxWidth: 340,
        minWidth: 280,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h3
          className="text-[15px] font-bold uppercase tracking-wide"
          style={{ fontFamily: "var(--font-display, Orbitron, sans-serif)", color: "#E10600" }}
        >
          {step.title}
        </h3>
        <button
          onClick={handleVoice}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-white/10"
          title={isPlaying ? "Stop narration" : "Listen to this step"}
        >
          {isPlaying ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="3" width="4" height="10" rx="1" fill="#E10600" />
              <rect x="9" y="3" width="4" height="10" rx="1" fill="#E10600" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 5h2l3-3v12l-3-3H2a1 1 0 01-1-1V6a1 1 0 011-1z" fill="#888" />
              <path d="M10.5 4.5a5 5 0 010 7" stroke="#888" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M12.5 2.5a8 8 0 010 11" stroke="#888" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {/* Content */}
      <p
        className="px-5 pb-3 text-[13px] leading-relaxed"
        style={{ fontFamily: "var(--font-body, 'Exo 2', sans-serif)", color: "rgba(255,255,255,0.8)" }}
      >
        {step.content}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 pb-4 pt-1">
        <span
          className="text-[10px] uppercase tracking-[0.2em]"
          style={{ fontFamily: "var(--font-display, Orbitron, sans-serif)", color: "rgba(255,255,255,0.3)" }}
        >
          Step {index + 1} of {size}
        </span>

        <div className="flex items-center gap-2">
          <button
            {...skipProps}
            className="px-3 py-1.5 text-[11px] uppercase tracking-wider rounded-md transition-colors hover:bg-white/5"
            style={{
              fontFamily: "var(--font-display, Orbitron, sans-serif)",
              color: "rgba(255,255,255,0.4)",
              fontWeight: 700,
            }}
          >
            Skip
          </button>
          <button
            {...primaryProps}
            className="px-4 py-1.5 text-[11px] uppercase tracking-wider rounded-md font-bold transition-all hover:brightness-110 active:scale-[0.97]"
            style={{
              fontFamily: "var(--font-display, Orbitron, sans-serif)",
              background: "#E10600",
              color: "#fff",
              fontWeight: 800,
            }}
          >
            {isLastStep ? "Finish" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}
