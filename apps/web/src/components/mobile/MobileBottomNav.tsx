"use client";

import { memo } from "react";

export type TabKey = "race" | "data" | "strategy" | "feed";

interface Tab {
  key: TabKey;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { key: "race", label: "Race", icon: "◉" },
  { key: "data", label: "Data", icon: "◆" },
  { key: "strategy", label: "Strategy", icon: "▣" },
  { key: "feed", label: "Feed", icon: "◈" },
];

interface MobileBottomNavProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

const MobileBottomNavInner = ({ activeTab, onTabChange }: MobileBottomNavProps) => {
  return (
    <nav className="shrink-0 relative bg-f1-surface/95 backdrop-blur-md border-t border-f1-red/[0.15]">
      {/* Top accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-f1-red/30 to-transparent" />

      <div className="flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`flex flex-col items-center gap-0.5 py-2 px-4 min-w-[60px] transition-all active:scale-95 ${
                isActive ? "text-f1-red" : "text-f1-text-muted"
              }`}
            >
              {/* Active indicator dot */}
              <div className={`w-1 h-1 rounded-full mb-0.5 transition-all ${
                isActive ? "bg-f1-red shadow-glow-red scale-100" : "bg-transparent scale-0"
              }`} />
              <span className={`text-sm transition-all ${
                isActive ? "drop-shadow-[0_0_8px_rgba(225,6,0,0.6)]" : ""
              }`}>
                {tab.icon}
              </span>
              <span className={`text-[9px] font-display font-bold uppercase tracking-[0.15em] transition-colors ${
                isActive ? "text-f1-red" : "text-f1-text-muted"
              }`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export const MobileBottomNav = memo(MobileBottomNavInner);
