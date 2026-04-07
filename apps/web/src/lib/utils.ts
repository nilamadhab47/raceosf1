import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatLapTime(seconds: number): string {
  if (!seconds || seconds <= 0) return "--:--.---";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, "0")}`;
}

export function formatGap(gap: number | null): string {
  if (gap === null || gap === undefined) return "";
  if (gap === 0) return "LEADER";
  return `+${gap.toFixed(3)}`;
}

export function getCompoundClass(compound: string): string {
  const c = compound?.toUpperCase();
  if (c === "SOFT") return "compound-soft";
  if (c === "MEDIUM") return "compound-medium";
  if (c === "HARD") return "compound-hard";
  if (c === "INTERMEDIATE") return "compound-intermediate";
  if (c === "WET") return "compound-wet";
  return "";
}

export function getCompoundEmoji(compound: string): string {
  const c = compound?.toUpperCase();
  if (c === "SOFT") return "🔴";
  if (c === "MEDIUM") return "🟡";
  if (c === "HARD") return "⚪";
  if (c === "INTERMEDIATE") return "🟢";
  if (c === "WET") return "🔵";
  return "⚫";
}
