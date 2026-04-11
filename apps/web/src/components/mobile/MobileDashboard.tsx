"use client";

import { useState, useRef, useEffect, useCallback, memo } from "react";
import { useF1Store } from "@/store/f1-store";
import { useTimeline } from "@/engines/Timeline";
import gsap from "gsap";

// Panels
import { Leaderboard } from "@/components/Leaderboard/Leaderboard";
import { TrackCanvas } from "@/components/WorldMonitor/TrackCanvas";
import { TelemetryChart } from "@/components/Telemetry/TelemetryChart";
import { InsightsPanel } from "@/components/Insights/InsightsPanel";
import { StrategySimulator } from "@/components/Strategy/StrategySimulator";
import { StintBar } from "@/components/Strategy/StintBar";
import { RaceUpdates } from "@/components/RaceControl/RaceUpdates";
import { GapEvolutionChart } from "@/components/Strategy/GapEvolutionChart";
import { TeamRadioPanel } from "@/components/RaceControl/TeamRadioPanel";
import { GPInfoPanel } from "@/components/Strategy/GPInfoPanel";
import { YouTubeHighlightsPanel } from "@/components/WorldMonitor/YouTubeHighlightsPanel";
import { TimelineBar } from "@/components/WorldMonitor/TimelineBar";
import { PanelErrorBoundary } from "@/components/shared/PanelErrorBoundary";
import { MobileHeader } from "./MobileHeader";
import { MobileBottomNav, type TabKey } from "./MobileBottomNav";

import type { LayerKey } from "@/components/WorldMonitor/TrackCanvas";

/* ── Tab → Panel mapping ──────────────────────────────────────────── */

const DEFAULT_LAYERS: Record<LayerKey, boolean> = {
  cars: true,
  labels: true,
  battles: true,
  racingLine: false,
  sectors: false,
  gaps: false,
  tyres: true,
};

/* ── Mobile Dashboard ─────────────────────────────────────────────── */

