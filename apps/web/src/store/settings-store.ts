import { create } from "zustand";
import { persist } from "zustand/middleware";

/** All panel keys that can be toggled on/off */
export const PANEL_KEYS = [
  "track",
  "leaderboard",
  "race-control",
  "telemetry",
  "strategy",
  "insights",
  "gap-evo",
  "stints",
  "team-radio",
  "gp-info",
  "youtube",
  "replay",
] as const;

export type PanelKey = (typeof PANEL_KEYS)[number];

export const PANEL_LABELS: Record<PanelKey, string> = {
  track: "Track Map",
  leaderboard: "Leaderboard",
  "race-control": "Race Updates",
  telemetry: "Telemetry",
  strategy: "Strategy",
  insights: "AI Insights",
  "gap-evo": "Gap Evolution",
  stints: "Stints",
  "team-radio": "Team Radio",
  "gp-info": "GP Info",
  youtube: "Highlights",
  replay: "Events & Replay",
};

export const PANEL_ICONS: Record<PanelKey, string> = {
  track: "◉",
  leaderboard: "▮",
  "race-control": "◈",
  telemetry: "◆",
  strategy: "▣",
  insights: "●",
  "gap-evo": "▲",
  stints: "◎",
  "team-radio": "◇",
  "gp-info": "⬡",
  youtube: "▶",
  replay: "◀▶",
};

interface SettingsState {
  /** Which panels are visible */
  visiblePanels: Record<PanelKey, boolean>;
  /** Whether the settings modal is open */
  isOpen: boolean;

  togglePanel: (key: PanelKey) => void;
  setPanelVisible: (key: PanelKey, visible: boolean) => void;
  showAll: () => void;
  hideAll: () => void;
  openSettings: () => void;
  closeSettings: () => void;
}

const defaultVisible: Record<PanelKey, boolean> = Object.fromEntries(
  PANEL_KEYS.map((k) => [k, true]),
) as Record<PanelKey, boolean>;

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      visiblePanels: { ...defaultVisible },
      isOpen: false,

      togglePanel: (key) =>
        set((s) => ({
          visiblePanels: { ...s.visiblePanels, [key]: !s.visiblePanels[key] },
        })),

      setPanelVisible: (key, visible) =>
        set((s) => ({
          visiblePanels: { ...s.visiblePanels, [key]: visible },
        })),

      showAll: () => set({ visiblePanels: { ...defaultVisible } }),

      hideAll: () =>
        set({
          visiblePanels: Object.fromEntries(
            PANEL_KEYS.map((k) => [k, false]),
          ) as Record<PanelKey, boolean>,
        }),

      openSettings: () => set({ isOpen: true }),
      closeSettings: () => set({ isOpen: false }),
    }),
    {
      name: "f1-settings",
      partialize: (s) => ({ visiblePanels: s.visiblePanels }),
    },
  ),
);
