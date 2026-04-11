"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";

/* ── F1 Quotes Pool ────────────────────────────────────────────── */

const F1_QUOTES = [
  { text: "If you no longer go for a gap that exists, you are no longer a racing driver.", author: "Ayrton Senna" },
  { text: "To finish first, first you have to finish.", author: "Juan Manuel Fangio" },
  { text: "You're not driving fast enough until you're scared.", author: "Mario Andretti" },
  { text: "The lead car is unique, except for the one behind it which is identical.", author: "Murray Walker" },
  { text: "There are two things no man will admit he cannot do well: drive and make love.", author: "Stirling Moss" },
  { text: "Aerodynamics are for people who can't build engines.", author: "Enzo Ferrari" },
  { text: "I don't know driving in another way which isn't risky.", author: "Ayrton Senna" },
  { text: "Speed has never killed anyone. Suddenly becoming stationary, that's what gets you.", author: "Jeremy Clarkson" },
  { text: "Motor racing is a great sport. Trouble is, you can't see it.", author: "Murray Walker" },
  { text: "I am not designed to come second or third. I am designed to win.", author: "Ayrton Senna" },
  { text: "Anything happens in Grand Prix racing, and it usually does.", author: "Murray Walker" },
  { text: "Once you've raced, you never forget it. And you never truly get over it.", author: "Richard Childress" },
  { text: "Being second is to be the first of the ones who lose.", author: "Ayrton Senna" },
  { text: "It's basically the same, except it's totally different.", author: "Dennis Green (via Murray Walker energy)" },
];

const WITTY_LINES = [
  "Our pit wall has 12 panels, 60fps animations, and a camera\u00A0engine — your 6\" screen would need binoculars.",
  "This dashboard has more data than a telemetry stream. Your phone has... a nice flashlight.",
  "We render 20 cars at 60fps with spring-damper physics.\nPinch-to-zoom wasn't in the design\u00A0spec.",
  "Our drag-and-drop grid has 24 columns.\nYour screen has... thoughts and prayers.",
  "Even Kimi would get frustrated with this on mobile.\n\"Leave me alone, I know what I need — a\u00A0laptop.\"",
  "The AI race engineer wants to give you insights.\nBut first, you need more\u00A0pixels.",
];

/* ── Track SVG path for the animated background ─────────────────── */
/* Simplified Monaco circuit outline for visual flair */
const TRACK_PATH = "M50,180 C50,120 80,80 130,60 C180,40 250,35 300,50 C350,65 380,100 390,140 C400,180 380,220 350,250 C320,280 280,300 240,310 C200,320 160,310 130,290 C100,270 70,240 55,210 C45,190 48,185 50,180 Z";

