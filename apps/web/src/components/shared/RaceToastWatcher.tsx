"use client";

import { useRaceToasts } from "@/components/shared/ToastSystem";

/** Mounts the race event toast watcher. Place inside ToastProvider. */
export function RaceToastWatcher() {
  useRaceToasts();
  return null;
}