const MobileDashboardInner = () => {
  const [activeTab, setActiveTab] = useState<TabKey>("race");
  const [layers] = useState(DEFAULT_LAYERS);
  const contentRef = useRef<HTMLDivElement>(null);
  const { session, loading } = useF1Store();
  const { isPlaying, currentLap, totalLaps } = useTimeline();

  // Animate tab switch
  const handleTabChange = useCallback((tab: TabKey) => {
    if (tab === activeTab) return;
    const el = contentRef.current;
    if (!el) { setActiveTab(tab); return; }

    gsap.to(el, {
      opacity: 0,
      y: 8,
      duration: 0.15,
      ease: "power2.in",
      onComplete: () => {
        setActiveTab(tab);
        gsap.fromTo(el,
          { opacity: 0, y: -8 },
          { opacity: 1, y: 0, duration: 0.2, ease: "power2.out" }
        );
      },
    });
  }, [activeTab]);

  // Scroll to top on tab change
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeTab]);

  return (
    <div
      className="h-[100dvh] flex flex-col overflow-hidden bg-f1-bg"
      style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(225,6,0,0.06) 0%, #000000 55%)" }}
    >
      {/* ── Mobile Header ── */}
      <MobileHeader />

      {/* ── Live Bar ── */}
      {isPlaying && (
        <div className="flex items-center justify-center gap-2 px-3 py-1.5 border-b border-f1-red/20 bg-f1-red/[0.05] shrink-0">
          <div className="w-2 h-2 rounded-full bg-f1-red animate-live-pulse" />
          <span className="text-[11px] font-display font-black uppercase tracking-[0.2em] text-f1-red">
            LIVE
          </span>
          <span className="text-sm font-display font-bold tabular-nums text-white">
            LAP {currentLap}<span className="text-f1-text-muted">/{totalLaps}</span>
          </span>
        </div>
      )}

      {/* ── Loading state ── */}
      {loading && !session && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 rounded-full border-2 border-f1-red border-t-transparent animate-spin mx-auto mb-3" />
            <p className="text-sm font-body text-f1-text-dim">Loading session...</p>
          </div>
        </div>
      )}

      {/* ── Tab Content ── */}
      <div
        ref={contentRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden mobile-scroll"
      >
        {activeTab === "race" && (
          <div className="flex flex-col gap-2 p-2">
            {/* Track Map — hero */}
            <div className="h-[50vh] min-h-[280px] glass-panel-hero overflow-hidden rounded-panel">
              <div className="h-[2px] bg-gradient-to-r from-transparent via-f1-red/70 to-transparent" />
              <div className="px-3 py-1.5 border-b border-f1-red/[0.15] bg-gradient-to-b from-black/40 to-transparent">
                <span className="text-[10px] font-display font-bold uppercase tracking-[0.2em] text-f1-text/80">
                  ◉ Track Map
                </span>
              </div>
              <div className="flex-1 h-[calc(100%-2px-32px)]">
                <PanelErrorBoundary fallbackTitle="Track Error">
                  <TrackCanvas layers={layers} />
                </PanelErrorBoundary>
              </div>
            </div>

            {/* Leaderboard */}
            <MobilePanel title="Leaderboard" icon="▮">
              <PanelErrorBoundary fallbackTitle="Leaderboard Error">
                <Leaderboard />
              </PanelErrorBoundary>
            </MobilePanel>
          </div>
        )}

        {activeTab === "data" && (
          <div className="flex flex-col gap-2 p-2">
            {/* Telemetry */}
            <MobilePanel title="Telemetry" icon="◆" minH="h-[300px]">
              <PanelErrorBoundary fallbackTitle="Telemetry Error">
                <TelemetryChart />
              </PanelErrorBoundary>
            </MobilePanel>

            {/* Gap Evolution */}
            <MobilePanel title="Gap Evolution" icon="▲" minH="h-[280px]">
              <PanelErrorBoundary fallbackTitle="Gap Error">
                <GapEvolutionChart />
              </PanelErrorBoundary>
            </MobilePanel>

            {/* Stints */}
            <MobilePanel title="Stints" icon="◎" minH="h-[250px]">
              <PanelErrorBoundary fallbackTitle="Stints Error">
                <StintBar />
              </PanelErrorBoundary>
            </MobilePanel>
          </div>
        )}

        {activeTab === "strategy" && (
          <div className="flex flex-col gap-2 p-2">
            {/* Strategy Simulator */}
            <MobilePanel title="Strategy" icon="▣" minH="h-[300px]">
              <PanelErrorBoundary fallbackTitle="Strategy Error">
                <StrategySimulator />
              </PanelErrorBoundary>
            </MobilePanel>

            {/* AI Insights */}
            <MobilePanel title="AI Insights" icon="●">
              <PanelErrorBoundary fallbackTitle="Insights Error">
                <InsightsPanel />
              </PanelErrorBoundary>
            </MobilePanel>

            {/* GP Info */}
            <MobilePanel title="GP Info" icon="⬡">
              <PanelErrorBoundary fallbackTitle="GP Info Error">
                <GPInfoPanel />
              </PanelErrorBoundary>
            </MobilePanel>
          </div>
        )}

        {activeTab === "feed" && (
          <div className="flex flex-col gap-2 p-2">
            {/* Race Updates */}
            <MobilePanel title="Race Updates" icon="◈">
              <PanelErrorBoundary fallbackTitle="Race Updates Error">
                <RaceUpdates />
              </PanelErrorBoundary>
            </MobilePanel>

            {/* Team Radio */}
            <MobilePanel title="Team Radio" icon="◇">
              <PanelErrorBoundary fallbackTitle="Radio Error">
                <TeamRadioPanel />
              </PanelErrorBoundary>
            </MobilePanel>

            {/* Highlights */}
            <MobilePanel title="Highlights" icon="▶" minH="h-[300px]">
              <PanelErrorBoundary fallbackTitle="YouTube Error">
                <YouTubeHighlightsPanel />
              </PanelErrorBoundary>
            </MobilePanel>
          </div>
        )}
      </div>

      {/* ── Timeline (pinned) ── */}
      <div className="shrink-0 border-t border-f1-border">
        <TimelineBar />
      </div>

      {/* ── Bottom Navigation ── */}
      <MobileBottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  );
};

export const MobileDashboard = memo(MobileDashboardInner);

/* ── Reusable Mobile Panel Card ───────────────────────────────────── */

function MobilePanel({
  title,
  icon,
  children,
  minH,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  minH?: string;
}) {
  return (
    <div className={`glass-panel overflow-hidden rounded-panel ${minH || ""}`}>
      <div className="h-[2px] bg-gradient-to-r from-transparent via-f1-red/50 to-transparent" />
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-f1-red/[0.15] bg-gradient-to-b from-black/40 to-transparent">
        <span className="text-[10px] text-f1-red/80 drop-shadow-[0_0_4px_rgba(225,6,0,0.5)]">{icon}</span>
        <span className="text-[10px] font-display font-bold uppercase tracking-[0.2em] text-f1-text/80">
          {title}
        </span>
      </div>
      <div className="overflow-y-auto overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}
