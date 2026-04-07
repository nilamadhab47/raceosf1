"use client";

import { useEffect, useRef, memo } from "react";
import { useF1Store } from "@/store/f1-store";
import { useTimeline } from "@/engines/Timeline";
import { motion, AnimatePresence } from "framer-motion";

const getSeverityIcon = (severity: string) => {
  switch (severity) {
    case "warning": return "⚠️";
    case "alert": return "🔴";
    default: return "💡";
  }
};

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case "warning": return "var(--f1-accent-yellow)";
    case "alert": return "var(--f1-accent-red)";
    default: return "var(--f1-accent-green)";
  }
};

const getSeverityBg = (severity: string) => {
  switch (severity) {
    case "warning": return "rgba(255, 215, 0, 0.06)";
    case "alert": return "rgba(255, 51, 102, 0.06)";
    default: return "rgba(0, 255, 136, 0.06)";
  }
};

const InsightsPanelInner = () => {
  const { insights, fetchInsights, session } = useF1Store();
  const { isPlaying, currentLap } = useTimeline();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (session) fetchInsights();
  }, [session, fetchInsights]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      fetchInsights(currentLap);
    }, 5000);
    return () => clearInterval(interval);
  }, [isPlaying, currentLap, fetchInsights]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [insights]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b flex items-center justify-between"
        style={{ borderColor: "var(--f1-border)" }}>
        <div className="flex items-center gap-2">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--f1-text-dim)" }}>
            AI Insights
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{
            background: "var(--f1-accent-green)",
            animation: "pulse-glow 2s ease-in-out infinite",
          }} />
          <span className="text-[9px] font-mono tabular-nums" style={{ color: "var(--f1-text-dim)" }}>
            {insights.length}
          </span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {insights.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="text-3xl">🤖</div>
            <p className="text-[11px] text-center" style={{ color: "var(--f1-text-dim)" }}>
              {session ? "No insights yet. Start simulation." : "Load a session to generate insights."}
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {insights.map((insight, idx) => {
              const sevColor = getSeverityColor(insight.severity);
              return (
                <motion.div
                  key={`${insight.type}-${insight.driver}-${idx}`}
                  initial={{ opacity: 0, x: -10, scale: 0.97 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.25, delay: idx * 0.03 }}
                  className="rounded-lg p-3 border transition-all duration-200 hover:border-opacity-60"
                  style={{
                    background: getSeverityBg(insight.severity),
                    borderColor: sevColor + "20",
                    borderLeftWidth: "3px",
                    borderLeftColor: sevColor,
                  }}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs shrink-0 mt-0.5">{getSeverityIcon(insight.severity)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] leading-relaxed">{insight.message}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span
                          className="text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider"
                          style={{ background: sevColor + "15", color: sevColor }}
                        >
                          {insight.type}
                        </span>
                        {insight.lap > 0 && (
                          <span className="text-[8px] font-mono" style={{ color: "var(--f1-text-dim)" }}>
                            L{insight.lap}
                          </span>
                        )}
                        {/* Confidence bar */}
                        <div className="flex items-center gap-1 ml-auto">
                          <div className="w-12 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${insight.confidence * 100}%`, background: sevColor }} />
                          </div>
                          <span className="text-[7px] font-mono tabular-nums" style={{ color: "var(--f1-text-dim)" }}>
                            {Math.round(insight.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export const InsightsPanel = memo(InsightsPanelInner);
