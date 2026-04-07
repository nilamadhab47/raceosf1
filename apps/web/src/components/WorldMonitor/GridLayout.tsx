"use client";

/**
 * GridLayout — react-grid-layout based dashboard layout engine.
 *
 * Features:
 *   - Draggable + resizable panels (via react-grid-layout)
 *   - Snap-to-grid
 *   - Layout persistence in localStorage
 *   - Preset layouts (broadcast, analysis, compact)
 *   - TrackMap always center
 */

import { useState, useCallback, memo } from "react";
import {
  ResponsiveGridLayout,
  useContainerWidth,
  verticalCompactor,
  type LayoutItem,
  type Layout,
} from "react-grid-layout";
import { TrackCanvas, type LayerKey } from "./TrackCanvas";
import { LayerToggle } from "./LayerToggle";
import { TimelineBar } from "./TimelineBar";
import { PanelWrapper } from "./PanelWrapper";

// Existing panels
import { Leaderboard } from "@/components/Leaderboard/Leaderboard";
import { TelemetryChart } from "@/components/Telemetry/TelemetryChart";
import { InsightsPanel } from "@/components/Insights/InsightsPanel";
import { StrategySimulator } from "@/components/Strategy/StrategySimulator";
import { StintBar } from "@/components/Strategy/StintBar";
import { RaceUpdates } from "@/components/RaceControl/RaceUpdates";
import { GapEvolutionChart } from "@/components/Strategy/GapEvolutionChart";
import { TeamRadioPanel } from "@/components/RaceControl/TeamRadioPanel";
import { GPInfoPanel } from "@/components/Strategy/GPInfoPanel";
import { YouTubeHighlightsPanel } from "@/components/WorldMonitor/YouTubeHighlightsPanel";
import { ReplayPanel } from "@/components/WorldMonitor/ReplayPanel";
import { PanelErrorBoundary } from "@/components/shared/PanelErrorBoundary";
import { useSettingsStore, type PanelKey } from "@/store/settings-store";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

/* ── Layout Presets ───────────────────────────────────────────────── */

const COLS = { lg: 24, md: 18, sm: 12, xs: 6, xxs: 4 };
const ROW_HEIGHT = 30;
const LAYOUT_KEY = "f1-world-monitor-layout-v3";

// Default "broadcast" layout — large track in center
const BROADCAST_LAYOUT: LayoutItem[] = [
  { i: "track",       x: 5,  y: 0,  w: 14, h: 18, minW: 6, minH: 8 },
  { i: "leaderboard", x: 0,  y: 0,  w: 5,  h: 12, minW: 3, minH: 6 },
  { i: "race-control",x: 0,  y: 12, w: 5,  h: 6,  minW: 3, minH: 3 },
  { i: "telemetry",   x: 19, y: 0,  w: 5,  h: 8,  minW: 4, minH: 5 },
  { i: "strategy",    x: 19, y: 8,  w: 5,  h: 5,  minW: 4, minH: 3 },
  { i: "insights",    x: 19, y: 13, w: 5,  h: 5,  minW: 3, minH: 3 },
  { i: "gap-evo",     x: 5,  y: 18, w: 5,  h: 6,  minW: 4, minH: 4 },
  { i: "stints",      x: 10, y: 18, w: 5,  h: 6,  minW: 4, minH: 4 },
  { i: "team-radio",  x: 0,  y: 18, w: 5,  h: 6,  minW: 3, minH: 3 },
  { i: "gp-info",     x: 0,  y: 24, w: 5,  h: 5,  minW: 3, minH: 4 },
  { i: "youtube",     x: 15, y: 18, w: 9,  h: 8,  minW: 5, minH: 5 },
  { i: "replay",      x: 15, y: 26, w: 5,  h: 6,  minW: 3, minH: 3 },
];

