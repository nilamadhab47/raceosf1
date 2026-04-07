/**
 * DirectorEngine — intelligent auto-camera director with context memory.
 *
 * Priority-based event selection with engagement scoring and continuity bonuses.
 * Prevents flickering by enforcing minimum hold times and cooldowns.
 * Produces camera commands consumed by CameraEngine.
 *
 * Priority: incident(1) > battle(2) > overtake(3) > fastest_lap(4) > leader(5)
 */

import type { RaceEvent, RaceEventType } from "./EventEngine";

/* ── Types ────────────────────────────────────────────────────────── */

export interface DirectorCommand {
  mode: "follow" | "battle" | "overview";
  targetDriver: string | null;
  targetDrivers: string[];
  reason: string;
  eventId: string | null;
}

interface DirectorContext {
  lastFocusedDriver: string | null;
  lastEventType: RaceEventType | null;
  lastEventId: string | null;
  currentHoldStart: number;           // performance.now()
  driverEngagement: Map<string, number>; // driver → cumulative ms watched
  eventCooldowns: Map<string, number>;   // eventId → cooldown-until timestamp
}

/* ── Constants ────────────────────────────────────────────────────── */

const PRIORITY: Record<RaceEventType, number> = {
  incident: 1,
  battle: 2,
  overtake: 3,
  fastest_lap: 4,
  pit_stop: 5,
};

const HOLD_TIME_MS: Record<RaceEventType, number> = {
  incident: 8000,
  battle: 6000,
  overtake: 5000,
  fastest_lap: 4000,
  pit_stop: 3000,
};

const COOLDOWN_MS = 10_000; // don't re-focus same event within 10s
const CONTINUITY_BONUS = 2;  // priority boost if current driver is involved
const ENGAGEMENT_DECAY_THRESHOLD = 15_000; // shift focus after 15s no events
const LEADER_DRIVER = "P1"; // sentinel for "follow the race leader"

/* ── Director class (stateful, not Zustand — used imperatively in rAF) ─── */

export class Director {
  private ctx: DirectorContext = {
    lastFocusedDriver: null,
    lastEventType: null,
    lastEventId: null,
    currentHoldStart: 0,
    driverEngagement: new Map(),
    eventCooldowns: new Map(),
  };

  private currentCommand: DirectorCommand = {
    mode: "overview",
    targetDriver: null,
    targetDrivers: [],
    reason: "init",
    eventId: null,
  };

