import { create } from "zustand";
import { persist } from "zustand/middleware";

interface LabEntryState {
  /** Persisted — true after first successful entry */
  hasEntered: boolean;
  /** Persisted — mute voice greeting */
  isMuted: boolean;

  completeEntry: () => void;
  toggleMute: () => void;
  /** Dev helper — reset to first-visit state */
  reset: () => void;
}

export const useLabEntryStore = create<LabEntryState>()(
  persist(
    (set) => ({
      hasEntered: false,
      isMuted: false,

      completeEntry: () => set({ hasEntered: true }),

      toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),

      reset: () => {
        set({ hasEntered: false });
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("raceos-greeting-played");
        }
      },
    }),
    {
      name: "raceos-lab-entry",
      partialize: (state) => ({
        hasEntered: state.hasEntered,
        isMuted: state.isMuted,
      }),
    },
  ),
);
