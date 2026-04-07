"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useF1Store } from "@/store/f1-store";
import { useTimeline } from "@/engines/Timeline";
import { useEventEngine } from "@/engines/EventEngine";
import { Radio } from "lucide-react";

interface RadioMessage {
  driver: string;
  team_color: string;
  message: string;
  lap: number;
  timestamp: number;
}

// Simulated radio excerpts for demo/simulation mode
const SIM_MESSAGES: Omit<RadioMessage, "timestamp">[] = [
  { driver: "VER", team_color: "#3671C6", message: "Good start, good start. Keep it clean.", lap: 1 },
  { driver: "HAM", team_color: "#27F4D2", message: "OK copy, we're P6. Let's build from here.", lap: 2 },
  { driver: "NOR", team_color: "#FF8000", message: "He moved under braking! That's not fair.", lap: 3 },
  { driver: "LEC", team_color: "#E8002D", message: "Watch the front tyres, Charles. Manage.", lap: 5 },
  { driver: "RUS", team_color: "#27F4D2", message: "Pace feels good. Can we push now?", lap: 7 },
  { driver: "SAI", team_color: "#E8002D", message: "Blue flags! He's not moving, come on!", lap: 9 },
  { driver: "PIA", team_color: "#FF8000", message: "DRS is enabled. I see Leclerc ahead.", lap: 10 },
  { driver: "ALO", team_color: "#229971", message: "GP, what is our target lap time?", lap: 12 },
  { driver: "VER", team_color: "#3671C6", message: "Box box, box box.", lap: 15 },
  { driver: "HAM", team_color: "#27F4D2", message: "Tyres are gone, mate.", lap: 18 },
  { driver: "LEC", team_color: "#E8002D", message: "What happened? What happened?!", lap: 22 },
  { driver: "NOR", team_color: "#FF8000", message: "Give me the gap to Verstappen.", lap: 25 },
  { driver: "PIA", team_color: "#FF8000", message: "These mediums feel really good.", lap: 28 },
  { driver: "SAI", team_color: "#E8002D", message: "Smooth operator, smooth operator...", lap: 32 },
  { driver: "RUS", team_color: "#27F4D2", message: "We need to push now. Push push.", lap: 36 },
  { driver: "VER", team_color: "#3671C6", message: "Simply lovely. Great pace.", lap: 40 },
  { driver: "ALO", team_color: "#229971", message: "GP, what is our target?", lap: 44 },
  { driver: "HAM", team_color: "#27F4D2", message: "Get in there! Yes!", lap: 50 },
];

export function TeamRadioPanel() {
  const mode = useF1Store((s) => s.mode);
  const { currentLap } = useTimeline();
  const activeEvents = useEventEngine((s) => s.activeEvents);
  const [messages, setMessages] = useState<RadioMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Drivers involved in active events (auto-highlight)
  const highlightedDrivers = useMemo(() => {
    const set = new Set<string>();
    for (const e of activeEvents) {
      for (const d of e.drivers) set.add(d);
    }
    return set;
  }, [activeEvents]);

  // In simulation mode, show messages up to current lap
  useEffect(() => {
    if (mode === "live") return;
    const visible = SIM_MESSAGES.filter((m) => m.lap <= currentLap).map(
      (m, i) => ({ ...m, timestamp: Date.now() - (SIM_MESSAGES.length - i) * 10000 })
    );
    setMessages(visible);
  }, [mode, currentLap]);

  // In live mode, poll team radio endpoint
  useEffect(() => {
    if (mode !== "live") return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/live-pulse/team-radio`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.messages)) {
          setMessages(
            data.messages.map((m: Record<string, string | number>) => ({
              driver: m.driver || "???",
              team_color: m.team_color || "#666",
              message: m.message || "",
              lap: m.lap || 0,
              timestamp: m.timestamp || Date.now(),
            }))
          );
        }
      } catch {
        // Silently fail — endpoint may not be available
      }
    };

    poll();
    const interval = setInterval(poll, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [mode]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-f1-border flex items-center gap-2 shrink-0">
        <Radio className="w-3.5 h-3.5 text-f1-amber" />
        <span className="text-[13px] font-display uppercase tracking-wider text-f1-text-dim">
          Team Radio
        </span>
        {mode === "live" && (
          <span className="ml-auto text-[13px] font-mono text-f1-red uppercase tracking-wider animate-pulse">
            ● Live
          </span>
        )}
        {mode !== "live" && (
          <span className="ml-auto text-[13px] font-mono text-white/20 uppercase tracking-wider">
            Sim
          </span>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[13px] text-f1-text-dim font-body">
            No radio messages yet
          </div>
        ) : (
          <div className="p-2 space-y-1.5">
            {messages.map((msg, i) => (
              <div
                key={`${msg.driver}-${msg.lap}-${i}`}
                className={`flex items-start gap-2 group ${
                  highlightedDrivers.has(msg.driver)
                    ? "ring-1 ring-f1-amber/40 bg-f1-amber/5 rounded-lg px-1 py-0.5"
                    : ""
                }`}
              >
                {/* Driver tag */}
                <div
                  className="shrink-0 px-1.5 py-0.5 rounded text-[13px] font-mono font-bold text-white/90 mt-0.5"
                  style={{ backgroundColor: `#${msg.team_color.replace("#", "")}` }}
                >
                  {msg.driver}
                </div>
                {/* Message */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-body text-white/80 leading-tight">
                    &ldquo;{msg.message}&rdquo;
                  </p>
                  <span className="text-[13px] font-mono text-white/20">
                    Lap {msg.lap}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
