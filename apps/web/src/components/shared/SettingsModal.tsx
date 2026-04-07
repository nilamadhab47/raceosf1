"use client";

import { memo, useCallback, useEffect } from "react";
import {
  useSettingsStore,
  PANEL_KEYS,
  PANEL_LABELS,
  PANEL_ICONS,
  type PanelKey,
} from "@/store/settings-store";

export const SettingsModal = memo(function SettingsModal() {
  const { isOpen, closeSettings, visiblePanels, togglePanel, showAll, hideAll } =
    useSettingsStore();

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSettings();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, closeSettings]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) closeSettings();
    },
    [closeSettings],
  );

  if (!isOpen) return null;

  const enabledCount = Object.values(visiblePanels).filter(Boolean).length;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-md glass-panel-raised border border-f1-red/20 shadow-panel-hero overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-f1-red/[0.15] bg-gradient-to-b from-black/40 to-transparent">
          <div>
            <h2 className="text-sm font-display font-bold uppercase tracking-[0.2em] text-f1-text">
              Settings
            </h2>
            <p className="text-[11px] text-f1-text-muted mt-0.5">
              {enabledCount} of {PANEL_KEYS.length} panels visible
            </p>
          </div>
          <button
            onClick={closeSettings}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-f1-text-dim hover:text-white hover:bg-white/5 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Panel toggles */}
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-display font-bold uppercase tracking-[0.2em] text-f1-text-muted">
              Panels
            </span>
            <div className="flex gap-2">
              <button
                onClick={showAll}
                className="text-[10px] font-display font-bold uppercase tracking-wider px-2 py-0.5 rounded text-f1-text-dim hover:text-f1-text hover:bg-white/5 transition-colors"
              >
                Show All
              </button>
              <button
                onClick={hideAll}
                className="text-[10px] font-display font-bold uppercase tracking-wider px-2 py-0.5 rounded text-f1-text-dim hover:text-f1-text hover:bg-white/5 transition-colors"
              >
                Hide All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {PANEL_KEYS.map((key) => (
              <PanelToggleRow
                key={key}
                panelKey={key}
                label={PANEL_LABELS[key]}
                icon={PANEL_ICONS[key]}
                enabled={visiblePanels[key]}
                onToggle={togglePanel}
              />
            ))}
          </div>
        </div>

        {/* Footer hint */}
        <div className="px-5 py-3 border-t border-f1-red/[0.08] bg-black/20">
          <p className="text-[10px] text-f1-text-muted text-center">
            Hidden panels are removed from the grid. Layout auto-adjusts.
          </p>
        </div>
      </div>
    </div>
  );
});

/* ── Toggle Row ── */

function PanelToggleRow({
  panelKey,
  label,
  icon,
  enabled,
  onToggle,
}: {
  panelKey: PanelKey;
  label: string;
  icon: string;
  enabled: boolean;
  onToggle: (key: PanelKey) => void;
}) {
  return (
    <button
      onClick={() => onToggle(panelKey)}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all text-left ${
        enabled
          ? "border-f1-red/25 bg-f1-red/[0.06] hover:bg-f1-red/[0.1]"
          : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] opacity-50"
      }`}
    >
      <span className={`text-xs ${enabled ? "text-f1-red/80" : "text-f1-text-muted"}`}>
        {icon}
      </span>
      <span
        className={`text-[11px] font-display font-bold uppercase tracking-wider ${
          enabled ? "text-f1-text" : "text-f1-text-muted"
        }`}
      >
        {label}
      </span>
      {/* Toggle indicator */}
      <div className="ml-auto">
        <div
          className={`w-8 h-4 rounded-full relative transition-colors ${
            enabled ? "bg-f1-red/30" : "bg-white/10"
          }`}
        >
          <div
            className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${
              enabled ? "left-4 bg-f1-red shadow-glow-red" : "left-0.5 bg-f1-text-muted"
            }`}
          />
        </div>
      </div>
    </button>
  );
}