  /**
   * Evaluate active events and produce a camera command.
   * Called every frame (or throttled to ~10Hz for efficiency).
   *
   * @param activeEvents - events within the active window (from EventEngine)
   * @param leaderDriver - current P1 driver code (fallback target)
   * @param dt - frame delta in ms
   */
  evaluate(
    activeEvents: RaceEvent[],
    leaderDriver: string | null,
    dt: number,
  ): DirectorCommand {
    const now = performance.now();

    // Track engagement for current focus
    if (this.ctx.lastFocusedDriver) {
      const prev = this.ctx.driverEngagement.get(this.ctx.lastFocusedDriver) ?? 0;
      this.ctx.driverEngagement.set(this.ctx.lastFocusedDriver, prev + dt);
    }

    // Check if current hold time hasn't elapsed
    const holdTime = this.ctx.lastEventType
      ? (HOLD_TIME_MS[this.ctx.lastEventType] ?? 3000)
      : 0;
    const holdElapsed = now - this.ctx.currentHoldStart;
    if (holdElapsed < holdTime && this.ctx.lastEventId) {
      // Still within hold time — don't switch unless higher priority
      const currentPriority = this.ctx.lastEventType
        ? PRIORITY[this.ctx.lastEventType]
        : 99;

      const higherPriorityEvent = activeEvents.find((e) => {
        const p = PRIORITY[e.type] ?? 99;
        return p < currentPriority && !this.isOnCooldown(e.id, now);
      });

      if (!higherPriorityEvent) {
        return this.currentCommand;
      }
      // Higher priority breaks hold — fall through to selection
    }

    // Prune expired cooldowns
    for (const [id, until] of this.ctx.eventCooldowns) {
      if (now > until) this.ctx.eventCooldowns.delete(id);
    }

    // Score and rank candidate events
    const candidates = activeEvents
      .filter((e) => !this.isOnCooldown(e.id, now))
      .map((e) => {
        let score = 100 - (PRIORITY[e.type] ?? 50) * 10; // base: lower priority number = higher score

        // Severity bonus
        if (e.severity === "high") score += 15;
        else if (e.severity === "medium") score += 5;

        // Continuity bonus: if current focused driver is involved
        if (
          this.ctx.lastFocusedDriver &&
          e.drivers.includes(this.ctx.lastFocusedDriver)
        ) {
          score += CONTINUITY_BONUS * 10;
        }

        // Same-pair suppression: if same drivers were just focused
        if (
          this.ctx.lastEventType === e.type &&
          e.drivers.length > 0 &&
          e.drivers[0] === this.ctx.lastFocusedDriver
        ) {
          score -= 10;
        }

        return { event: e, score };
      })
      .sort((a, b) => b.score - a.score);

    if (candidates.length > 0) {
      const best = candidates[0].event;
      const command = this.eventToCommand(best);

      // Set cooldown on the event we're leaving
      if (this.ctx.lastEventId && this.ctx.lastEventId !== best.id) {
        this.ctx.eventCooldowns.set(this.ctx.lastEventId, now + COOLDOWN_MS);
      }

      // Update context
      this.ctx.lastEventType = best.type;
      this.ctx.lastEventId = best.id;
      this.ctx.lastFocusedDriver = command.targetDriver || (command.targetDrivers[0] ?? null);
      this.ctx.currentHoldStart = now;
      this.currentCommand = command;
      return command;
    }

    // No active events — check engagement decay
    if (holdElapsed > ENGAGEMENT_DECAY_THRESHOLD || !this.ctx.lastEventId) {
      // Fall back to leader
      if (leaderDriver) {
        const cmd: DirectorCommand = {
          mode: "follow",
          targetDriver: leaderDriver,
          targetDrivers: [],
          reason: "leader fallback",
          eventId: null,
        };
        this.ctx.lastFocusedDriver = leaderDriver;
        this.ctx.lastEventType = null;
        this.ctx.lastEventId = null;
        this.ctx.currentHoldStart = now;
        this.currentCommand = cmd;
        return cmd;
      }

      // No leader data — overview
      const cmd: DirectorCommand = {
        mode: "overview",
        targetDriver: null,
        targetDrivers: [],
        reason: "no events — overview",
        eventId: null,
      };
      this.currentCommand = cmd;
      return cmd;
    }

    // Within engagement threshold and no new events — keep current
    return this.currentCommand;
  }

  /** Reset all context (on session change) */
  reset(): void {
    this.ctx = {
      lastFocusedDriver: null,
      lastEventType: null,
      lastEventId: null,
      currentHoldStart: 0,
      driverEngagement: new Map(),
      eventCooldowns: new Map(),
    };
    this.currentCommand = {
      mode: "overview",
      targetDriver: null,
      targetDrivers: [],
      reason: "reset",
      eventId: null,
    };
  }

  getCurrentCommand(): DirectorCommand {
    return this.currentCommand;
  }

  private isOnCooldown(eventId: string, now: number): boolean {
    const until = this.ctx.eventCooldowns.get(eventId);
    return until !== undefined && now < until;
  }

  private eventToCommand(event: RaceEvent): DirectorCommand {
    if (event.type === "battle" && event.drivers.length >= 2) {
      return {
        mode: "battle",
        targetDriver: null,
        targetDrivers: [event.drivers[0], event.drivers[1]],
        reason: event.message,
        eventId: event.id,
      };
    }

    return {
      mode: "follow",
      targetDriver: event.drivers[0] || null,
      targetDrivers: [],
      reason: event.message,
      eventId: event.id,
    };
  }
}

/** Singleton director instance — used in TrackCanvas rAF loop */
export const director = new Director();
