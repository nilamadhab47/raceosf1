"use client";

import { useEffect, useRef, useState, useCallback, createContext, useContext } from "react";
import { useF1Store } from "@/store/f1-store";
import gsap from "gsap";

export type ToastType = "info" | "success" | "warning" | "error" | "flag" | "pit" | "overtake";

interface Toast {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  addToast: (toast: Omit<Toast, "id">) => void;
}

const ToastContext = createContext<ToastContextValue>({ addToast: () => {} });

export const useToast = () => useContext(ToastContext);

let toastId = 0;

const TOAST_STYLES: Record<ToastType, { icon: string; accent: string; bg: string }> = {
  info:     { icon: "ℹ️", accent: "border-f1-cyan/40",   bg: "bg-f1-cyan/5" },
  success:  { icon: "✅", accent: "border-f1-green/40",  bg: "bg-f1-green/5" },
  warning:  { icon: "⚠️", accent: "border-f1-amber/40",  bg: "bg-f1-amber/5" },
  error:    { icon: "🚨", accent: "border-f1-red/40",    bg: "bg-f1-red/5" },
  flag:     { icon: "🏁", accent: "border-f1-amber/40",  bg: "bg-f1-amber/5" },
  pit:      { icon: "🔧", accent: "border-f1-cyan/40",   bg: "bg-f1-cyan/5" },
  overtake: { icon: "⚡", accent: "border-f1-green/40",  bg: "bg-f1-green/5" },
};

const ToastItem = ({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) => {
  const ref = useRef<HTMLDivElement>(null);
  const style = TOAST_STYLES[toast.type];

  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(ref.current,
      { opacity: 0, x: 80, scale: 0.95 },
      { opacity: 1, x: 0, scale: 1, duration: 0.35, ease: "back.out(1.2)" }
    );

    const dur = toast.duration ?? 4000;
    const fadeDelay = dur / 1000 - 0.4;
    gsap.to(ref.current, {
      opacity: 0, x: 40, delay: fadeDelay, duration: 0.4, ease: "power2.in",
      onComplete: () => onDismiss(toast.id),
    });
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      ref={ref}
      className={`flex items-start gap-2 px-3 py-2 rounded-[6px] border ${style.accent} ${style.bg} bg-f1-surface shadow-lg max-w-[280px] pointer-events-auto cursor-pointer`}
      onClick={() => onDismiss(toast.id)}
    >
      <span className="text-sm shrink-0 mt-0.5">{style.icon}</span>
      <div className="min-w-0">
        <p className="text-[13px] font-display font-bold uppercase tracking-wider text-f1-text">{toast.title}</p>
        {toast.message && (
          <p className="text-[13px] font-body text-f1-text-dim mt-0.5 leading-relaxed">{toast.message}</p>
        )}
      </div>
    </div>
  );
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = ++toastId;
    setToasts((prev) => [...prev.slice(-4), { ...toast, id }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-20 right-4 z-[80] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Hook that automatically fires toasts on race events.
 * Use in a component that's mounted when the dashboard is active.
 */
export function useRaceToasts() {
  const { addToast } = useToast();
  const flagMode = useF1Store((s) => s.flagMode);
  const leaderboard = useF1Store((s) => s.leaderboard);
  const liveState = useF1Store((s) => s.liveState);
  const prevFlagRef = useRef("green");
  const prevLeaderRef = useRef("");

  // Flag changes
  useEffect(() => {
    if (flagMode === prevFlagRef.current) return;
    const prev = prevFlagRef.current;
    prevFlagRef.current = flagMode;
    if (prev === "") return; // Initial mount

    const msgs: Record<string, string> = {
      sc: "Safety Car deployed",
      vsc: "Virtual Safety Car",
      red: "Session suspended",
      green: "Racing resumes",
      yellow: "Yellow flag on track",
      chequered: "Race complete",
    };
    if (msgs[flagMode]) {
      addToast({ type: "flag", title: msgs[flagMode] });
    }
  }, [flagMode, addToast]);

  // Leader changes
  useEffect(() => {
    if (!liveState?.is_running || leaderboard.length === 0) return;
    const leader = leaderboard[0]?.driver;
    if (!leader) return;
    if (prevLeaderRef.current && prevLeaderRef.current !== leader) {
      addToast({
        type: "overtake",
        title: "Lead Change",
        message: `${leader} takes the lead from ${prevLeaderRef.current}`,
      });
    }
    prevLeaderRef.current = leader;
  }, [leaderboard, liveState?.is_running, addToast]);
}
