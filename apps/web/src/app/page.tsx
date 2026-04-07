"use client";

import { useEffect, useState } from "react";
import { useF1Store } from "@/store/f1-store";
import { useLabEntryStore } from "@/store/lab-entry-store";
import { useRaceWebSocket } from "@/hooks/useRaceWebSocket";
import { useReplayEngine } from "@/engines/ReplayEngine";
import { decodeClipParams } from "@/lib/shareUtils";
import { TopBar } from "@/components/TopBar/TopBar";
import { GridLayout } from "@/components/WorldMonitor";
import { VoiceWidget } from "@/components/Voice/VoiceWidget";
import { AIChatInput } from "@/components/Insights/AIChatInput";
import { FastestLapCelebration } from "@/components/shared/FastestLapCelebration";
import { PitStopTimer } from "@/components/shared/PitStopTimer";
import { ToastProvider } from "@/components/shared/ToastSystem";
import { RaceToastWatcher } from "@/components/shared/RaceToastWatcher";
import { KeyboardShortcuts } from "@/components/shared/KeyboardShortcuts";
import { DriverFocusModal } from "@/components/shared/DriverFocusModal";
import { PodiumCelebration } from "@/components/shared/PodiumCelebration";
import { LabEntry } from "@/components/shared/LabEntry";
import { RaceOSTour } from "@/components/shared/RaceOSTour";
import { SettingsModal } from "@/components/shared/SettingsModal";
import { useOnboardingStore } from "@/store/onboarding-store";

/* ─── Main Page — F1 World Monitor ───────────────────────────────── */

export default function Home() {
  const { session, loading, error, loadSession } = useF1Store();
  const hasEntered = useLabEntryStore((s) => s.hasEntered);
  const { hasCompletedTour, startTour } = useOnboardingStore();
  const [mounted, setMounted] = useState(false);
  useRaceWebSocket();

  useEffect(() => {
    if (!session && !loading) {
      loadSession(2024, "Bahrain");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Signal that the client has mounted (Zustand persist has rehydrated by now)
  useEffect(() => setMounted(true), []);

  // Restore clip from URL parameters
  useEffect(() => {
    const params = decodeClipParams();
    if (!params) return;
    const { speed } = params;
    useReplayEngine.getState().setReplaySpeed(speed);
  }, []);

  // Auto-start onboarding tour for first-time users after lab entry
  useEffect(() => {
    if (mounted && hasEntered && !hasCompletedTour) {
      const timer = setTimeout(() => startTour(), 1500);
      return () => clearTimeout(timer);
    }
  }, [mounted, hasEntered, hasCompletedTour, startTour]);

  // Only show overlay once mounted (avoids SSR/hydration mismatch with persisted state)
  const showOverlay = mounted && !hasEntered;

  return (
    <ToastProvider>
      {showOverlay && <LabEntry />}
        <div className="h-screen flex flex-col overflow-hidden bg-f1-bg" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(225,6,0,0.08) 0%, #000000 55%)" }}>
        <TopBar />
        <FastestLapCelebration />
        <PodiumCelebration />
        <PitStopTimer />
        <RaceToastWatcher />

        {/* Error banner */}
        {error && (
          <div className="px-4 py-2 text-[13px] font-display font-bold uppercase tracking-wider border-b bg-f1-red/5 border-f1-red/15 text-f1-red">
            ⚠️ {error}
          </div>
        )}

        {/* Loading overlay */}
        {loading && !session && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-10 h-10 rounded-full border-2 border-f1-purple border-t-transparent animate-spin mx-auto mb-4" />
              <p className="text-sm font-medium text-f1-text">Loading session data...</p>
              <p className="text-[13px] mt-1 text-f1-text-dim">
                First load may take a minute to download &amp; cache
              </p>
            </div>
          </div>
        )}

        {/* ═══ WORLD MONITOR GRID LAYOUT ═══ */}
        <div className="flex-1 min-h-0 flex flex-col">
          {(session || !loading) && <GridLayout />}
        </div>

        <VoiceWidget />
        <AIChatInput />
        <KeyboardShortcuts />
        <DriverFocusModal />
        <RaceOSTour />
        <SettingsModal />
      </div>
    </ToastProvider>
  );
}
