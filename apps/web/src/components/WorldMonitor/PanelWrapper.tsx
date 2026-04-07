"use client";

/**
 * PanelWrapper — transparent wrapper around grid panels for consistent styling.
 * Provides:
 *   - Glass morphism frame with red accent glow
 *   - Collapsible header with top accent line
 *   - Error boundary integration
 */

import { memo, ReactNode } from "react";

interface PanelWrapperProps {
  title: string;
  icon?: string;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
  hero?: boolean;
}

export const PanelWrapper = memo(function PanelWrapper({
  title,
  icon,
  children,
  className = "",
  noPadding = false,
  hero = false,
}: PanelWrapperProps) {
  return (
    <div className={`h-full flex flex-col ${hero ? "glass-panel-hero" : "glass-panel"} overflow-hidden ${className}`}>
      {/* Top accent line — bright red scan line */}
      <div className={`h-[2px] ${hero ? "bg-gradient-to-r from-transparent via-f1-red/70 to-transparent" : "bg-gradient-to-r from-transparent via-f1-red/50 to-transparent"}`} />
      {/* Header — dark strip */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-f1-red/[0.15] shrink-0 select-none bg-gradient-to-b from-black/40 to-transparent">
        <div className="flex items-center gap-2 cursor-grab active:cursor-grabbing drag-handle">
          <span className="text-[9px] text-f1-text-muted/40 leading-none">⋮⋮</span>
          {icon && <span className="text-[10px] text-f1-red/80 drop-shadow-[0_0_4px_rgba(225,6,0,0.5)]">{icon}</span>}
          <span className="text-[10px] font-display font-bold uppercase tracking-[0.2em] text-f1-text/80">
            {title}
          </span>
        </div>
      </div>
      {/* Body */}
      <div className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden ${noPadding ? "" : ""}`}>
        {children}
      </div>
    </div>
  );
});
