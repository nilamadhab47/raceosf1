"use client";

import { useEffect, useRef, useState, memo } from "react";
import type { TrackInfo } from "@/lib/trackMapping";

/* ── F1 Driver Quotes ─────────────────────────────────────────────── */

const F1_QUOTES = [
  { text: "If you no longer go for a gap that exists, you are no longer a racing driver.", author: "Ayrton Senna" },
  { text: "To finish first, first you have to finish.", author: "Juan Manuel Fangio" },
  { text: "I am not designed to come second or third. I am designed to win.", author: "Ayrton Senna" },
  { text: "Just being a racing driver, that's enough.", author: "Kimi Räikkönen" },
  { text: "The crashes people remember, but they don't talk about the ones you walk away from.", author: "Michael Schumacher" },
  { text: "You want to go quick? Lose weight.", author: "Colin Chapman" },
  { text: "I don't have idols, I have inspiration.", author: "Ayrton Senna" },
  { text: "Speed has never killed anyone. Suddenly becoming stationary, that's what gets you.", author: "Jeremy Clarkson" },
  { text: "There's a 50% chance of anything: either it happens or it doesn't.", author: "Valtteri Bottas" },
  { text: "I'm more determined than ever. I want to finish what I started a long time ago.", author: "Lewis Hamilton" },
  { text: "Smooth operator.", author: "Carlos Sainz" },
  { text: "I was just driving the car and it went fast.", author: "Pierre Gasly" },
  { text: "FOR WHAT!?", author: "Sebastian Vettel" },
  { text: "In racing, they say that your weights are your excuses, so I haven't got any.", author: "Lando Norris" },
  { text: "Box, box, box.", author: "Every Race Engineer" },
  { text: "Leave me alone, I know what I'm doing.", author: "Kimi Räikkönen" },
  { text: "Guys, I'm kinda losing the rear.", author: "Every F1 Driver Ever" },
  { text: "We are checking...", author: "Ferrari Strategy Team" },
  { text: "No Mikey, no! That was so not right!", author: "Toto Wolff" },
  { text: "AND IT'S LIGHTS OUT AND AWAY WE GO!", author: "David Croft" },
  { text: "Bono, my tyres are gone.", author: "Lewis Hamilton" },
  { text: "The car felt good. Much slower than before. Amazing.", author: "Fernando Alonso" },
  { text: "IS THAT GLOCK?!", author: "Martin Brundle" },
  { text: "Still I Rise.", author: "Lewis Hamilton" },
];

/* ── Component ────────────────────────────────────────────────────── */

interface Props {
  trackInfo: TrackInfo | null;
  circuitName: string;
}

