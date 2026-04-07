"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

interface Props {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

/**
 * Wraps a panel with a GSAP fade-in + slide-up animation on mount.
 */
export function AnimatedPanel({ children, delay = 0, className = "" }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(
      ref.current,
      { opacity: 0, y: 12 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        delay,
        ease: "power2.out",
      }
    );
  }, [delay]);

  return (
    <div ref={ref} className={className} style={{ opacity: 0 }}>
      {children}
    </div>
  );
}