// Analysis layout — smaller track, larger data panels
const ANALYSIS_LAYOUT: LayoutItem[] = [
  { i: "track",       x: 0,  y: 0,  w: 8,  h: 14, minW: 6, minH: 8 },
  { i: "leaderboard", x: 8,  y: 0,  w: 5,  h: 10, minW: 3, minH: 6 },
  { i: "telemetry",   x: 13, y: 0,  w: 11, h: 10, minW: 4, minH: 5 },
  { i: "strategy",    x: 8,  y: 10, w: 8,  h: 7,  minW: 4, minH: 3 },
  { i: "insights",    x: 16, y: 10, w: 8,  h: 7,  minW: 3, minH: 3 },
  { i: "race-control",x: 0,  y: 14, w: 8,  h: 6,  minW: 3, minH: 3 },
  { i: "gap-evo",     x: 0,  y: 20, w: 6,  h: 6,  minW: 4, minH: 4 },
  { i: "stints",      x: 6,  y: 20, w: 6,  h: 6,  minW: 4, minH: 4 },
  { i: "team-radio",  x: 12, y: 20, w: 4,  h: 6,  minW: 3, minH: 3 },
  { i: "gp-info",     x: 12, y: 26, w: 4,  h: 5,  minW: 3, minH: 4 },
  { i: "youtube",     x: 16, y: 17, w: 8,  h: 8,  minW: 5, minH: 5 },
  { i: "replay",      x: 16, y: 25, w: 5,  h: 6,  minW: 3, minH: 3 },
];

const PRESETS: Record<string, LayoutItem[]> = {
  broadcast: BROADCAST_LAYOUT,
  analysis: ANALYSIS_LAYOUT,
};

/* ── Helpers ──────────────────────────────────────────────────────── */

