"use client";

import { memo } from "react";
import type { LayerKey } from "./TrackEngine";

interface LayerToggleProps {
  layers: Record<LayerKey, boolean>;
  toggle: (key: LayerKey) => void;
}

const LAYER_CONFIG: { key: LayerKey; label: string; icon: string }[] = [
  { key: "cars", label: "Cars", icon: "🏎" },
  { key: "labels", label: "Labels", icon: "🏷" },
  { key: "battles", label: "Battles", icon: "⚔" },
  { key: "racingLine", label: "Racing Line", icon: "〰" },
  { key: "sectors", label: "Sectors", icon: "📐" },
  { key: "gaps", label: "Gaps", icon: "⏱" },
  { key: "tyres", label: "Tyres", icon: "⭕" },
];

export const LayerToggle = memo(function LayerToggle({
  layers,
  toggle,
}: LayerToggleProps) {
  return (
    <div className="glass-panel rounded-xl p-2 flex flex-col gap-1">
      <span className="text-[9px] font-display font-bold uppercase tracking-[0.2em] text-f1-text-muted px-2 py-1">
        Layers
      </span>
      {LAYER_CONFIG.map(({ key, label, icon }) => (
        <button
          key={key}
          onClick={() => toggle(key)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
            layers[key]
              ? "bg-white/10 text-white"
              : "text-f1-text-muted hover:text-f1-text-dim hover:bg-white/5"
          }`}
        >
          <span className="text-sm">{icon}</span>
          <span>{label}</span>
          <div
            className={`ml-auto w-2 h-2 rounded-full ${
              layers[key] ? "bg-f1-green" : "bg-f1-text-muted/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
});
