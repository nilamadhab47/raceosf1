"use client";

import { useRef, useEffect, useCallback } from "react";

interface AudioVisualizerProps {
  audioElement: HTMLAudioElement | null;
  isPlaying: boolean;
  className?: string;
  barCount?: number;
  color?: string;
}

export function AudioVisualizer({
  audioElement,
  isPlaying,
  className = "",
  barCount = 24,
  color = "#a855f7",
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number>(0);

  const setupAnalyser = useCallback(() => {
    if (!audioElement || sourceRef.current) return;

    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;

      const source = ctx.createMediaElementSource(audioElement);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      contextRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
    } catch {
      // Audio context may already be connected
    }
  }, [audioElement]);

  useEffect(() => {
    if (isPlaying && audioElement) {
      setupAnalyser();
    }
  }, [isPlaying, audioElement, setupAnalyser]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      if (!analyser || !isPlaying) {
        // Idle: draw small static bars
        const barW = w / barCount - 1;
        for (let i = 0; i < barCount; i++) {
          const barH = 2 + Math.random() * 3;
          ctx.fillStyle = `${color}40`;
          ctx.fillRect(i * (barW + 1), h - barH, barW, barH);
        }
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);

      const barW = w / barCount - 1;
      const step = Math.floor(data.length / barCount);

      for (let i = 0; i < barCount; i++) {
        const val = data[i * step] / 255;
        const barH = Math.max(2, val * h * 0.85);

        // Gradient from color to brighter
        const alpha = 0.4 + val * 0.6;
        ctx.fillStyle = `${color}${Math.round(alpha * 255)
          .toString(16)
          .padStart(2, "0")}`;
        ctx.fillRect(i * (barW + 1), h - barH, barW, barH);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, barCount, color]);

  return (
    <canvas
      ref={canvasRef}
      width={120}
      height={32}
      className={`rounded ${className}`}
    />
  );
}
