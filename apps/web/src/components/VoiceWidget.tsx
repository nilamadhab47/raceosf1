"use client";

import { useState, useRef, useCallback, memo } from "react";
import { useF1Store } from "@/store/f1-store";
import { api } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

const VoiceWidgetInner = () => {
  const { voiceMuted, setVoiceMuted, insights } = useF1Store();
  const [isPlaying, setIsPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<string[]>([]);
  const processingRef = useRef(false);

  const processQueue = useCallback(async () => {
    if (processingRef.current || voiceMuted || queueRef.current.length === 0) return;
    processingRef.current = true;

    while (queueRef.current.length > 0 && !voiceMuted) {
      const text = queueRef.current.shift()!;
      try {
        setIsPlaying(true);
        const blob = await api.synthesizeSpeech(text);
        if (blob) {
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioRef.current = audio;
          await new Promise<void>((resolve) => {
            audio.onended = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            audio.onerror = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            audio.play().catch(resolve);
          });
        }
      } catch {
        // Voice service unavailable
      }
    }

    setIsPlaying(false);
    processingRef.current = false;
  }, [voiceMuted]);

  const speakLatestInsight = () => {
    if (insights.length === 0) return;
    const latest = insights[0];
    const cleanText = latest.message.replace(/[\u{1F000}-\u{1FFFF}]/gu, "").trim();
    queueRef.current.push(cleanText);
    processQueue();
  };

  const toggleMute = () => {
    const newMuted = !voiceMuted;
    setVoiceMuted(newMuted);
    if (newMuted && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      queueRef.current = [];
      setIsPlaying(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="mb-2 rounded-xl p-3 border w-56"
            style={{
              background: "var(--f1-surface-glass)",
              borderColor: "var(--f1-border-glow)",
              backdropFilter: "blur(20px)",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
            }}
          >
            <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] mb-2.5" style={{ color: "var(--f1-text-dim)" }}>
              Voice Assistant
            </h3>
            <div className="space-y-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={toggleMute}
                className="w-full text-[10px] py-1.5 rounded-lg font-bold transition-all border"
                style={{
                  background: voiceMuted ? "rgba(255,255,255,0.03)" : "rgba(0, 255, 136, 0.1)",
                  borderColor: voiceMuted ? "var(--f1-border)" : "rgba(0, 255, 136, 0.2)",
                  color: voiceMuted ? "var(--f1-text-dim)" : "var(--f1-accent-green)",
                }}
              >
                {voiceMuted ? "🔇 Unmute" : "🔊 Muted"}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={speakLatestInsight}
                disabled={voiceMuted || insights.length === 0 || isPlaying}
                className="w-full text-[10px] py-1.5 rounded-lg font-bold transition-all disabled:opacity-30"
                style={{
                  background: "linear-gradient(135deg, var(--f1-accent-purple), #7c3aed)",
                  color: "#fff",
                }}
              >
                {isPlaying ? "Speaking..." : "Speak Insight"}
              </motion.button>
              <p className="text-[8px]" style={{ color: "var(--f1-text-dim)" }}>
                ElevenLabs TTS
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating button */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setExpanded(!expanded)}
        className="w-11 h-11 rounded-full flex items-center justify-center border relative"
        style={{
          background: isPlaying ? "var(--f1-accent-green)" : "var(--f1-surface-glass)",
          borderColor: isPlaying ? "var(--f1-accent-green)" : "var(--f1-border)",
          backdropFilter: "blur(20px)",
          boxShadow: isPlaying
            ? "0 0 20px rgba(0, 255, 136, 0.4), 0 0 40px rgba(0, 255, 136, 0.1)"
            : "0 4px 16px rgba(0, 0, 0, 0.4)",
        }}
      >
        {isPlaying && (
          <div className="absolute inset-0 rounded-full animate-ping" style={{
            background: "var(--f1-accent-green)",
            opacity: 0.2,
          }} />
        )}
        <span className="text-sm relative z-10">{voiceMuted ? "🔇" : isPlaying ? "🔊" : "🎙️"}</span>
      </motion.button>
    </div>
  );
};

export const VoiceWidget = memo(VoiceWidgetInner);