/* ── Animated track background with orbiting dot ────────────────── */
function TrackBackground() {
  const pathRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const trailRef = useRef<SVGCircleElement>(null);
  const glowPathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const path = pathRef.current;
    const dot = dotRef.current;
    const trail = trailRef.current;
    const glowPath = glowPathRef.current;
    if (!path || !dot || !trail || !glowPath) return;

    const length = path.getTotalLength();

    // Animate the track drawing on
    gsap.fromTo(path,
      { strokeDasharray: length, strokeDashoffset: length },
      { strokeDashoffset: 0, duration: 2.5, ease: "power2.inOut" }
    );

    gsap.fromTo(glowPath,
      { strokeDasharray: length, strokeDashoffset: length },
      { strokeDashoffset: 0, duration: 2.5, ease: "power2.inOut" }
    );

    // Animate dot along the path infinitely
    const progress = { t: 0 };
    gsap.to(progress, {
      t: 1,
      duration: 6,
      repeat: -1,
      ease: "none",
      delay: 2,
      onUpdate: () => {
        const point = path.getPointAtLength(progress.t * length);
        dot.setAttribute("cx", String(point.x));
        dot.setAttribute("cy", String(point.y));
        // Trail slightly behind
        const trailPoint = path.getPointAtLength(((progress.t - 0.02 + 1) % 1) * length);
        trail.setAttribute("cx", String(trailPoint.x));
        trail.setAttribute("cy", String(trailPoint.y));
      },
    });

    return () => { gsap.killTweensOf(progress); };
  }, []);

  return (
    <svg
      viewBox="0 100 450 260"
      className="absolute inset-0 w-full h-full opacity-[0.12]"
      preserveAspectRatio="xMidYMid slice"
    >
      {/* Track glow */}
      <path
        ref={glowPathRef}
        d={TRACK_PATH}
        fill="none"
        stroke="rgba(225, 6, 0, 0.3)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: "blur(8px)" }}
      />
      {/* Track outline */}
      <path
        ref={pathRef}
        d={TRACK_PATH}
        fill="none"
        stroke="rgba(255, 255, 255, 0.4)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Trailing dot (dimmer) */}
      <circle ref={trailRef} r="5" fill="rgba(225, 6, 0, 0.3)" cx="50" cy="180" />
      {/* Lead dot */}
      <circle ref={dotRef} r="4" fill="#E10600" cx="50" cy="180">
        <animate attributeName="r" values="3;5;3" dur="1.2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/* ── Speed Lines Canvas ─────────────────────────────────────────── */

function SpeedLines() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const lines: { x: number; y: number; len: number; speed: number; opacity: number }[] = [];
    const dpr = Math.min(window.devicePixelRatio, 2);

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();

    // Create initial lines
    for (let i = 0; i < 15; i++) {
      lines.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        len: 30 + Math.random() * 60,
        speed: 2 + Math.random() * 4,
        opacity: 0.03 + Math.random() * 0.07,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const line of lines) {
        ctx.beginPath();
        ctx.moveTo(line.x, line.y);
        ctx.lineTo(line.x + line.len, line.y);
        ctx.strokeStyle = `rgba(225, 6, 0, ${line.opacity})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        line.x += line.speed;
        if (line.x > window.innerWidth + 100) {
          line.x = -line.len - 20;
          line.y = Math.random() * window.innerHeight;
        }
      }
      animId = requestAnimationFrame(animate);
    };
    animate();

    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

/* ── Rotating F1 Quote ──────────────────────────────────────────── */

function RotatingQuote() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * F1_QUOTES.length));
  const quoteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const el = quoteRef.current;
      if (!el) return;
      gsap.to(el, {
        opacity: 0, y: -8, duration: 0.4, ease: "power2.in",
        onComplete: () => {
          setIdx((prev) => (prev + 1) % F1_QUOTES.length);
          gsap.fromTo(el, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" });
        },
      });
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  const quote = F1_QUOTES[idx];

  return (
    <div ref={quoteRef} className="text-center px-6">
      <p className="text-f1-text-dim text-[13px] sm:text-sm italic leading-relaxed font-body">
        &ldquo;{quote.text}&rdquo;
      </p>
      <p className="text-f1-text-muted text-[11px] sm:text-xs mt-2 font-display uppercase tracking-widest">
        — {quote.author}
      </p>
    </div>
  );
}

/* ── Main MobileGate Component ──────────────────────────────────── */

export function MobileGate() {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [wittyLine] = useState(() => WITTY_LINES[Math.floor(Math.random() * WITTY_LINES.length)]);
  const [showContent, setShowContent] = useState(false);

  // Staggered entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!showContent || !contentRef.current) return;

    const children = contentRef.current.querySelectorAll("[data-animate]");
    gsap.fromTo(
      children,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
        stagger: 0.12,
        ease: "power3.out",
      }
    );
  }, [showContent]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard?.writeText(window.location.href);
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] bg-f1-bg flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at 50% 20%, rgba(225,6,0,0.12) 0%, #000000 60%)",
      }}
    >
      {/* Animated background layers */}
      <SpeedLines />
      <TrackBackground />

      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-f1-red to-transparent opacity-60" />

      {/* Content */}
      {showContent && (
        <div ref={contentRef} className="relative z-10 flex flex-col items-center gap-6 px-6 max-w-sm mx-auto w-full">

          {/* ── Chequered flag icon + Logo ── */}
          <div data-animate className="flex flex-col items-center gap-3">
            {/* Animated chequered flag */}
            <div className="relative w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-f1-red/10 animate-pulse" />
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="relative">
                {/* Steering wheel icon */}
                <circle cx="20" cy="20" r="16" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" fill="none" />
                <circle cx="20" cy="20" r="5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" fill="none" />
                <line x1="20" y1="4" x2="20" y2="15" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" />
                <line x1="7" y1="26" x2="15" y2="22" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" />
                <line x1="33" y1="26" x2="25" y2="22" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>

            {/* Logo */}
            <div>
              <span className="font-display font-bold italic tracking-wider text-2xl">
                <span className="text-white">RACEOS</span>
                <span className="text-f1-red ml-1.5">F1</span>
              </span>
            </div>
          </div>

          {/* ── Status Badge ── */}
          <div data-animate className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-f1-red/20 bg-f1-red/5">
            <div className="w-2 h-2 rounded-full bg-f1-amber animate-pulse" />
            <span className="text-[11px] font-display uppercase tracking-[0.15em] text-f1-amber">
              Desktop Only Mode
            </span>
          </div>

          {/* ── Glass Panel — Main Message ── */}
          <div
            data-animate
            className="w-full rounded-panel border border-f1-red/20 p-5 text-center"
            style={{
              background: "rgba(8, 8, 8, 0.85)",
              backdropFilter: "blur(12px)",
              boxShadow: "0 0 1px rgba(225, 6, 0, 0.4), 0 0 20px rgba(225, 6, 0, 0.08), 0 8px 32px rgba(0,0,0,0.5)",
            }}
          >
            <h2 className="font-display text-base font-bold tracking-wide text-white mb-3 uppercase">
              Pit Wall Access Required
            </h2>
            <p className="text-f1-text-dim text-[13px] leading-relaxed font-body whitespace-pre-line">
              {wittyLine}
            </p>
          </div>

          {/* ── Specs Grid ── */}
          <div data-animate className="w-full grid grid-cols-3 gap-2">
            {[
              { value: "12", label: "Panels" },
              { value: "60", label: "FPS" },
              { value: "56", label: "APIs" },
            ].map(({ value, label }) => (
              <div
                key={label}
                className="text-center py-2.5 rounded-panel border border-f1-border bg-f1-surface/50"
              >
                <div className="font-mono text-lg font-bold text-f1-red">{value}</div>
                <div className="text-[10px] font-display uppercase tracking-widest text-f1-text-muted mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* ── CTA: Copy Link ── */}
          <div data-animate className="w-full flex flex-col gap-2.5">
            <button
              onClick={handleCopyLink}
              className="w-full py-3 rounded-panel font-display text-[13px] font-bold uppercase tracking-widest text-white transition-all active:scale-[0.97]"
              style={{
                background: "linear-gradient(135deg, #E10600 0%, #8B0000 100%)",
                boxShadow: "0 0 20px rgba(225, 6, 0, 0.3), 0 4px 16px rgba(0,0,0,0.4)",
              }}
            >
              📋 Copy Link for Desktop
            </button>
            <p className="text-f1-text-muted text-[11px] text-center font-body">
              Open this link on a laptop or desktop for the full experience
            </p>
          </div>

          {/* ── Separator ── */}
          <div data-animate className="w-full flex items-center gap-3">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-f1-border" />
            <div className="w-1.5 h-1.5 rounded-full bg-f1-red/40" />
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-f1-border" />
          </div>

          {/* ── Rotating F1 Quote ── */}
          <div data-animate>
            <RotatingQuote />
          </div>

          {/* ── Bottom fun badge ── */}
          <div data-animate className="flex items-center gap-2 mt-2">
            <div className="w-1.5 h-1.5 rounded-full bg-f1-green animate-live-pulse" />
            <span className="text-[10px] font-mono text-f1-text-muted uppercase tracking-wider">
              Pit wall standing by for desktop connection
            </span>
          </div>
        </div>
      )}

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-f1-red/40 to-transparent" />
    </div>
  );
}
