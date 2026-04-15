"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import gsap from "gsap";
import { RaceOSLogo } from "./RaceOSLogo";
import { useLabEntryStore } from "@/store/lab-entry-store";
import { api } from "@/lib/api";

/* ── Greeting text ────────────────────────────────────────────────── */

function getGreeting(): string {
  const h = new Date().getHours();
  const tod =
    h >= 5 && h < 12
      ? "Good morning"
      : h >= 12 && h < 17
        ? "Good afternoon"
        : "Good evening";
  return `${tod}! Welcome to RaceOS F1. All sectors green, comms are live — let's get it!`;
}

/* ── LabEntry Component ──────────────────────────────────────────── */

export function LabEntry() {
  const completeEntry = useLabEntryStore((s) => s.completeEntry);
  const isMuted = useLabEntryStore((s) => s.isMuted);

  const overlayRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const taglineRef = useRef<HTMLDivElement>(null);
  const enterRef = useRef<HTMLButtonElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const rippleRef = useRef<HTMLDivElement>(null);
  const greetingRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const breatheRef = useRef<gsap.core.Tween | null>(null);
  const hasTriggeredRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);

  const [phase, setPhase] = useState<"logo" | "greeting" | "done">("logo");
  const [showText, setShowText] = useState(false);

  /* ── Intro timeline (logo phase) ─────────────────────────────── */

  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
    tlRef.current = tl;

    tl.fromTo(
      logoRef.current,
      { opacity: 0, scale: 0.85 },
      { opacity: 1, scale: 1, duration: 0.9 },
    )
      .fromTo(
        taglineRef.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.5 },
        "-=0.35",
      )
      .fromTo(
        enterRef.current,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.4 },
        "-=0.15",
      );

    tl.call(() => {
      breatheRef.current = gsap.to(glowRef.current, {
        boxShadow:
          "0 0 60px 20px rgba(225,6,0,0.18), 0 0 120px 40px rgba(225,6,0,0.06)",
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    });

    return () => {
      tl.kill();
      breatheRef.current?.kill();
    };
  }, []);

  /* ── ESC key → skip ─────────────────────────────────────────── */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (phase === "logo") doExit();
        else if (phase === "greeting") finishGreeting();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /* ── Play voice + show text, then fade out ──────────────────── */

  useEffect(() => {
    if (phase !== "greeting") return;

    let cancelled = false;
    let fallbackTimer: ReturnType<typeof setTimeout>;

    const revealText = () => {
      if (cancelled) return;
      setShowText(true);
      // Animate text in after state update
      requestAnimationFrame(() => {
        const el = greetingRef.current;
        if (el) {
          gsap.fromTo(el, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" });
        }
      });
    };

    const run = async () => {
      const shouldSkipVoice =
        isMuted || sessionStorage.getItem("raceos-greeting-played") === "1";

      if (shouldSkipVoice) {
        // No voice — show text immediately, hold 2s, finish
        revealText();
        fallbackTimer = setTimeout(finishGreeting, 2000);
        return;
      }

      sessionStorage.setItem("raceos-greeting-played", "1");

      // Use pre-fetched blob if available, otherwise fetch with a timeout
      let blob = audioBlobRef.current;
      if (!blob) {
        try {
          blob = await Promise.race([
            api.synthesizeSpeech(getGreeting()),
            new Promise<null>((r) => setTimeout(() => r(null), 4000)),
          ]);
        } catch {
          blob = null;
        }
      }

      if (cancelled) return;

      if (!blob) {
        revealText();
        fallbackTimer = setTimeout(finishGreeting, 3000);
        return;
      }

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.volume = 0.6;
      audio.playbackRate = 1.15;

      // Show text the moment audio actually starts playing
      audio.onplaying = () => revealText();

      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (!cancelled) finishGreeting();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        if (!cancelled) {
          revealText();
          fallbackTimer = setTimeout(finishGreeting, 2000);
        }
      };

      try {
        await audio.play();
      } catch {
        revealText();
        fallbackTimer = setTimeout(finishGreeting, 2000);
      }
    };

    run();

    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.onplaying = null;
        a.onended = null;
        a.onerror = null;
        audioRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isMuted]);

  /* ── Finish greeting → fade overlay → completeEntry ─────────── */

  const finishGreeting = useCallback(() => {
    if (phase === "done") return;
    setPhase("done");

    const overlay = overlayRef.current;
    if (!overlay) {
      completeEntry();
      return;
    }

    gsap.to(overlay, {
      opacity: 0,
      duration: 0.5,
      ease: "power2.out",
      onComplete: () => completeEntry(),
    });
  }, [phase, completeEntry]);

  /* ── Exit logo: ripple → transition to greeting phase ────────── */

  const doExit = useCallback(() => {
    if (hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;

    tlRef.current?.kill();
    breatheRef.current?.kill();

    // Start fetching voice audio immediately (runs during ripple animation)
    if (!isMuted && sessionStorage.getItem("raceos-greeting-played") !== "1") {
      api.synthesizeSpeech(getGreeting()).then((blob) => {
        if (blob) audioBlobRef.current = blob;
      }).catch(() => {});
    }

    const ripple = rippleRef.current;
    const overlay = overlayRef.current;
    if (!ripple || !overlay) {
      setPhase("greeting");
      return;
    }

    // Ripple from center of the logo
    const logoBounds = logoRef.current?.getBoundingClientRect();
    const cx = logoBounds
      ? logoBounds.left + logoBounds.width / 2
      : window.innerWidth / 2;
    const cy = logoBounds
      ? logoBounds.top + logoBounds.height / 2
      : window.innerHeight / 2;

    gsap.set(ripple, {
      left: cx,
      top: cy,
      xPercent: -50,
      yPercent: -50,
      scale: 0,
      opacity: 1,
      display: "block",
    });

    // Fade out logo/tagline/enter immediately
    gsap.to([logoRef.current, taglineRef.current, enterRef.current], {
      opacity: 0,
      duration: 0.3,
      ease: "power2.out",
    });

    gsap.to(ripple, {
      scale: 80,
      opacity: 0,
      duration: 1.2,
      ease: "power3.out",
      onComplete: () => setPhase("greeting"),
    });
  }, [isMuted]);

  /* ── Logo phase UI ──────────────────────────────────────────── */

  if (phase === "done") return null;

  const greetingText = getGreeting();

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center select-none"
      style={{
        willChange: "opacity",
        background:
          phase === "logo"
            ? "#0A0A0A"
            : "rgba(10, 10, 10, 0.85)",
        backdropFilter: phase === "greeting" ? "blur(12px)" : undefined,
        transition: "background 0.5s ease",
      }}
    >
      {/* Skip button (top-right) */}
      <button
        onClick={phase === "logo" ? doExit : finishGreeting}
        className="absolute top-6 right-8 z-10 text-[11px] font-display uppercase tracking-[0.2em] text-f1-text-dim hover:text-white transition-colors"
      >
        Skip <span className="text-[9px] text-white/20 ml-1">ESC</span>
      </button>

      {/* ── Logo phase content ─────────────────────────────────── */}
      {phase === "logo" && (
        <>
          <div
            ref={logoRef}
            onClick={doExit}
            className="relative flex items-center justify-center cursor-pointer group"
            style={{ opacity: 0 }}
          >
            <div
              ref={glowRef}
              className="absolute rounded-full pointer-events-none"
              style={{
                width: 240,
                height: 240,
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                boxShadow:
                  "0 0 40px 10px rgba(225,6,0,0.08), 0 0 80px 20px rgba(225,6,0,0.03)",
                border: "1px solid rgba(225,6,0,0.15)",
              }}
            />
            <div className="relative z-10 flex items-center justify-center w-[240px] h-[240px] group-hover:scale-105 transition-transform duration-300">
              <RaceOSLogo size="large" />
            </div>
          </div>

          <div
            ref={taglineRef}
            className="mt-6 text-[13px] font-body text-f1-text-dim tracking-wide"
            style={{ opacity: 0 }}
          >
            See the race like the pit wall
          </div>

          <button
            ref={enterRef}
            onClick={doExit}
            className="mt-8 px-8 py-2.5 text-[11px] font-display font-bold uppercase tracking-[0.25em] text-f1-red border border-f1-red/30 rounded-[6px] hover:bg-f1-red/10 transition-colors"
            style={{ opacity: 0 }}
          >
            Enter
          </button>
        </>
      )}

      {/* ── Greeting phase content ─────────────────────────────── */}
      {phase === "greeting" && (
        <div
          ref={greetingRef}
          className="max-w-xl px-8 text-center"
          style={{ opacity: showText ? undefined : 0 }}
        >
          {showText && (
            <>
              <p className="text-[22px] font-display font-bold tracking-wide text-white leading-relaxed">
                {greetingText}
              </p>
              <div className="mt-6 flex items-center justify-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-f1-red animate-pulse" />
                <span className="text-[10px] font-display uppercase tracking-[0.25em] text-f1-text-dim">
                  Systems Online
                </span>
              </div>
            </>
          )}
          {!showText && (
            <div className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-f1-red animate-pulse" />
              <span className="text-[11px] font-display uppercase tracking-[0.25em] text-f1-text-dim">
                Connecting to pit wall...
              </span>
            </div>
          )}
        </div>
      )}

      {/* Ripple element — hidden until triggered */}
      <div
        ref={rippleRef}
        className="fixed pointer-events-none"
        style={{
          display: "none",
          width: 100,
          height: 100,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(225,6,0,0.5) 0%, rgba(225,6,0,0.15) 35%, transparent 65%)",
          willChange: "transform, opacity",
        }}
      />
    </div>
  );
}