export const TrackLoadingOverlay = memo(function TrackLoadingOverlay({ trackInfo, circuitName }: Props) {
  const [quoteIdx, setQuoteIdx] = useState(() => Math.floor(Math.random() * F1_QUOTES.length));
  const [progress, setProgress] = useState(0);
  const [fade, setFade] = useState(true);
  const dotRef = useRef<SVGCircleElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const rafRef = useRef<number>(0);
  const startRef = useRef(Date.now());

  // Rotate quotes every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setQuoteIdx((i) => (i + 1) % F1_QUOTES.length);
        setFade(true);
      }, 400);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Fake progress bar (asymptotic — slows as it approaches 95%)
  useEffect(() => {
    startRef.current = Date.now();
    const tick = () => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      // Fast start, slowing as it approaches 95%
      const p = Math.min(95, 100 * (1 - Math.exp(-elapsed / 40)));
      setProgress(p);
    };
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, []);

  // Animate a dot tracing around the track SVG
  useEffect(() => {
    const path = pathRef.current;
    const dot = dotRef.current;
    if (!path || !dot) return;

    let t = 0;
    const totalLen = path.getTotalLength();

    const animate = () => {
      t = (t + 1.5) % totalLen;
      const pt = path.getPointAtLength(t);
      dot.setAttribute("cx", String(pt.x));
      dot.setAttribute("cy", String(pt.y));
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [trackInfo]);

  const quote = F1_QUOTES[quoteIdx];

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-f1-bg overflow-hidden">
      {/* Subtle radial glow behind track */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 50% 40% at 50% 45%, rgba(225,6,0,0.06) 0%, transparent 100%)",
        }}
      />

      {/* Static track SVG with draw-on + tracing dot animation */}
      {trackInfo?.svg && (
        <div className="relative w-[55%] max-w-[400px] aspect-square mb-6 opacity-90">
          <object
            data={`/tracks/${trackInfo.svg}`}
            type="image/svg+xml"
            className="w-full h-full track-loading-draw"
            style={{ filter: "brightness(0.4) contrast(1.2)" }}
            aria-label={`${trackInfo.name} circuit outline`}
          />
          {/* Overlay SVG with glowing tracing dot */}
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 500 500"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Invisible path to trace — we clone the track path shape via
                a simple ellipse placeholder; the real path comes from the <object>.
                Since we can't reach into the <object>, use a circular path as proxy. */}
            <ellipse cx="250" cy="250" rx="180" ry="160" fill="none" stroke="none" />
            <path
              ref={pathRef}
              d="M 250 90 C 380 90 430 160 430 250 C 430 340 380 410 250 410 C 120 410 70 340 70 250 C 70 160 120 90 250 90 Z"
              fill="none"
              stroke="none"
            />
            {/* Glowing tracer dot */}
            <circle
              ref={dotRef}
              cx="250"
              cy="90"
              r="6"
              fill="#E10600"
            >
              <animate attributeName="opacity" values="1;0.5;1" dur="0.8s" repeatCount="indefinite" />
            </circle>
            {/* Trail glow */}
            <circle
              ref={dotRef}
              cx="250"
              cy="90"
              r="14"
              fill="none"
              stroke="#E10600"
              strokeWidth="2"
              opacity="0.3"
            >
              <animate attributeName="r" values="10;20;10" dur="1.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;0.1;0.4" dur="1.2s" repeatCount="indefinite" />
            </circle>
          </svg>
        </div>
      )}

      {/* If no track SVG available, show generic F1 animation */}
      {!trackInfo?.svg && (
        <div className="relative w-40 h-40 mb-6">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="35" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
            <circle cx="50" cy="50" r="35" fill="none" stroke="#E10600" strokeWidth="3" strokeDasharray="60 160" strokeLinecap="round">
              <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="1.5s" repeatCount="indefinite" />
            </circle>
            <text x="50" y="54" textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.5)" fontFamily="var(--font-orbitron)" fontWeight="700">
              🏎
            </text>
          </svg>
        </div>
      )}

      {/* Loading text */}
      <div className="text-center px-6 space-y-3 max-w-md">
        <p className="text-[11px] font-display font-bold uppercase tracking-[0.3em] text-f1-red">
          Loading Telemetry
        </p>
        <h3 className="text-sm font-display font-semibold text-white/80 tracking-wide">
          {trackInfo?.name || circuitName}
        </h3>

        {/* Progress bar */}
        <div className="relative w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-4">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, #E10600 0%, #ff4444 50%, #E10600 100%)",
              boxShadow: "0 0 12px rgba(225,6,0,0.6)",
            }}
          />
          {/* Shimmer effect */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)",
              animation: "shimmer 2s infinite",
            }}
          />
        </div>
        <p className="text-[10px] font-mono text-f1-text-muted">
          {progress < 10
            ? "Establishing connection to timing tower..."
            : progress < 30
              ? "Downloading telemetry streams..."
              : progress < 60
                ? "Processing car data channels..."
                : progress < 80
                  ? "Building track coordinates..."
                  : "Almost there, finalizing data..."}
        </p>

        {/* Quote */}
        <div
          className="mt-6 transition-opacity duration-400"
          style={{ opacity: fade ? 1 : 0 }}
        >
          <p className="text-xs italic text-white/50 leading-relaxed">
            &ldquo;{quote.text}&rdquo;
          </p>
          <p className="text-[10px] font-mono text-f1-red/60 mt-1">
            — {quote.author}
          </p>
        </div>
      </div>

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .track-loading-draw {
          animation: fadeInTrack 1.5s ease-out;
        }
        @keyframes fadeInTrack {
          0% { opacity: 0; transform: scale(0.9); }
          100% { opacity: 0.9; transform: scale(1); }
        }
      `}</style>
    </div>
  );
});
