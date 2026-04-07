"use client";

import { useState, useRef, useCallback, useEffect, memo } from "react";
import { useF1Store } from "@/store/f1-store";
import { useTimeline } from "@/engines/Timeline";
import { api } from "@/lib/api";

const VoiceWidgetInner = () => {
  const {
    voiceMuted, setVoiceMuted, insights, autoCommentary, setAutoCommentary,
    flagMode,
  } = useF1Store();
  const { isPlaying: simPlaying } = useTimeline();
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<string[]>([]);
  const processingRef = useRef(false);
  const lastSpokenInsightRef = useRef<string>("");
  const lastSpokenFlagRef = useRef<string>("green");
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const processQueue = useCallback(async () => {
    if (processingRef.current || voiceMuted || queueRef.current.length === 0) return;
    processingRef.current = true;

    while (queueRef.current.length > 0 && !voiceMuted) {
      const text = queueRef.current.shift()!;
      try {
        setIsAudioPlaying(true);
        const blob = await api.synthesizeSpeech(text);
        if (blob) {
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioRef.current = audio;
          await new Promise<void>((resolve) => {
            audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
            audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
            audio.play().catch(resolve);
          });
        }
      } catch {
        // Voice service unavailable
      }
    }

    setIsAudioPlaying(false);
    processingRef.current = false;
  }, [voiceMuted]);

  const enqueue = useCallback((text: string) => {
    const clean = text.replace(/[\u{1F000}-\u{1FFFF}]/gu, "").trim();
    if (!clean) return;
    // Limit queue to 3 to prevent backlog
    if (queueRef.current.length < 3) {
      queueRef.current.push(clean);
      processQueue();
    }
  }, [processQueue]);

  // Auto-commentary: speak top insight every 30s
  useEffect(() => {
    if (!autoCommentary || voiceMuted || !simPlaying) {
      if (autoTimerRef.current) {
        clearInterval(autoTimerRef.current);
        autoTimerRef.current = null;
      }
      return;
    }

    const speakTopInsight = () => {
      if (insights.length === 0 || processingRef.current) return;
      const latest = insights[0];
      if (latest.message === lastSpokenInsightRef.current) return;
      lastSpokenInsightRef.current = latest.message;
      enqueue(latest.message);
    };

    // Speak immediately on activation
    speakTopInsight();

    autoTimerRef.current = setInterval(speakTopInsight, 30000);
    return () => {
      if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    };
  }, [autoCommentary, voiceMuted, simPlaying, insights, enqueue]);

  // Auto-commentary trigger: flag changes
  useEffect(() => {
    if (!autoCommentary || voiceMuted) return;
    if (flagMode === lastSpokenFlagRef.current) return;
    lastSpokenFlagRef.current = flagMode;

    const flagAnnouncements: Record<string, string> = {
      sc: "Safety car has been deployed.",
      vsc: "Virtual safety car has been deployed.",
      red: "Red flag. The session has been suspended.",
      green: "Green flag. Racing resumes.",
      chequered: "Chequered flag. The race is over.",
      yellow: "Yellow flag on track.",
    };

    if (flagAnnouncements[flagMode]) {
      enqueue(flagAnnouncements[flagMode]);
    }
  }, [flagMode, autoCommentary, voiceMuted, enqueue]);

  const speakLatestInsight = () => {
    if (insights.length === 0) return;
    enqueue(insights[0].message);
  };

  const toggleMute = () => {
    const newMuted = !voiceMuted;
    setVoiceMuted(newMuted);
    if (newMuted && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      queueRef.current = [];
      setIsAudioPlaying(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50" data-tour="voice-widget">
      {expanded && (
        <div className="mb-2 rounded-xl p-3 border w-56 glass-panel-raised">
          <h3 className="text-[13px] font-display font-bold uppercase tracking-[0.15em] mb-2.5 text-f1-text-dim">
            Voice Assistant
          </h3>
          <div className="space-y-2">
            <button
              onClick={toggleMute}
              className={`w-full text-[13px] py-1.5 rounded-lg font-mono font-bold transition-all border ${
                voiceMuted
                  ? "bg-white/[0.03] border-f1-border-solid text-f1-text-dim"
                  : "bg-f1-red/10 border-f1-red/20 text-f1-red"
              }`}
            >
              {voiceMuted ? "🔇 Unmute" : "🔊 Muted"}
            </button>

            {/* Auto-commentary toggle */}
            <button
              onClick={() => setAutoCommentary(!autoCommentary)}
              disabled={voiceMuted}
              className={`w-full text-[13px] py-1.5 rounded-lg font-mono font-bold transition-all border disabled:opacity-30 ${
                autoCommentary
                  ? "bg-f1-amber/10 border-f1-amber/20 text-f1-amber"
                  : "bg-white/[0.03] border-f1-border-solid text-f1-text-dim"
              }`}
            >
              {autoCommentary ? "🎙️ Auto ON" : "🎙️ Auto OFF"}
            </button>

            <button
              onClick={speakLatestInsight}
              disabled={voiceMuted || insights.length === 0 || isAudioPlaying}
              className="w-full text-[13px] py-1.5 rounded-[6px] font-display font-bold transition-all disabled:opacity-30 bg-f1-red text-white"
            >
              {isAudioPlaying ? "Speaking..." : "Speak Insight"}
            </button>
            <p className="text-[13px] text-f1-text-muted font-mono">
              {autoCommentary ? "Auto: every 30s + flag changes" : "ElevenLabs TTS"}
            </p>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-11 h-11 rounded-full flex items-center justify-center border relative transition-all hover:scale-[1.08] active:scale-[0.92] ${
          isAudioPlaying
            ? "bg-f1-red border-f1-red shadow-glow-red"
            : autoCommentary
              ? "bg-f1-amber/10 border-f1-amber/30 shadow-glow-amber"
              : "glass-panel border-f1-border-solid"
        }`}
      >
        {isAudioPlaying && (
          <div className="absolute inset-0 rounded-full animate-ping bg-f1-red opacity-20" />
        )}
        <span className="text-sm relative z-10">
          {voiceMuted ? "🔇" : isAudioPlaying ? "🔊" : autoCommentary ? "🎙️" : "🎙️"}
        </span>
      </button>
    </div>
  );
};

export const VoiceWidget = memo(VoiceWidgetInner);
