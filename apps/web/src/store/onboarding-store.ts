import { create } from "zustand";
import { persist } from "zustand/middleware";

interface OnboardingState {
  /** Persisted — true after tour completed or skipped */
  hasCompletedTour: boolean;
  /** Transient — is the tour currently running */
  isTourRunning: boolean;
  /** Transient — current step index */
  tourStepIndex: number;

  startTour: () => void;
  stopTour: () => void;
  completeTour: () => void;
  setStepIndex: (index: number) => void;
  /** Dev helper — reset so tour shows again */
  resetTour: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      hasCompletedTour: false,
      isTourRunning: false,
      tourStepIndex: 0,

      startTour: () => set({ isTourRunning: true, tourStepIndex: 0 }),
      stopTour: () => set({ isTourRunning: false }),
      completeTour: () => set({ hasCompletedTour: true, isTourRunning: false }),
      setStepIndex: (index) => set({ tourStepIndex: index }),
      resetTour: () => set({ hasCompletedTour: false, isTourRunning: false, tourStepIndex: 0 }),
    }),
    {
      name: "raceos-onboarding",
      partialize: (state) => ({
        hasCompletedTour: state.hasCompletedTour,
      }),
    },
  ),
);
