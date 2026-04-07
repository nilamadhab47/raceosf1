import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/hooks/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Base surfaces — true black void for cinematic depth
        "f1-bg": "#000000",
        "f1-surface": "#080808",
        "f1-surface-2": "#101010",
        "f1-border": "#1A1A1A",
        "f1-border-solid": "#1A1A1A",
        // Text
        "f1-text": "#FFFFFF",
        "f1-text-dim": "#B0B0B0",
        "f1-text-muted": "#555555",
        // Accents
        "f1-green": "#00D2BE",
        "f1-purple": "#6C2BFF",
        "f1-red": "#E10600",
        "f1-amber": "#FFD000",
        "f1-cyan": "#00D2BE",
        "f1-gold": "#FFD000",
        // Tyre compounds
        "tyre-soft": "#ff3333",
        "tyre-medium": "#ffcc00",
        "tyre-hard": "#cccccc",
        "tyre-inter": "#00cc00",
        "tyre-wet": "#3399ff",
        // DRS
        "drs-active": "#00D2BE",
        "drs-available": "#FFD000",
      },
      fontFamily: {
        display: ["var(--font-orbitron)", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
        body: ["var(--font-exo2)", "sans-serif"],
      },
      borderRadius: {
        panel: "6px",
      },
      boxShadow: {
        "glow-green": "0 0 20px rgba(0, 210, 190, 0.35), 0 0 60px rgba(0, 210, 190, 0.12)",
        "glow-purple": "0 0 20px rgba(108, 43, 255, 0.35), 0 0 60px rgba(108, 43, 255, 0.12)",
        "glow-red": "0 0 20px rgba(225, 6, 0, 0.45), 0 0 60px rgba(225, 6, 0, 0.15)",
        "glow-amber": "0 0 20px rgba(255, 208, 0, 0.35), 0 0 60px rgba(255, 208, 0, 0.12)",
        "panel-ambient": "0 0 1px rgba(225, 6, 0, 0.4), 0 0 15px rgba(225, 6, 0, 0.07), 0 4px 20px rgba(0,0,0,0.5)",
        "panel-hover": "0 0 1px rgba(225, 6, 0, 0.6), 0 0 25px rgba(225, 6, 0, 0.12), 0 8px 30px rgba(0,0,0,0.6)",
        "panel-hero": "0 0 2px rgba(225, 6, 0, 0.5), 0 0 40px rgba(225, 6, 0, 0.12), 0 0 80px rgba(225, 6, 0, 0.05), 0 8px 40px rgba(0,0,0,0.6)",
      },
      animation: {
        "dash-flow": "dash-flow 2s linear infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "live-pulse": "live-pulse 1.5s ease-in-out infinite",
        "ticker-scroll": "ticker-scroll 30s linear infinite",
        "number-tick": "number-tick 0.3s ease-out",
        shimmer: "shimmer 1.5s ease-in-out infinite",
      },
      keyframes: {
        "dash-flow": {
          to: { strokeDashoffset: "-12" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        "live-pulse": {
          "0%, 100%": { boxShadow: "0 0 4px rgba(225, 6, 0, 0.5)" },
          "50%": { boxShadow: "0 0 12px rgba(225, 6, 0, 0.9)" },
        },
        "ticker-scroll": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(-100%)" },
        },
        "number-tick": {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
