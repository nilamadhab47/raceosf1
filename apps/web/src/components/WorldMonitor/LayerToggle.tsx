"use client";

/**
 * LayerToggle — compact toggle panel for track visualization layers.
 */

import { memo, useCallback } from "react";
import type { LayerKey } from "./TrackCanvas";

interface LayerToggleProps {
  layers: Record<LayerKey, boolean>;
  toggle: (key: LayerKey) => void;
}

const LAYER_META: { key: LayerKey; icon: string; label: string }[] = [
  { key: "cars", icon: "🏎", label: "Cars" },
  { key: "labels", icon: "🏷", label: "Labels" },
  { key: "battles", icon: "⚔", label: "Battles" },
  { key: "racingLine", icon: "〰", label: "Racing Line" },
  { key: "sectors", icon: "📐", label: "Sectors" },
  { key: "gaps", icon: "⏱", label: "Gaps" },
  { key: "tyres", icon: "⭕", label: "Tyres" },
];

export const LayerToggle = memo(function LayerToggle({ layers, toggle }: LayerToggleProps) {
  return (
    <div className="glass-panel rounded-lg border border-f1-border p-1.5 flex flex-col gap-0.5">
      <span className="text-[8px] font-display font-bold uppercase tracking-[0.2em] text-f1-text-muted px-1 pb-0.5">
        Layers
      </span>
      {LAYER_META.map(({ key, icon, label }) => (
        <button
          key={key}
          onClick={() => toggle(key)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono transition-all ${
            layers[key]
              ? "bg-white/5 text-white"
              : "text-f1-text-muted hover:text-f1-text-dim hover:bg-white/[0.02]"
          }`}
        >
          <span className="text-xs">{icon}</span>
          <span>{label}</span>
          <span className={`ml-auto w-1.5 h-1.5 rounded-full ${layers[key] ? "bg-f1-red" : "bg-f1-text-muted/30"}`} />
        </button>
      ))}
    </div>
  );
});
