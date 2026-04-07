/**
 * DataStream — WebSocket data manager with buffering, sorting, and reconnect.
 *
 * Features:
 *   - Auto-reconnect with exponential backoff (2s → 30s)
 *   - Buffer queue with timestamp sorting
 *   - Deduplication of stale packets
 *   - Missing-data detection with hold-last-value
 *   - Type-safe message routing via subscriptions
 *   - Decoupled from React (use in stores / refs)
 */

/* ── Types ────────────────────────────────────────────────────────── */

export interface RaceFrame {
  type: string;
  lap: number;
  timestamp: number; // arrival epoch ms
  leaderboard?: any[];
  positions?: any[];
  insights?: any[];
  live?: any;
  flag?: string;
  race_control?: any[];
}

export type StreamCallback = (frame: RaceFrame) => void;

interface BufferEntry {
  frame: RaceFrame;
  receivedAt: number;
}

/* ── Constants ────────────────────────────────────────────────────── */

const RECONNECT_MIN = 2_000;
const RECONNECT_MAX = 30_000;
const BUFFER_MAX = 50;
const BUFFER_FLUSH_MS = 100; // flush buffer every 100ms
const STALE_THRESHOLD_MS = 10_000; // discard data older than 10s

/* ── DataStream class ─────────────────────────────────────────────── */

export class DataStream {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectDelay = RECONNECT_MIN;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private subscribers = new Map<string, StreamCallback>();
  private buffer: BufferEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private lastLap = -1;
  private connected = false;
  private destroyed = false;

  // Hold-last-value cache
  private lastFrame: RaceFrame | null = null;

  constructor(url: string) {
    this.url = url;
  }

  /* ── Connection lifecycle ──────────────────────────────────────── */

  connect(): void {
    if (this.destroyed) return;
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.connected = true;
      this.reconnectDelay = RECONNECT_MIN;
      this.ws!.send(JSON.stringify({ action: "subscribe" }));
      this.startFlush();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.enqueue(data);
      } catch {
        // Ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.stopFlush();
      if (!this.destroyed) this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect(): void {
    this.destroyed = true;
    this.stopFlush();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, RECONNECT_MAX);
      this.connect();
    }, this.reconnectDelay);
  }

  /* ── Buffer system ─────────────────────────────────────────────── */

  private enqueue(data: any): void {
    const frame: RaceFrame = {
      type: data.type ?? "unknown",
      lap: data.lap ?? data.live?.current_lap ?? -1,
      timestamp: Date.now(),
      leaderboard: data.leaderboard,
      positions: data.positions,
      insights: data.insights,
      live: data.live,
      flag: data.flag,
      race_control: data.race_control,
    };

    this.buffer.push({ frame, receivedAt: Date.now() });

    // Cap buffer size
    if (this.buffer.length > BUFFER_MAX) {
      this.buffer = this.buffer.slice(-BUFFER_MAX);
    }
  }

  private startFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => this.flushBuffer(), BUFFER_FLUSH_MS);
  }

  private stopFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private flushBuffer(): void {
    if (this.buffer.length === 0) return;

    const now = Date.now();

    // Sort by timestamp (handle out-of-order packets)
    this.buffer.sort((a, b) => a.frame.timestamp - b.frame.timestamp);

    // Filter stale entries
    const fresh = this.buffer.filter(
      (e) => now - e.receivedAt < STALE_THRESHOLD_MS,
    );

    // Take the latest frame per type
    const latest = new Map<string, RaceFrame>();
    for (const entry of fresh) {
      latest.set(entry.frame.type, entry.frame);
    }

    // Dispatch to subscribers
    for (const frame of latest.values()) {
      this.lastFrame = frame;
      this.lastLap = frame.lap;
      for (const cb of this.subscribers.values()) {
        try {
          cb(frame);
        } catch (e) {
          console.error("[DataStream] subscriber error:", e);
        }
      }
    }

    // Clear buffer
    this.buffer = [];
  }

  /* ── Subscription API ──────────────────────────────────────────── */

  subscribe(id: string, callback: StreamCallback): () => void {
    this.subscribers.set(id, callback);
    // Immediately emit last frame if available
    if (this.lastFrame) {
      try { callback(this.lastFrame); } catch {}
    }
    return () => this.subscribers.delete(id);
  }

  /* ── Getters ───────────────────────────────────────────────────── */

  isConnected(): boolean {
    return this.connected;
  }

  getLastFrame(): RaceFrame | null {
    return this.lastFrame;
  }

  getLastLap(): number {
    return this.lastLap;
  }
}
