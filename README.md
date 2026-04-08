<div align="center">

# 🏎️ F1 Intelligence Studio

### AI-Powered Real-Time Formula 1 Race Operations Dashboard

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python)](https://python.org/)
[![Claude AI](https://img.shields.io/badge/Claude-Sonnet-CC785C?logo=anthropic)](https://anthropic.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Watch animated cars chase each other around telemetry-derived circuits at 60fps, get AI race engineer insights powered by Claude, hear broadcast-quality voice commentary, and replay any overtake with cinematic camera zoom.**

[Live Demo](https://raceosf1-web.vercel.app) · [Technical Deep Dive](TECHNICAL_DEEP_DIVE.md) · [Full Documentation](DOCS.md) · [API Docs (Swagger)](https://your-api.up.railway.app/docs)

</div>

---

> **Note**: Add screenshots/GIFs of your dashboard here for maximum impact!
> 
> ```
> <!-- Suggested screenshot placement -->
> ![Dashboard Overview](docs/screenshots/dashboard.png)
> ![Track Animation](docs/screenshots/track-animation.gif)
> ```

---

## Highlights

🗺️ **Live Circuit Visualization** — GPS telemetry from FastF1 converted into SVG circuits with 20 animated driver dots, pit lane simulation, and smooth position transitions

🎥 **Spring-Physics Camera** — A custom camera engine with spring-damper physics (not GSAP tweens) that follows battles, zooms dynamically, and feels like a real broadcast

🤖 **AI Race Engineer** — Two-layer insight system: rule-based pattern detection (tyre deg, pace drops, undercuts) enhanced by Claude Sonnet with live race context

🔊 **Voice Commentary** — ElevenLabs TTS with broadcast-tuned settings (low stability + high style) for dramatic, natural-sounding race updates every 30 seconds

📊 **Telemetry Comparison** — Side-by-side speed/throttle/brake traces plotted against distance (not time) for accurate corner-by-corner comparison

🧠 **Strategy Simulator** — Heuristic pit stop model that answers "pit or stay out?" with compound degradation curves and position-change estimates

⏮️ **Event Replay** — 10,000-frame ring buffer records the race state every 500ms; scrub to any moment or replay detected events with cinematic camera

🎛️ **Drag-and-Drop Dashboard** — 12 customizable panels on a 24-column grid with Broadcast and Analysis presets, saved to localStorage

🌐 **Real-Time WebSocket** — Backend simulation broadcasts leaderboard + positions on lap changes; frontend animates independently at 60fps between updates

---

## Architecture

```
┌──────────────────────────┐       ┌─────────────────────────────┐
│       Vercel (Free)       │       │     Railway (~$5/mo)        │
│                           │       │                             │
│  Next.js 15 + TypeScript  │◄─────►│   FastAPI + Python 3.12     │
│  Zustand State            │ REST  │   FastF1 Data Engine        │
│  GSAP + Spring Physics    │  +    │   Claude AI Insights        │
│  Recharts Telemetry       │  WS   │   ElevenLabs TTS            │
│  react-grid-layout        │       │   YouTube/Dailymotion APIs  │
│  22 Circuit SVGs          │       │   Race Simulation Engine    │
└──────────────────────────┘       └─────────────────────────────┘
```

**56 API endpoints** · **7 animation engines** · **12 dashboard panels** · **9 SQLite tables** · **22 circuit SVGs**

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 15, React 19, TypeScript 5.7, Zustand 5, GSAP 3.14, Recharts, react-grid-layout, Tailwind CSS, Framer Motion |
| **Backend** | FastAPI, Python 3.12, FastF1, pandas, numpy, aiosqlite, WebSockets |
| **AI & Voice** | Anthropic Claude (insights + chat), ElevenLabs (TTS commentary) |
| **Data Sources** | FastF1 (historical telemetry), OpenF1 (free real-time), RapidAPI F1 Live (premium real-time) |
| **Infrastructure** | Vercel (frontend), Railway (Docker backend), GitHub Actions CI/CD |

---

## Features in Detail

### 🗺️ Telemetry-Derived Circuit Rendering

Circuits aren't static images — they're built from real GPS telemetry. The backend extracts the fastest lap's X/Y coordinates via FastF1, normalizes them into a 0–1000 SVG viewBox with uniform scaling, and the frontend resamples the path into **1,000 equally-spaced points** for O(1) position lookups.

### 🏁 60fps Car Animation (Zero React Re-renders)

All 20 driver dots animate via `requestAnimationFrame` + direct DOM manipulation through `useRef`. React's reconciliation cycle is completely bypassed in the hot path. Gap-to-leader (in seconds) is converted to track fraction (`gap / avgLapTime`) and smoothed with exponential decay (`factor = 0.03`) for buttery-smooth overtake visuals.

### 📷 Camera System

| Component | Purpose |
|-----------|---------|
| **CameraEngine** | Spring-damper physics for position + zoom (configurable stiffness/damping) |
| **DirectorEngine** | Priority-scored auto-director with hold times and cooldowns per event type |
| **Battle Zoom** | Auto-adjusts zoom (1.8x–3.0x) based on inter-car pixel distance |
| **GPU Compositing** | Applies `<g transform>` instead of `viewBox` changes to avoid SVG relayout |

### 🧠 AI Insights Pipeline

```
Leaderboard Data → Rule Engine (tyre deg, pace drops, undercuts)
                         ↓
              Detected patterns + Race snapshot
                         ↓
              Claude Sonnet (600 tokens, F1 engineer persona)
                         ↓
              Dashboard insight cards + Voice queue
```

Interactive chat mode appends full race context to every user question with 20-message conversation history.

### 🔁 Event Detection & Replay

| Event Type | Detection | Clip Timing |
|-----------|-----------|-------------|
| Overtake | Position swap + gap-delta interpolation | 0.3 laps before, 0.2 after |
| Battle | Gap < 1.0s between consecutive drivers | 0.5 laps before/after |
| Pit Stop | Stint number increase | 0.2 before, 0.3 after |
| Incident | SC/VSC/Red flag from race control | 0.4 before, 0.6 after |
| Fastest Lap | New session-best lap time | 0.2 before, 0.15 after |

Events are recorded into a 10,000-frame ring buffer (~83 minutes at 500ms intervals). The PIP replay modal uses GSAP camera animation synced to the stored frames.

---

## Quick Start

### Prerequisites

- **Node.js 18+**
- **Python 3.10+**

### 1. Clone & Install

```bash
git clone https://github.com/your-username/f1-intelligence-studio.git
cd f1-intelligence-studio

# Install all dependencies
npm install
cd apps/api && pip install -r requirements.txt && cd ../..
cd apps/web && npm install && cd ../..
```

### 2. Configure (Optional)

Create `apps/api/.env`:

```env
# All keys are optional — core features work without them
ANTHROPIC_API_KEY=sk-ant-...    # AI insights + chat
ELEVENLABS_API_KEY=...          # Voice commentary
RAPIDAPI_KEY=...                # Live race data
YOUTUBE_API_KEY=...             # Video highlights
```

### 3. Run

```bash
# Start both servers (frontend + backend)
npm run dev
```

Open **http://localhost:3000** → select a Grand Prix → press Play.

> **First launch**: FastF1 downloads and caches race data (~30s–2min per session). Subsequent loads are instant.

---

## Project Structure

```
f1/
├── apps/
│   ├── api/                    # FastAPI backend (Python)
│   │   ├── main.py             # 56 REST endpoints + WebSocket
│   │   ├── f1_data.py          # FastF1 data extraction
│   │   ├── ai_insights.py      # Claude-powered analysis
│   │   ├── strategy.py         # Pit stop simulator
│   │   ├── voice.py            # ElevenLabs TTS
│   │   ├── simulation.py       # Race replay engine
│   │   ├── ws.py               # WebSocket broadcast
│   │   ├── database.py         # SQLite (9 tables)
│   │   ├── live_pulse.py       # RapidAPI real-time client
│   │   ├── openf1_client.py    # OpenF1 free API client
│   │   └── youtube_search.py   # Multi-platform highlight search
│   │
│   └── web/                    # Next.js frontend (TypeScript)
│       └── src/
│           ├── engines/        # 7 animation engines (Zustand singletons)
│           │   ├── Timeline.ts         # Race clock (rAF-driven)
│           │   ├── EventEngine.ts      # Overtake/battle detection
│           │   ├── ReplayEngine.ts     # 10K-frame ring buffer
│           │   ├── CameraEngine.ts     # Spring-damper virtual camera
│           │   └── DirectorEngine.ts   # Auto-camera director
│           ├── components/
│           │   ├── WorldMonitor/       # Track canvas, grid layout, timeline
│           │   ├── Leaderboard/        # GSAP-animated position board
│           │   ├── Telemetry/          # Recharts speed/throttle/brake
│           │   ├── Strategy/           # Pit sim, gap chart, stint bars
│           │   ├── Insights/           # AI cards + Claude chat
│           │   └── Voice/              # TTS commentary widget
│           ├── store/f1-store.ts       # Central Zustand store
│           └── lib/                    # API client, types, track data
│
├── TECHNICAL_DEEP_DIVE.md      # Detailed article on how everything works
├── DOCS.md                     # Full internal documentation
└── package.json                # Monorepo root (npm workspaces)
```

---

## Dashboard Panels

| # | Panel | Description |
|---|-------|-------------|
| 1 | **Track Map** | 60fps SVG circuit with animated car dots, pit lane offsets, gap labels |
| 2 | **Leaderboard** | Real-time positions with GSAP row reordering, tyre indicators |
| 3 | **Race Control** | Flag badges, penalties, safety car messages |
| 4 | **Telemetry** | Speed/throttle/brake comparison for any two drivers |
| 5 | **Strategy** | Pit vs. stay-out simulator with compound degradation model |
| 6 | **AI Insights** | Claude-powered tactical analysis + interactive chat |
| 7 | **Gap Evolution** | Gap-to-leader chart showing convergence/divergence |
| 8 | **Stint History** | Tyre strategy visualization per driver |
| 9 | **Team Radio** | Intercepted team radio messages |
| 10 | **GP Info** | Circuit details, weather, DRS zones |
| 11 | **Highlights** | Dailymotion embeds + YouTube thumbnail cards |
| 12 | **Replay** | Event timeline, clip scrubbing, filter by type |

All panels are **draggable, resizable, and toggleable**. Layout persists in localStorage.

---

## API Overview

**56 endpoints** organized into 10 groups:

| Group | Endpoints | Description |
|-------|-----------|-------------|
| Session | 4 | Load/query F1 sessions |
| Race Data | 10 | Laps, telemetry, leaderboard, positions, stints |
| AI & Insights | 3 | Rule-based + Claude insights, interactive chat |
| Strategy | 1 | Pit stop simulation with recommendations |
| Simulation | 4 | Start/stop/reset race replay, live state |
| Media | 3 | Voice synthesis, video highlight search |
| Database | 11 | Offline storage (SQLite CRUD) |
| Live Pulse | 6 | RapidAPI real-time data (premium) |
| OpenF1 | 8 | Free real-time API |
| WebSocket | 1 | Bidirectional race data stream |

Interactive docs at **`/docs`** (Swagger UI) and **`/redoc`** (ReDoc).

---

## Deployment

| Service | Component | Cost |
|---------|-----------|------|
| **Vercel** | Next.js frontend | Free |
| **Railway** | FastAPI + Docker | ~$5/mo |
| **Total** | | **~$5/mo** |

```bash
# Deploy everything
npm run deploy

# Or individually
npm run deploy:web    # Vercel
npm run deploy:api    # Railway
```

CI/CD via GitHub Actions: lint → typecheck → build on every PR, with Copilot AI code review.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | No | Claude API key for AI insights + chat |
| `ELEVENLABS_API_KEY` | No | ElevenLabs key for voice commentary |
| `RAPIDAPI_KEY` | No | RapidAPI key for live race data |
| `YOUTUBE_API_KEY` | No | YouTube Data API v3 for highlight search |
| `FRONTEND_URL` | No | CORS origin (default: `http://localhost:3000`) |
| `FASTF1_CACHE_DIR` | No | Cache path (default: `./cache`) |

All keys are optional. Core visualization, replay, and strategy features work without any API keys.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `→` / `←` | Step forward / backward one lap |
| `1`–`6` | Set speed (0.25x to 10x) |
| `M` | Toggle mute (voice) |
| `A` | Toggle auto-commentary |
| `Esc` | Close modals |
| `?` | Show shortcut help |

---

## Credits & Acknowledgements

This project is built on top of incredible open-source projects and APIs:

### F1 Data

- **[FastF1](https://github.com/theOehrly/Fast-F1)** by [@theOehrly](https://github.com/theOehrly) — The backbone of the entire backend. Provides lap times, telemetry (speed/throttle/brake at 300Hz), positions, tyre data, and session results through a beautiful Pandas-based API. Track map rendering, gap calculations, strategy simulation, and telemetry charts all start with a FastF1 `session.load()` call. One of the best sports data libraries in any ecosystem.

- **[OpenF1](https://openf1.org)** — Free, open-source, community-maintained F1 API. No API key required. Powers session listings, driver info, and the background data sync service.

- **[F1 Live Motorsport Data](https://rapidapi.com/api-sports/api/f1-live-motorsport-data)** (RapidAPI) — Supplements OpenF1 with real-time timing, positions, race control, pit stops, and team radio during live sessions.

### Frontend

- **[Zustand](https://github.com/pmndrs/zustand)** — Minimal, zero-boilerplate state management. Perfect for real-time data.
- **[GSAP](https://gsap.com/)** — Cinematic animations, stroke-dash circuit drawing, leaderboard row reordering.
- **[Recharts](https://recharts.org/)** — Telemetry charts, gap evolution, stint visualizations.
- **[react-grid-layout](https://github.com/react-grid-layout/react-grid-layout)** — Drag-and-drop dashboard with responsive breakpoints.
- **[react-joyride](https://github.com/gilbarbara/react-joyride)** — 17-step guided onboarding tour.

### AI & Voice

- **[Anthropic Claude](https://www.anthropic.com/)** — Powers the AI insights engine and interactive chat with race-engineer persona.
- **[ElevenLabs](https://elevenlabs.io/)** — Multilingual v2 model for broadcast-quality voice commentary.

### Backend

- **[FastAPI](https://fastapi.tiangolo.com/)** — 56 async endpoints with auto-generated Swagger docs and WebSocket support.
- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** — Fallback video search engine for highlight discovery.
- **[Dailymotion API](https://developer.dailymotion.com/)** — Free video embeds that actually work (FOM doesn't Content ID block them).

---

## Documentation

| Document | Description |
|----------|-------------|
| [TECHNICAL_DEEP_DIVE.md](TECHNICAL_DEEP_DIVE.md) | How every system works — SVG rendering, spring physics, gap math, AI prompts, deployment battles. Great for a Medium article. |
| [DOCS.md](DOCS.md) | Full internal reference — all 56 endpoints, database schemas, TypeScript types, engine APIs, component architecture. |
| [`/docs`](https://your-api.up.railway.app/docs) | Interactive Swagger UI for the API |
| [`/redoc`](https://your-api.up.railway.app/redoc) | Clean ReDoc API documentation |

---

## Roadmap

- [ ] Live session support — real-time F1 timing integration during race weekends
- [ ] Multi-user rooms — shared viewing with synchronized playback
- [ ] Predictive models — ML-based tyre degradation and race outcome predictions
- [ ] Sector mini-times — color-coded mini-sectors on track map
- [ ] Mobile layout — responsive grid presets for tablet/phone
- [ ] Battle tracker — dedicated panel for wheel-to-wheel fights
- [ ] Team-branded themes — Ferrari red, McLaren papaya, Mercedes teal

---

## License

MIT

---

<div align="center">

**Built with Next.js, FastAPI, FastF1, Claude, and ElevenLabs**

*If this project helped you or you found it interesting, consider giving it a star!* ⭐

</div>
