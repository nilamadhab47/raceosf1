"use client";

import { useEffect, useRef, memo } from "react";
import { useF1Store } from "@/store/f1-store";
import { useTimeline } from "@/engines/Timeline";

const getSeverityStyle = (severity: string) => {
  switch (severity) {
    case "warning": return { icon: "⚠️", color: "text-f1-amber", bg: "bg-f1-amber/5", border: "border-f1-amber/20" };
    case "alert":   return { icon: "🔴", color: "text-f1-red",   bg: "bg-f1-red/5",   border: "border-f1-red/20" };
    default:        return { icon: "💡", color: "text-f1-green",  bg: "bg-f1-green/5",  border: "border-f1-green/20" };
  }
};

const InsightsPanelInner = () => {
  const { insights, fetchInsights, session } = useF1Store();
  const { currentLap } = useTimeline();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (session) fetchInsights();
  }, [session, fetchInsights]);

  // Subscribe to timeline lap changes
  useEffect(() => {
    if (!session || currentLap < 1) return;
    fetchInsights(currentLap);
  }, [session, currentLap, fetchInsights]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [insights]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-f1-border-solid flex items-center justify-between">
        <h2 className="text-[13px] font-display font-bold uppercase tracking-[0.2em] text-f1-text-dim">
          AI Insights
        </h2>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-f1-red animate-pulse-glow" />
          <span className="text-[13px] font-mono tabular-nums text-f1-text-dim">{insights.length}</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {insights.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="text-3xl">🤖</div>
            <p className="text-[13px] text-center text-f1-text-dim font-body">
              {session ? "No insights yet. Start simulation." : "Load a session to generate insights."}
            </p>
          </div>
        ) : (
          insights.map((insight, idx) => {
            const sev = getSeverityStyle(insight.severity);
            return (
              <div
                key={`${insight.type}-${insight.driver}-${idx}`}
                className={`rounded-lg p-3 border transition-all duration-200 ${sev.bg} ${sev.border}`}
                style={{ borderLeftWidth: "3px" }}
              >
                <div className="flex items-start gap-2">
                  <span className="text-[13px] shrink-0 mt-0.5">{sev.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] leading-relaxed font-body text-f1-text">{insight.message}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-[13px] px-1.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider ${sev.color} ${sev.bg}`}>
                        {insight.type}
                      </span>
                      {insight.lap > 0 && (
                        <span className="text-[13px] font-mono text-f1-text-dim">L{insight.lap}</span>
                      )}
                      <div className="flex items-center gap-1 ml-auto">
                        <div className="w-12 h-1 rounded-full overflow-hidden bg-white/5">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              insight.severity === "warning" ? "bg-f1-amber" :
                              insight.severity === "alert" ? "bg-f1-red" : "bg-f1-green"
                            }`}
                            style={{ width: `${insight.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-[7px] font-mono tabular-nums text-f1-text-dim">
                          {Math.round(insight.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export const InsightsPanel = memo(InsightsPanelInner);
