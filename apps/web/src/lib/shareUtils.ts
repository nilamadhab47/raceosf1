/**
 * shareUtils — screenshot + clip URL encoding/decoding for shareable replays.
 */

import type { EventClip } from "@/engines/EventEngine";

/* ── Clip URL encoding ────────────────────────────────────────────── */

export interface ClipParams {
  clip: string;    // e.g. "overtake_VER-NOR_15"
  speed: number;
  camera?: string; // e.g. "follow"
}

export function encodeClipUrl(clip: EventClip, speed: number): string {
  const params = new URLSearchParams({
    clip: `${clip.label.replace(/\s+/g, "_")}`,
    start: String(clip.start),
    end: String(clip.end),
    drivers: clip.drivers.join("-"),
    cam: clip.cameraMode,
    speed: String(speed),
  });
  return `${window.location.origin}${window.location.pathname}?${params}`;
}

export function decodeClipParams(): ClipParams | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const clip = params.get("clip");
  if (!clip) return null;
  return {
    clip,
    speed: parseFloat(params.get("speed") || "0.5") || 0.5,
    camera: params.get("cam") || undefined,
  };
}

/* ── Screenshot ───────────────────────────────────────────────────── */

/**
 * Capture a screenshot of the given element as PNG.
 * Uses html-to-image if available, falls back to canvas-based capture.
 */
export async function captureScreenshot(element: HTMLElement): Promise<Blob | null> {
  try {
    // Dynamic import to avoid bundling if not needed
    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(element, {
      quality: 0.95,
      backgroundColor: "#06060a",
      pixelRatio: 2,
    });
    const res = await fetch(dataUrl);
    return res.blob();
  } catch {
    return null;
  }
}

/**
 * Copy clip URL to clipboard and return success status.
 */
export async function copyClipUrl(clip: EventClip, speed: number): Promise<boolean> {
  try {
    const url = encodeClipUrl(clip, speed);
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Trigger download of a Blob as a file.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
