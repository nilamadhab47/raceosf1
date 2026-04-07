"use client";

import { memo, useMemo } from "react";
import { useF1Store } from "@/store/f1-store";
import { getCircuitInfo } from "@/lib/circuitData";
import { MapPin, Thermometer, Timer, ArrowUpDown, Disc, Target, Calendar, Info } from "lucide-react";

const GPInfoPanelInner = () => {
  const session = useF1Store((s) => s.session);

  const circuit = useMemo(() => {
    if (!session) return null;
    // Try circuit name first, then GP name
    return getCircuitInfo(session.circuit) || getCircuitInfo(session.name);
  }, [session]);

  if (!session) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 py-3 border-b border-f1-border-solid">
          <h2 className="text-xs font-display font-bold uppercase tracking-[0.2em] text-f1-text-dim">
            GP Information
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-f1-text-dim">Load a session to view GP info</p>
        </div>
      </div>
    );
  }

  if (!circuit) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 py-3 border-b border-f1-border-solid">
          <h2 className="text-xs font-display font-bold uppercase tracking-[0.2em] text-f1-text-dim">
            GP Information
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="text-2xl mb-2">🏁</div>
            <p className="text-xs text-f1-text-dim">{session.name}</p>
            <p className="text-[10px] text-white/20 mt-1">Circuit data not available</p>
          </div>
        </div>
      </div>
    );
  }

  const overtakingColor = circuit.overtaking === "High" ? "text-f1-green" : circuit.overtaking === "Medium" ? "text-f1-amber" : "text-f1-red";
  const tyreWearColor = circuit.tyre_wear === "High" ? "text-f1-red" : circuit.tyre_wear === "Medium" ? "text-f1-amber" : "text-f1-green";

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-f1-border-solid">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-display font-bold uppercase tracking-[0.2em] text-f1-text-dim">
            GP Information
          </h2>
          <span className="text-[9px] font-mono text-f1-text-muted">
            Est. {circuit.first_gp}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Circuit Header */}
        <div>
          <div className="text-sm font-display font-bold text-white">{circuit.name}</div>
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 text-white/30" />
            <span className="text-[10px] text-white/40">{circuit.city}, {circuit.country}</span>
          </div>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-3 gap-1.5">
          <MiniStat icon={<Timer className="w-3 h-3" />} label="Length" value={`${circuit.length_km}km`} />
          <MiniStat icon={<Target className="w-3 h-3" />} label="Turns" value={String(circuit.turns)} />
          <MiniStat icon={<ArrowUpDown className="w-3 h-3" />} label="DRS" value={`${circuit.drs_zones} zones`} />
        </div>

        {/* Racing Characteristics */}
        <div className="space-y-1">
          <div className="text-[10px] font-display font-bold uppercase tracking-wider text-f1-text-dim">Racing Character</div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-white/30 w-20">Overtaking</span>
            <span className={`font-mono font-bold ${overtakingColor}`}>{circuit.overtaking}</span>
            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: circuit.overtaking === "High" ? "85%" : circuit.overtaking === "Medium" ? "55%" : "25%",
                  background: circuit.overtaking === "High" ? "#00ff88" : circuit.overtaking === "Medium" ? "#ffaa00" : "#ff3333",
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-white/30 w-20">Tyre Wear</span>
            <span className={`font-mono font-bold ${tyreWearColor}`}>{circuit.tyre_wear}</span>
            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: circuit.tyre_wear === "High" ? "85%" : circuit.tyre_wear === "Medium" ? "55%" : "25%",
                  background: circuit.tyre_wear === "High" ? "#ff3333" : circuit.tyre_wear === "Medium" ? "#ffaa00" : "#00ff88",
                }}
              />
            </div>
          </div>
          <div className="text-[10px] mt-1 text-white/30">{circuit.track_type}</div>
        </div>

        {/* Weather */}
        <div className="rounded-lg p-2.5 bg-white/[0.02] border border-f1-border-solid">
          <div className="flex items-center gap-1.5 mb-1">
            <Thermometer className="w-3 h-3 text-f1-amber" />
            <span className="text-[10px] font-display font-bold uppercase tracking-wider text-f1-text-dim">Typical Weather</span>
          </div>
          <p className="text-[10px] leading-relaxed text-white/50">{circuit.typical_weather}</p>
        </div>

        {/* Strategy */}
        <div className="rounded-lg p-2.5 bg-f1-surface-2 border border-f1-border">
          <div className="flex items-center gap-1.5 mb-1">
            <Disc className="w-3 h-3 text-f1-red" />
            <span className="text-[10px] font-display font-bold uppercase tracking-wider text-f1-text-dim">Typical Strategy</span>
          </div>
          <p className="text-[10px] leading-relaxed text-white/50">{circuit.typical_strategy}</p>
        </div>

        {/* Lap Record */}
        <div className="rounded-lg p-2.5 bg-white/[0.02] border border-f1-border-solid">
          <div className="flex items-center gap-1.5 mb-1">
            <Calendar className="w-3 h-3 text-f1-text-dim" />
            <span className="text-[10px] font-display font-bold uppercase tracking-wider text-f1-text-dim">Lap Record</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-f1-red">{circuit.lap_record.time}</span>
            <span className="text-[10px] text-white/40">{circuit.lap_record.driver} ({circuit.lap_record.year})</span>
          </div>
        </div>

        {/* Key Facts */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Info className="w-3 h-3 text-white/30" />
            <span className="text-[10px] font-display font-bold uppercase tracking-wider text-f1-text-dim">Key Facts</span>
          </div>
          <div className="space-y-1">
            {circuit.key_facts.map((fact, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[10px] text-white/40">
                <span className="text-f1-text-dim mt-0.5">•</span>
                <span className="leading-relaxed">{fact}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg p-2 bg-white/[0.02] border border-f1-border-solid text-center">
      <div className="flex items-center justify-center text-white/20 mb-0.5">{icon}</div>
      <div className="text-[9px] text-white/25 font-display uppercase tracking-wider">{label}</div>
      <div className="text-xs font-mono font-bold text-white/70">{value}</div>
    </div>
  );
}

export const GPInfoPanel = memo(GPInfoPanelInner);