function loadLayout(): LayoutItem[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLayout(layout: LayoutItem[]): void {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch {}
}

/* ── Default layers ───────────────────────────────────────────────── */

const DEFAULT_LAYERS: Record<LayerKey, boolean> = {
  cars: true,
  labels: true,
  battles: true,
  racingLine: false,
  sectors: false,
  gaps: false,
  tyres: true,
};

/* ── GridLayout Component ─────────────────────────────────────────── */

export const GridLayout = memo(function GridLayout() {
  const [layout, setLayout] = useState<LayoutItem[]>(() => loadLayout() || BROADCAST_LAYOUT);
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [activePreset, setActivePreset] = useState<string>("broadcast");
  const { width, containerRef } = useContainerWidth({ initialWidth: 1280 });
  const visiblePanels = useSettingsStore((s) => s.visiblePanels);

  const toggleLayer = useCallback(
    (key: LayerKey) => setLayers((prev) => ({ ...prev, [key]: !prev[key] })),
    [],
  );

  const onLayoutChange = useCallback((newLayout: Layout) => {
    const items = [...newLayout] as LayoutItem[];
    setLayout(items);
    saveLayout(items);
  }, []);

  const applyPreset = useCallback((name: string) => {
    const preset = PRESETS[name];
    if (preset) {
      setLayout(preset);
      saveLayout(preset);
      setActivePreset(name);
    }
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-f1-border bg-f1-bg shrink-0">
        <span className="text-[9px] font-display font-bold uppercase tracking-[0.2em] text-f1-text-muted">
          Layout
        </span>
        {Object.keys(PRESETS).map((name) => (
          <button
            key={name}
            onClick={() => applyPreset(name)}
            className={`px-2.5 py-1 text-[10px] font-display font-bold uppercase tracking-wider rounded transition-colors ${
              activePreset === name
                ? "bg-f1-red/15 text-f1-red border border-f1-red/30"
                : "text-f1-text-muted hover:text-f1-text-dim hover:bg-white/5"
            }`}
          >
            {name}
          </button>
        ))}

        <div className="flex-1" />

        {/* Layer toggle popover */}
        <div className="relative group">
          <button className="px-2.5 py-1 text-[10px] font-display font-bold uppercase tracking-wider text-f1-text-muted hover:text-f1-text-dim hover:bg-white/5 rounded transition-colors">
            Layers ▾
          </button>
          <div className="absolute right-0 top-full mt-1 z-50 hidden group-hover:block">
            <LayerToggle layers={layers} toggle={toggleLayer} />
          </div>
        </div>
      </div>

      {/* Grid area */}
      <div
        className="flex-1 min-h-0 overflow-auto p-2"
        ref={containerRef}
      >
        <ResponsiveGridLayout
          className="layout"
          width={width}
          layouts={{ lg: layout.filter((item) => visiblePanels[item.i as PanelKey] !== false) }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={COLS}
          rowHeight={ROW_HEIGHT}
          compactor={verticalCompactor}
          dragConfig={{ handle: ".drag-handle" }}
          onLayoutChange={(newLayout) => onLayoutChange(newLayout)}
          margin={[8, 8]}
          containerPadding={[4, 4]}
        >
          {/* Track Map — center */}
          {visiblePanels["track"] && (
          <div key="track" data-tour="track" className="h-full">
            <PanelWrapper title="Track Map" icon="◉" noPadding hero>
              <PanelErrorBoundary fallbackTitle="Track Error">
                <TrackCanvas layers={layers} />
              </PanelErrorBoundary>
            </PanelWrapper>
          </div>
          )}

          {/* Leaderboard */}
          {visiblePanels["leaderboard"] && (
          <div key="leaderboard" data-tour="leaderboard" className="h-full">
            <PanelWrapper title="Leaderboard" icon="▮">
              <PanelErrorBoundary fallbackTitle="Leaderboard Error">
                <Leaderboard />
              </PanelErrorBoundary>
            </PanelWrapper>
          </div>
          )}

          {/* Race Updates */}
          {visiblePanels["race-control"] && (
          <div key="race-control" data-tour="race-control" className="h-full">
            <PanelWrapper title="Race Updates" icon="◈">
              <PanelErrorBoundary fallbackTitle="Race Updates Error">
                <RaceUpdates />
              </PanelErrorBoundary>
            </PanelWrapper>
          </div>
          )}

          {/* Telemetry */}
          {visiblePanels["telemetry"] && (
          <div key="telemetry" data-tour="telemetry" className="h-full">
            <PanelWrapper title="Telemetry" icon="◆">
              <PanelErrorBoundary fallbackTitle="Telemetry Error">
                <TelemetryChart />
              </PanelErrorBoundary>
            </PanelWrapper>
          </div>
          )}

          {/* Strategy */}
          {visiblePanels["strategy"] && (
          <div key="strategy" data-tour="strategy" className="h-full">
            <PanelWrapper title="Strategy" icon="▣">
              <PanelErrorBoundary fallbackTitle="Strategy Error">
                <StrategySimulator />
              </PanelErrorBoundary>
            </PanelWrapper>
          </div>
          )}

          {/* Insights */}
          {visiblePanels["insights"] && (
          <div key="insights" data-tour="insights" className="h-full">
            <PanelWrapper title="AI Insights" icon="●">
              <PanelErrorBoundary fallbackTitle="Insights Error">
                <InsightsPanel />
              </PanelErrorBoundary>
            </PanelWrapper>
          </div>
          )}

          {/* Gap Evolution */}
          {visiblePanels["gap-evo"] && (
          <div key="gap-evo" data-tour="gap-evo" className="h-full">
            <PanelWrapper title="Gap Evolution" icon="▲">
              <PanelErrorBoundary fallbackTitle="Gap Error">
                <GapEvolutionChart />
              </PanelErrorBoundary>
            </PanelWrapper>
          </div>
          )}

          {/* Stint Bars */}
          {visiblePanels["stints"] && (
          <div key="stints" data-tour="stints" className="h-full">
            <PanelWrapper title="Stints" icon="◎">
              <PanelErrorBoundary fallbackTitle="Stints Error">
                <StintBar />
              </PanelErrorBoundary>
            </PanelWrapper>
          </div>
          )}

          {/* Team Radio */}
          {visiblePanels["team-radio"] && (
          <div key="team-radio" data-tour="team-radio" className="h-full">
            <PanelWrapper title="Team Radio" icon="◇">
              <PanelErrorBoundary fallbackTitle="Team Radio Error">
                <TeamRadioPanel />
              </PanelErrorBoundary>
            </PanelWrapper>
          </div>
          )}

          {/* GP Info */}
          {visiblePanels["gp-info"] && (
          <div key="gp-info" data-tour="gp-info" className="h-full">
            <PanelWrapper title="GP Info" icon="⬡">
              <PanelErrorBoundary fallbackTitle="GP Info Error">
                <GPInfoPanel />
              </PanelErrorBoundary>
            </PanelWrapper>
          </div>
          )}

          {/* YouTube Highlights */}
          {visiblePanels["youtube"] && (
          <div key="youtube" data-tour="youtube" className="h-full">
            <PanelWrapper title="Highlights" icon="▶">
              <PanelErrorBoundary fallbackTitle="YouTube Error">
                <YouTubeHighlightsPanel />
              </PanelErrorBoundary>
            </PanelWrapper>
          </div>
          )}

          {/* Replay / Events */}
          {visiblePanels["replay"] && (
          <div key="replay" data-tour="replay" className="h-full">
            <PanelWrapper title="Events & Replay" icon="◀▶">
              <PanelErrorBoundary fallbackTitle="Replay Error">
                <ReplayPanel />
              </PanelErrorBoundary>
            </PanelWrapper>
          </div>
          )}
        </ResponsiveGridLayout>
      </div>

      {/* Timeline — always pinned to bottom */}
      <div className="shrink-0">
        <TimelineBar />
      </div>

    </div>
  );
});
