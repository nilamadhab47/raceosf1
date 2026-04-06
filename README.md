# F1 Intelligence Console

AI-powered real-time second-screen web app for Formula 1 race analysis. Features a 60fps animated track visualization with live car positions, event detection with cinematic replay clips, AI commentary via Claude, voice synthesis via ElevenLabs, telemetry overlays, strategy simulation, and a fully draggable dashboard layout.

**Monorepo**: `apps/api` (Python FastAPI) + `apps/web` (Next.js 15 + React 19)

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Backend (`apps/api`)](#backend-appsapi)
  - [File Map](#backend-file-map)
  - [API Endpoints (60+)](#api-endpoints)
  - [Database Schema (SQLite, 9 tables)](#database-schema)
  - [External Integrations](#external-integrations)
  - [Configuration](#configuration)
- [Frontend (`apps/web`)](#frontend-appsweb)
  - [File Map](#frontend-file-map)
  - [Engine System](#engine-system)
  - [Component Architecture](#component-architecture)
  - [State Management (Zustand)](#state-management)
  - [TypeScript Types](#typescript-types)
  - [Animation System](#animation-system)
  - [Static Data Libraries](#static-data-libraries)
  - [Design System](#design-system)
- [Data Flow](#data-flow)
- [Key Design Decisions](#key-design-decisions)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Extending the Project](#extending-the-project)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (localhost:3000)                   │
│                                                                   │
│  ┌──────────┐  ┌────────────┐  ┌───────────┐  ┌──────────────┐ │
│  │ Zustand   │  │  Engines   │  │ Components│  │  Libs        │ │
│  │ f1-store  │──│ Timeline   │──│ WorldMon. │──│ trackMapping │ │
│  │ (25+ keys)│  │ EventEng.  │  │ Leaderbd. │  │ circuitData  │ │
│  │           │  │ ReplayEng. │  │ Telemetry │  │ driverData   │ │
│  │           │  │ CameraEng. │  │ Strategy  │  │ shareUtils   │ │
│  │           │  │ DirectorEng│  │ Insights  │  │ api.ts       │ │
│  │           │  │ CoordMapper│  │ Voice     │  │ types.ts     │ │
│  │           │  │ AnimLoop   │  │ TopBar    │  │              │ │
│  └──────────┘  └────────────┘  └───────────┘  └──────────────┘ │
│       │              │               │                           │
│       └──────────────┴───────────────┘                           │
│                      │ HTTP + WebSocket                          │
└──────────────────────┼───────────────────────────────────────────┘
                       │
┌──────────────────────┼───────────────────────────────────────────┐
│            BACKEND (localhost:8000)                                │
│                      │                                            │
│  ┌──────────┐  ┌─────┴─────┐  ┌──────────┐  ┌────────────────┐ │
│  │ main.py  │  │ f1_data   │  │ database  │  │ External APIs  │ │
│  │ 60+ endp.│──│ FastF1    │  │ SQLite    │  │ OpenF1 (free)  │ │
│  │ CORS     │  │ loading   │  │ 9 tables  │  │ RapidAPI (F1)  │ │
│  │ WebSocket│  │ caching   │  │ aiosqlite │  │ Anthropic AI   │ │
│  │          │  ├───────────┤  │           │  │ ElevenLabs TTS │ │
│  │          │──│ insights  │  │           │  │ YouTube (yt-dl)│ │
│  │          │  │ strategy  │  │           │  └────────────────┘ │
│  │          │  │ simulation│  │           │                      │
│  │          │  │ voice     │  │           │                      │
│  │          │  │ ai_insights│ │           │                      │
│  │          │  │ live_pulse │ │           │                      │
│  │          │  │ openf1    │  │           │                      │
│  └──────────┘  └───────────┘  └──────────┘                      │
└──────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Frontend (`apps/web`)
| Category | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.1+ |
| UI | React | 19 |
| Language | TypeScript | 5.7 |
| State | Zustand | 5 |
| Animation | GSAP | 3.14 |
| Motion | framer-motion | 11 |
| Charts | recharts | 2.15 |
| Layout | react-grid-layout | 2.2 |
| Curves | d3-scale, d3-shape, d3-interpolate | 4/3/3 |
| CSS | Tailwind CSS | 3.4 |
| Icons | lucide-react | 0.468 |
| Screenshot | html-to-image | 1.11 |

### Backend (`apps/api`)
| Category | Technology | Version |
|---|---|---|
| Framework | FastAPI | 0.109+ |
| Server | uvicorn | 0.27+ |
| F1 Data | FastF1 | 3.8+ |
| Database | aiosqlite (SQLite) | 0.20+ |
| AI | Anthropic (Claude) | 0.40+ |
| HTTP Client | httpx | 0.26+ |
| Data | pandas, numpy | 2.0+, 1.24+ |
| WebSocket | websockets | 12+ |
| Validation | pydantic | 2.5+ |

---

## Project Structure

```
f1/
├── package.json                     # Monorepo root (npm workspaces)
├── apps/
│   ├── api/                         # Python FastAPI backend
│   │   ├── main.py                  # FastAPI app, 60+ REST endpoints, 1 WebSocket
│   │   ├── f1_data.py               # FastF1 session loading + data extraction
│   │   ├── database.py              # SQLite schema (9 tables) + CRUD via aiosqlite
│   │   ├── data_sync.py             # Fetches race data (RapidAPI/OpenF1) → DB
│   │   ├── config.py                # Env-based configuration (API keys, ports)
│   │   ├── strategy.py              # Pit stop strategy simulator
│   │   ├── insights.py              # Rule-based insight engine (Protocol pattern)
│   │   ├── ai_insights.py           # Claude-enhanced AI insights
│   │   ├── simulation.py            # Race replay state machine
│   │   ├── voice.py                 # ElevenLabs TTS synthesis
│   │   ├── live_pulse.py            # RapidAPI real-time data fetcher
│   │   ├── openf1_client.py         # OpenF1 API client (free, no key)
│   │   ├── ws.py                    # WebSocket broadcast manager
│   │   ├── youtube_search.py        # YouTube highlight search (yt-dlp)
│   │   ├── rate_limiter.py          # Sliding-window rate limiter
│   │   ├── requirements.txt         # Python dependencies
│   │   ├── .env                     # Environment variables (not committed)
│   │   └── cache/                   # FastF1 data cache directory
│   │
│   └── web/                         # Next.js 15 frontend
│       ├── package.json
│       ├── tailwind.config.ts       # F1-branded design tokens
│       ├── next.config.ts
│       ├── tsconfig.json
│       ├── public/
│       │   └── tracks/              # SVG files for each circuit (22 circuits)
│       └── src/
│           ├── app/
│           │   ├── layout.tsx        # Root layout (fonts, providers, ToastSystem)
│           │   ├── page.tsx          # Main dashboard (session load, grid, engines)
│           │   └── globals.css       # Global styles + CSS animations
│           │
│           ├── engines/              # Singleton animation/event modules (NOT React)
│           │   ├── index.ts          # Barrel export
│           │   ├── Timeline.ts       # rAF-driven race clock (raceProgress, laps)
│           │   ├── EventEngine.ts    # Data-driven event detection (overtake, battle, etc.)
│           │   ├── ReplayEngine.ts   # Ring buffer (10K frames) + event clip playback
│           │   ├── CameraEngine.ts   # Virtual camera with follow/battle/wide modes
│           │   ├── DirectorEngine.ts # Auto-switches camera based on active events
│           │   ├── CoordMapper.ts    # Track-space ↔ screen-space coordinate converter
│           │   └── AnimationLoop.ts  # Shared rAF timing (delta calculation)
│           │
│           ├── components/
│           │   ├── WorldMonitor/     # Core track visualization system
│           │   │   ├── index.ts      # Barrel for GridLayout
│           │   │   ├── GridLayout.tsx # react-grid-layout dashboard (12 panels)
│           │   │   ├── TrackCanvas.tsx # 60fps SVG track + car animation (662 lines)
│           │   │   ├── TimelineBar.tsx # Play/pause/speed/scrubber controller
│           │   │   ├── EventBanner.tsx # Floating event overlay on track
│           │   │   ├── EventReplayModal.tsx # PIP mini-track replay (GSAP + framer-motion)
│           │   │   ├── ReplayPanel.tsx     # Event list + clip controls + share
│           │   │   ├── LayerToggle.tsx     # Toggle track layers (cars/labels/gaps/etc.)
│           │   │   ├── PanelWrapper.tsx    # Glass-morphism panel frame
│           │   │   ├── YouTubeHighlightsPanel.tsx # Embedded video player
│           │   │   └── YouTubeOverlay.tsx  # YouTube PIP on event match
│           │   │
│           │   ├── Leaderboard/
│           │   │   └── Leaderboard.tsx     # GSAP-animated position reordering
│           │   ├── Telemetry/
│           │   │   └── TelemetryChart.tsx  # recharts speed/throttle/brake overlay
│           │   ├── Strategy/
│           │   │   ├── StrategySimulator.tsx # Pit strategy what-if tool
│           │   │   ├── GPInfoPanel.tsx      # Circuit metadata display
│           │   │   ├── GapEvolutionChart.tsx # Gap-to-leader line chart
│           │   │   └── StintBar.tsx         # Horizontal tyre stint bars
│           │   ├── RaceControl/
│           │   │   ├── RaceControlTicker.tsx # Flag badge ticker
│           │   │   ├── RaceUpdates.tsx       # Auto-generated update feed
│           │   │   └── TeamRadioPanel.tsx    # Simulated team radio messages
│           │   ├── Insights/
│           │   │   ├── InsightsPanel.tsx     # AI insight cards (severity-colored)
│           │   │   └── AIChatInput.tsx       # Floating Claude chat drawer
│           │   ├── TopBar/
│           │   │   └── TopBar.tsx            # GP selector, mode toggle, WS indicator
│           │   ├── Weather/
│           │   │   └── WeatherWidget.tsx     # Air/track temp, humidity, wind
│           │   ├── Voice/
│           │   │   └── VoiceWidget.tsx       # TTS commentary with auto mode
│           │   ├── shared/
│           │   │   ├── KeyboardShortcuts.tsx # Global hotkeys (←/→/M/A/?)
│           │   │   ├── ToastSystem.tsx       # GSAP-animated toasts (7 types)
│           │   │   └── RaceToastWatcher.tsx  # Auto-toast on flag/leader changes
│           │   └── ui/                       # shadcn primitives
│           │
│           ├── hooks/
│           │   └── useRaceWebSocket.ts       # WS connection + message routing
│           │
│           ├── store/
│           │   └── f1-store.ts               # Central Zustand store (25+ fields)
│           │
│           └── lib/
│               ├── api.ts                    # Typed HTTP client (~40 methods)
│               ├── types.ts                  # 20+ shared TypeScript interfaces
│               ├── utils.ts                  # cn(), formatLapTime(), formatGap()
│               ├── trackMapping.ts           # Circuit key → SVG file mapping (22 circuits)
│               ├── circuitData.ts            # Static GP metadata (history, strategy, weather)
│               ├── driverData.ts             # 25 drivers + 10 teams static DB
│               ├── youtubeHighlights.ts      # GP → YouTube video ID + timestamps
│               └── shareUtils.ts             # Screenshot capture + clip URL encoding
```

---

## Backend (`apps/api`)

### Backend File Map

| File | Lines | Purpose |
|---|---|---|
| `main.py` | ~800 | FastAPI app, all endpoints, CORS, startup/shutdown, simulation loop |
| `f1_data.py` | ~300 | FastF1 session loading, caching, data extraction (laps, telemetry, positions) |
| `database.py` | ~350 | SQLite schema init, 20+ CRUD functions via aiosqlite |
| `data_sync.py` | ~200 | Fetches race data from RapidAPI/OpenF1 → saves to DB |
| `config.py` | ~40 | Environment variable loader (dotenv) |
| `strategy.py` | ~200 | Pit stop strategy simulator with recommendation logic |
| `insights.py` | ~250 | Rule-based insight detection (Protocol pattern for swapability) |
| `ai_insights.py` | ~150 | Claude integration — enhances rule-based insights with LLM analysis |
| `simulation.py` | ~150 | Race replay state machine (start/stop/reset, lap progression) |
| `voice.py` | ~100 | ElevenLabs TTS — text → audio bytes |
| `live_pulse.py` | ~200 | RapidAPI F1 Live Motorsport Data client |
| `openf1_client.py` | ~200 | OpenF1 API client (free, no API key needed) |
| `ws.py` | ~80 | WebSocket broadcast manager (ConnectionManager class) |
| `youtube_search.py` | ~100 | YouTube highlight search via yt-dlp |
| `rate_limiter.py` | ~60 | Sliding-window rate limiter |

### API Endpoints

#### Session Management
| Method | Path | Description |
|---|---|---|
| GET | `/api/session` | Current loaded session info |
| POST | `/api/session/load` | Load session (query: year, gp, session_type) |
| GET | `/api/available-sessions` | Curated list of interesting sessions |
| GET | `/api/health` | Health check |

#### Race Data (from FastF1 / in-memory)
| Method | Path | Description |
|---|---|---|
| GET | `/api/drivers` | All drivers for current session |
| GET | `/api/laps` | Lap data (query: driver optional) |
| GET | `/api/telemetry` | Telemetry arrays (query: driver, lap) |
| GET | `/api/leaderboard` | Standings at lap (query: lap) |
| GET | `/api/track-map` | Circuit outline coordinates |
| GET | `/api/driver-positions` | Driver X/Y positions at lap |
| GET | `/api/race-control` | Race control messages + flag mode at lap |
| GET | `/api/stints` | Tyre stint summaries per driver |
| GET | `/api/gap-evolution` | Gap-to-leader per lap for top N drivers |
| GET | `/api/weather` | Session weather data |

#### AI & Insights
| Method | Path | Description |
|---|---|---|
| GET | `/api/insights` | Rule-based insights at lap |
| GET | `/api/ai/insights` | Claude-enhanced insights (rule + AI) |
| POST | `/api/ai/chat` | Interactive AI chat (body: message, history, lap context) |

#### Strategy & Simulation
| Method | Path | Description |
|---|---|---|
| POST | `/api/simulate-strategy` | Pit strategy simulation → recommendation |
| GET | `/api/live` | Current simulation state |
| POST | `/api/live/start` | Start race sim (query: speed) + WS broadcast |
| POST | `/api/live/stop` | Stop simulation |
| POST | `/api/live/reset` | Reset simulation |

#### Media
| Method | Path | Description |
|---|---|---|
| POST | `/api/voice/synthesize` | Text → ElevenLabs TTS audio |
| GET | `/api/highlights/search` | YouTube highlight search |
| GET | `/api/highlights/stream` | Proxy YouTube video stream |

#### Database (stored sessions)
| Method | Path | Description |
|---|---|---|
| POST | `/api/db/sync-session` | Fetch race data → store in SQLite |
| POST | `/api/db/sync-season` | Sync all sessions for a year |
| POST | `/api/db/sync-latest` | Sync most recent session |
| GET | `/api/db/sessions` | List all stored sessions |
| GET | `/api/db/session/{id}/drivers` | Drivers from stored data |
| GET | `/api/db/session/{id}/leaderboard` | Leaderboard at lap from stored data |
| GET | `/api/db/session/{id}/laps` | Lap times from stored data |
| GET | `/api/db/session/{id}/stints` | Stints from stored data |
| GET | `/api/db/session/{id}/race-control` | Race control from stored data |
| GET | `/api/db/session/{id}/weather` | Weather from stored data |
| GET | `/api/db/session/{id}/pit-stops` | Pit stops from stored data |
| GET | `/api/db/has-data` | Check if session has stored data |

#### Mode & Rate Limiting
| Method | Path | Description |
|---|---|---|
| GET | `/api/mode` | Current data mode (simulation/live) |
| POST | `/api/mode` | Switch mode |
| GET | `/api/rate-limit` | API rate limit status |

#### Live Pulse (RapidAPI)
| Method | Path | Description |
|---|---|---|
| GET | `/api/live-pulse/timing` | Real-time timing data |
| GET | `/api/live-pulse/positions` | Real-time positions |
| GET | `/api/live-pulse/race-control` | Live race control |
| GET | `/api/live-pulse/weather` | Live weather |
| GET | `/api/live-pulse/pit-stops` | Live pit stops |
| GET | `/api/live-pulse/team-radio` | Live team radio |

#### OpenF1 (Free API)
| Method | Path | Description |
|---|---|---|
| GET | `/api/openf1/sessions` | Available sessions |
| GET | `/api/openf1/latest-session` | Most recent session |
| GET | `/api/openf1/drivers` | Drivers |
| GET | `/api/openf1/positions` | Positions |
| GET | `/api/openf1/laps` | Laps |
| GET | `/api/openf1/race-control` | Race control |
| GET | `/api/openf1/weather` | Weather |
| GET | `/api/openf1/intervals` | Intervals/gaps |
| GET | `/api/openf1/team-radio` | Team radio metadata |

#### WebSocket
| Protocol | Path | Description |
|---|---|---|
| WS | `/ws/race` | Bidirectional race data stream. Broadcasts leaderboard, positions, insights, flag changes during simulation. Accepts commands. |

### Database Schema

SQLite database with 9 tables, managed via `aiosqlite`:

#### `sessions`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| year | INTEGER | NOT NULL |
| gp | TEXT | NOT NULL |
| name | TEXT | |
| circuit | TEXT | |
| country | TEXT | |
| session_type | TEXT | DEFAULT 'Race' |
| date | TEXT | |
| total_laps | INTEGER | |
| session_key | TEXT | |
| source | TEXT | DEFAULT 'rapidapi' |
| fetched_at | TEXT | |
| raw_data | TEXT | |
| | | UNIQUE(year, gp, session_type) |

#### `drivers`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| session_id | INTEGER | REFERENCES sessions(id) |
| number | TEXT | |
| abbreviation | TEXT | |
| full_name | TEXT | |
| team | TEXT | |
| team_color | TEXT | |
| position | INTEGER | |
| grid_position | INTEGER | |
| status | TEXT | |
| points | REAL | DEFAULT 0 |
| | | UNIQUE(session_id, abbreviation) |

#### `lap_times`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| session_id | INTEGER | REFERENCES sessions(id) |
| driver | TEXT | (abbreviation) |
| lap_number | INTEGER | |
| lap_time | REAL | seconds |
| sector1, sector2, sector3 | REAL | seconds |
| compound | TEXT | S/M/H/I/W |
| tyre_life | INTEGER | laps on current set |
| stint | INTEGER | |
| is_pit_out_lap | INTEGER | DEFAULT 0 |
| is_pit_in_lap | INTEGER | DEFAULT 0 |
| speed_fl, speed_st | REAL | |
| | | UNIQUE(session_id, driver, lap_number) |

#### `positions`
| Column | Type | Notes |
|---|---|---|
| session_id | INTEGER | REFERENCES sessions(id) |
| driver | TEXT | |
| lap | INTEGER | |
| position | INTEGER | |
| gap_to_leader | REAL | seconds |
| interval_to_ahead | REAL | seconds |
| last_lap_time | REAL | |
| compound | TEXT | |
| tyre_life | INTEGER | |
| timestamp | TEXT | |

#### `race_control`
| Column | Type | Notes |
|---|---|---|
| session_id | INTEGER | REFERENCES sessions(id) |
| lap | INTEGER | |
| category | TEXT | |
| flag | TEXT | green/yellow/sc/vsc/red/chequered |
| message | TEXT | |
| timestamp | TEXT | |

#### `pit_stops`
| Column | Type | Notes |
|---|---|---|
| session_id | INTEGER | REFERENCES sessions(id) |
| driver | TEXT | |
| lap | INTEGER | |
| duration | REAL | seconds |
| compound_from | TEXT | |
| compound_to | TEXT | |
| timestamp | TEXT | |

#### `stints`
| Column | Type | Notes |
|---|---|---|
| session_id | INTEGER | REFERENCES sessions(id) |
| driver | TEXT | |
| stint_number | INTEGER | |
| compound | TEXT | |
| start_lap | INTEGER | |
| end_lap | INTEGER | |
| laps | INTEGER | |
| | | UNIQUE(session_id, driver, stint_number) |

#### `weather`
| Column | Type | Notes |
|---|---|---|
| session_id | INTEGER | REFERENCES sessions(id) |
| air_temp | REAL | |
| track_temp | REAL | |
| humidity | REAL | |
| pressure | REAL | |
| rainfall | INTEGER | DEFAULT 0 |
| wind_speed | REAL | |
| wind_direction | REAL | |
| timestamp | TEXT | |

#### `team_radio`
| Column | Type | Notes |
|---|---|---|
| session_id | INTEGER | REFERENCES sessions(id) |
| driver | TEXT | |
| message | TEXT | |
| lap | INTEGER | |
| timestamp | TEXT | |
| recording_url | TEXT | |

### External Integrations

| Service | Purpose | Key Required | Client File |
|---|---|---|---|
| **FastF1** | Historical F1 data (laps, telemetry, positions) | No | `f1_data.py` |
| **OpenF1** | Real-time F1 data (free API) | No | `openf1_client.py` |
| **RapidAPI F1 Live** | Premium real-time timing, radio, pit stops | Yes (`RAPIDAPI_KEY`) | `live_pulse.py` |
| **Anthropic Claude** | AI insights enhancement + chat | Yes (`ANTHROPIC_API_KEY`) | `ai_insights.py` |
| **ElevenLabs** | Text-to-speech voice commentary | Yes (`ELEVENLABS_API_KEY`) | `voice.py` |
| **YouTube (yt-dlp)** | Highlight video search + streaming | No | `youtube_search.py` |

### Configuration

All config is in `config.py`, loaded from `.env` via `python-dotenv`:

| Variable | Type | Default | Description |
|---|---|---|---|
| `FASTF1_CACHE_DIR` | str | `"./cache"` | FastF1 data cache path |
| `ELEVENLABS_API_KEY` | str | `""` | ElevenLabs TTS API key |
| `ANTHROPIC_API_KEY` | str | `""` | Claude API key |
| `RAPIDAPI_KEY` | str | `""` | RapidAPI F1 Live key |
| `LIVE_MODE_ENABLED` | bool | `False` | Enable live data mode |
| `FRONTEND_URL` | str | `"http://localhost:3000"` | CORS origin |
| `API_HOST` | str | `"0.0.0.0"` | Server bind host |
| `API_PORT` | int | `8000` | Server bind port |

---

## Frontend (`apps/web`)

### Frontend File Map

| File | Lines | Purpose |
|---|---|---|
| **Engines** | | |
| `engines/Timeline.ts` | 105 | rAF-driven race clock — `raceProgress`, `lapProgress`, speed control |
| `engines/EventEngine.ts` | 424 | Data-driven event detection (5 types) with per-type clip configs |
| `engines/ReplayEngine.ts` | 170 | 10K-frame ring buffer, 2Hz recording, event clip playback |
| `engines/CameraEngine.ts` | ~150 | Virtual camera state (follow/battle/wide modes, zoom, target) |
| `engines/DirectorEngine.ts` | ~120 | Auto-switches camera mode based on active events |
| `engines/CoordMapper.ts` | ~100 | Track-space ↔ screen-space coordinate mapping |
| `engines/AnimationLoop.ts` | ~60 | Shared rAF timing, delta-time calculation |
| **Core Components** | | |
| `WorldMonitor/TrackCanvas.tsx` | 662 | 60fps SVG track with car dots, trails, gap labels, tyre indicators |
| `WorldMonitor/GridLayout.tsx` | ~250 | Draggable dashboard with 12 panels via react-grid-layout |
| `WorldMonitor/TimelineBar.tsx` | ~200 | Play/pause/speed/seek — syncs frontend rAF + backend sim |
| `WorldMonitor/EventReplayModal.tsx` | 456 | PIP mini-track replay with GSAP camera animation |
| `WorldMonitor/ReplayPanel.tsx` | ~200 | Event timeline, clip controls, filter pills, share button |
| `WorldMonitor/EventBanner.tsx` | ~120 | Floating broadcast-style event overlay |
| `Leaderboard/Leaderboard.tsx` | ~200 | GSAP-animated row reordering on position changes |
| `Telemetry/TelemetryChart.tsx` | ~200 | recharts area chart for speed/throttle/brake comparison |
| `Strategy/StrategySimulator.tsx` | ~200 | Pit strategy what-if simulator |
| `Strategy/GapEvolutionChart.tsx` | ~200 | Gap-to-leader line chart (recharts) |
| `Strategy/StintBar.tsx` | ~100 | Horizontal tyre stint visualization |
| `Strategy/GPInfoPanel.tsx` | ~150 | Static circuit metadata display |
| `RaceControl/RaceUpdates.tsx` | ~200 | Auto-derived race update feed |
| `RaceControl/RaceControlTicker.tsx` | ~100 | Scrolling race control messages with flag badges |
| `RaceControl/TeamRadioPanel.tsx` | ~150 | Simulated team radio messages |
| `Insights/InsightsPanel.tsx` | ~150 | AI insight cards with severity badges |
| `Insights/AIChatInput.tsx` | ~200 | Floating Claude chat drawer |
| `TopBar/TopBar.tsx` | ~200 | GP selector, live/sim toggle, WS status, rate limits |
| `Weather/WeatherWidget.tsx` | ~100 | Air/track temp, humidity, wind |
| `Voice/VoiceWidget.tsx` | ~200 | TTS commentary queue with auto-commentary mode |
| **Shared** | | |
| `shared/KeyboardShortcuts.tsx` | 125 | Global hotkeys (←/→/M/A/Esc/?) |
| `shared/ToastSystem.tsx` | 155 | GSAP-animated toast system (7 types) |

### Engine System

The engines are **singleton Zustand stores** (not React components). They run outside the React render cycle for high-performance 60fps animation. All engines are in `src/engines/`.

#### Timeline (`Timeline.ts`)
The race clock. Drives all time-dependent components.

| Constant | Value | Description |
|---|---|---|
| `BASE_LAP_SECONDS` | 12 | Wall-clock seconds per lap at 1x speed |
| `SPEED_OPTIONS` | [0.25, 0.5, 1, 2, 5, 10] | Available speed multipliers |

| State Field | Type | Description |
|---|---|---|
| `raceProgress` | number | Fractional laps (e.g., 10.456 = lap 10, 45.6% through) |
| `currentLap` | number | `floor(raceProgress) + 1` (1-based for display) |
| `lapProgress` | number | `raceProgress % 1` (0.0–1.0 within current lap) |
| `totalLaps` | number | Total laps in race |
| `avgLapTime` | number | Average lap time in seconds (for gap-to-progress conversion) |
| `isPlaying` | boolean | Whether clock is ticking |
| `speed` | number | Current speed multiplier |
| `progress` | number | 0–100 for scrubber UI |

| Method | Description |
|---|---|
| `play()` / `pause()` / `togglePlay()` | Playback control |
| `seek(lap)` | Jump to specific lap |
| `setSpeed(speed)` | Change speed multiplier |
| `stepForward()` / `stepBackward()` | ±1 lap |
| `tick(deltaMs)` | Called by rAF — advances `raceProgress` |
| `syncFromLive(lap, total, isRunning)` | Sync from backend simulation |

#### EventEngine (`EventEngine.ts`)
Detects race events by comparing consecutive leaderboard snapshots.

**Event Types**: `overtake`, `battle`, `pit_stop`, `incident`, `fastest_lap`

**Detection Logic**:
- **Overtake**: Position swap between consecutive laps (gap-delta interpolation for micro-timing)
- **Battle**: Gap < 1.0s between consecutive drivers
- **Pit Stop**: Stint number increase
- **Incident**: Yellow/SC/VSC/Red flag from race control
- **Fastest Lap**: New best lap time in session

**Clip Configuration** (per event type):
```typescript
CLIP_CONFIG = {
  overtake:    { before: 0.3, after: 0.2, camera: "battle", zoom: 2.8 },
  battle:      { before: 0.5, after: 0.5, camera: "battle", zoom: 2.0 },
  pit_stop:    { before: 0.2, after: 0.3, camera: "follow", zoom: 2.5 },
  incident:    { before: 0.4, after: 0.6, camera: "follow", zoom: 2.2 },
  fastest_lap: { before: 0.2, after: 0.15, camera: "follow", zoom: 2.5 },
}
```
`before`/`after` are in fractional laps. `buildClip()` creates an `EventClip` anchored to the actual `raceProgress` at detection time.

**Active Events Window**: Events remain "active" for 10 seconds after detection.

#### ReplayEngine (`ReplayEngine.ts`)
Records frames and plays back event clips.

| Constant | Value |
|---|---|
| `MAX_FRAMES` | 10,000 (ring buffer) |
| Recording rate | 2Hz (every 500ms) |
| `REPLAY_SPEED_OPTIONS` | [0.25, 0.5, 1, 2] |
| Default speed | 0.25x (cinematic) |

Each frame stores: `{ time, positions: DriverPosition[], leaderboard: LeaderboardEntry[] }`.

`openEvent(event)` → looks up clip from EventEngine → starts playing frame range in PIP modal.

#### CameraEngine (`CameraEngine.ts`)
Virtual camera with three modes:
- **follow**: Tracks a single driver
- **battle**: Frames two battling drivers
- **wide**: Full track overview

State: `mode`, `target` (driver abbr or pair), `zoom`, `center`, `rotation`.

#### DirectorEngine (`DirectorEngine.ts`)
Auto-pilot that switches camera mode based on active events. Higher-severity events take priority. Falls back to `wide` mode when idle.

#### CoordMapper (`CoordMapper.ts`)
Converts between track-space coordinates (from SVG path samples) and screen-space pixels. Handles SVG viewBox transformations.

#### AnimationLoop (`AnimationLoop.ts`)
Shared `requestAnimationFrame` manager. Calculates delta-time, distributes ticks to registered callbacks.

### Component Architecture

#### GridLayout (Dashboard)
The main dashboard uses `react-grid-layout` with 12 draggable/resizable panels:

1. **TrackCanvas** — Animated track visualization
2. **Leaderboard** — Live standings
3. **RaceUpdates** — Auto-generated feed
4. **TelemetryChart** — Speed/throttle/brake overlay
5. **StrategySimulator** — Pit strategy tool
6. **InsightsPanel** — AI insights
7. **GapEvolutionChart** — Gap line chart
8. **StintBar** — Tyre stint bars
9. **TeamRadioPanel** — Radio messages
10. **GPInfoPanel** — Circuit metadata
11. **YouTubeHighlightsPanel** — Video player
12. **ReplayPanel** — Event clip controls

Each panel is wrapped in `PanelWrapper` (glass-morphism frame) + `PanelErrorBoundary`.

#### TrackCanvas (Animation Heart)
The most complex component. Key architecture:

1. **SVG Loading**: Loads circuit SVG from `/public/tracks/`, parses `<path>` elements
2. **Path Sampling**: Samples SVG path into 600 equidistant points
3. **Car Positioning**: Each car's position = `lapProgress + gapOffset` mapped to path sample index
4. **Smooth Offset Decay**: Single-layer animation system:
   - `CarAnimData` per driver: `{ targetOffset, smoothOffset, targetSpread, smoothSpread }`
   - Each frame: `smoothOffset += (targetOffset - smoothOffset) * GAP_SMOOTH` where `GAP_SMOOTH = 0.03`
   - No dual-LERP, no `prevSlotsRef` — one exponential decay per car per frame
5. **Rendering**: Raw SVG elements + rAF loop (no React re-renders in hot path, all via refs)
6. **Layers**: Cars, labels, racing line, sectors, gap labels, tyre indicators — each toggleable

### State Management

Central Zustand store (`f1-store.ts`) with **25+ state fields** and **25+ actions**.

#### State Fields
```typescript
session: SessionInfo | null
loading: boolean
error: string | null
drivers: Driver[]
leaderboard: LeaderboardEntry[]
telemetry1: TelemetryData | null
telemetry2: TelemetryData | null
selectedDriver1: string
selectedDriver2: string
selectedLap: number
insights: Insight[]
liveState: LiveState | null
positions: DriverPosition[]
wsConnected: boolean
mode: "simulation" | "live"
liveAvailable: boolean
rateLimit: RateLimitStatus | null
flagMode: FlagMode
raceControlMessages: RaceControlEvent[]
voiceMuted: boolean
autoCommentary: boolean
focusedDriver: string | null
chatMessages: ChatMessage[]
```

#### Key Actions
| Action | Description |
|---|---|
| `loadSession(year, gp)` | Loads session → fetches drivers, leaderboard, insights |
| `fetchLeaderboard(lap?)` | GET `/api/leaderboard` → updates store |
| `fetchTelemetry(driver, lap, slot)` | GET `/api/telemetry` → updates telemetry1 or telemetry2 |
| `fetchInsights(lap?)` | GET `/api/insights` → updates insights |
| `setLeaderboard(data)` | Direct setter (used by WS handler) |
| `setPositions(data)` | Direct setter (used by WS handler) |
| `setFlagMode(flag)` | Direct setter |
| `addChatMessage(msg)` | Append to chat history |
| `setFocusedDriver(driver)` | Opens driver focus modal |

### TypeScript Types

All shared types in `src/lib/types.ts` (20+ interfaces):

| Interface | Key Fields |
|---|---|
| `SessionInfo` | year, name, circuit, country, session_type, date, total_laps |
| `Driver` | number, abbreviation, full_name, team, team_color, position, grid_position |
| `LapData` | driver, lap_number, lap_time, sector1/2/3, compound, tyre_life, stint |
| `TelemetryData` | driver, lap_number, distance[], speed[], throttle[], brake[], rpm[], gear[], drs[] |
| `LeaderboardEntry` | driver, full_name, team, team_color, position, current_lap, last_lap_time, compound, tyre_life, gap_to_leader |
| `Insight` | type, severity, driver, message, confidence, lap |
| `StrategyResult` | driver, pit_lap, new_compound, time_delta_vs_no_stop, projected_position, recommendation, explanation |
| `LiveState` | current_lap, total_laps, is_running, speed, progress |
| `WeatherData` | air_temp, track_temp, humidity, rainfall, wind_speed |
| `TrackMapData` | x[], y[], corners[], x_min, x_max, y_min, y_max |
| `DriverPosition` | driver, full_name, team_color, x, y, position |
| `RateLimitStatus` | used, remaining, limit, window_seconds |
| `FlagMode` | type: "green" \| "yellow" \| "sc" \| "vsc" \| "red" \| "chequered" |
| `RaceControlEvent` | time, lap, category, flag, message |
| `StintInfo` | compound, stint, start_lap, end_lap, laps |
| `DriverStints` | driver, stints[] |
| `GapEvolutionData` | laps[], drivers[] (each with gaps[]) |

### Animation System

The track visualization uses a **single-layer smooth offset decay** model (NOT dual-LERP).

**Why**: The original dual-LERP system (gap interpolation + progress LERP) caused:
- 206 cumulative track-sample shifts across all 20 drivers simultaneously at lap boundaries
- Position `* 0.002` spread used NEW positions instantly → visual discontinuity
- Two interpolation layers fighting each other → jerky motion
- Event replay clips showed frames from BEFORE the visual transition

**Current model** (in `TrackCanvas.tsx`):
```
Per driver per frame:
  CarAnimData { targetOffset, smoothOffset, targetSpread, smoothSpread }

  buildDriverSlots() sets targetOffset and targetSpread from new leaderboard data
  rAF loop: smoothOffset += (targetOffset - smoothOffset) * 0.03
            smoothSpread += (targetSpread - smoothSpread) * 0.03

  Final track position = lapProgress + smoothOffset + smoothSpread
  → mapped to pathSample[index % 600]
```

Each car decays independently at `GAP_SMOOTH = 0.03` per frame (~60fps → ~1.8/sec). This means transitions complete in ~50-100 frames (0.8–1.7 seconds), creating smooth visible overtakes.

### Static Data Libraries

| File | Contents |
|---|---|
| `trackMapping.ts` | 22 circuits mapped to SVG filenames + metadata. `resolveTrack(circuitRef)` with fuzzy alias lookup. |
| `circuitData.ts` | Static GP metadata: history, typical weather, strategy notes, key facts for 8+ circuits. |
| `driverData.ts` | 25 drivers (abbr, name, number, team, DOB, photo URL, helmet emoji) + 10 teams (principal, engine, championships). |
| `youtubeHighlights.ts` | Static DB of GP → YouTube video IDs + lap-based event timestamps for 6 races. Backend search fallback. |
| `shareUtils.ts` | `encodeClipUrl()`, `decodeClipParams()`, `captureScreenshot()` for shareable replay clips. |

### Design System

Tailwind config (`tailwind.config.ts`) with F1-branded tokens:

**Colors**:
- Background: `f1-bg` (#0a0a0f), `f1-surface`, `f1-surface-2`
- Text: `f1-text`, `f1-text-dim`, `f1-text-muted`
- Accents: `f1-green`, `f1-purple`, `f1-red`, `f1-amber`, `f1-cyan`, `f1-gold`
- Tyre compounds: soft (red), medium (yellow), hard (white), intermediate (green), wet (blue)

**Fonts**:
- Display: Orbitron
- Mono: JetBrains Mono
- Body: Exo 2

**Custom Animations**: `dash-flow`, `pulse-glow`, `live-pulse`, `ticker-scroll`, `number-tick`, `shimmer`

**Shadows/Glows**: `glow-green`, `glow-purple`, `glow-red`, `glow-cyan`, `glow-amber`

---

## Data Flow

### Simulation Mode (default)
```
1. User selects GP → POST /api/session/load → FastF1 downloads + caches data
2. Frontend loads drivers, leaderboard(lap=1), positions, weather, insights
3. User presses Play → POST /api/live/start
4. Backend simulation loop: increments lap every N seconds, broadcasts via /ws/race
5. WS messages update: leaderboard, positions, insights, flagMode → Zustand store
6. Timeline.tick(delta) advances raceProgress independently at 60fps
7. TrackCanvas reads lapProgress + leaderboard gaps → positions cars on SVG path
8. EventEngine.processLeaderboard() detects events → triggers ReplayEngine clips
9. EventReplayModal opens PIP with GSAP camera animation for event clips
```

### Live Mode (requires RapidAPI key)
```
1. POST /api/mode → switch to "live"
2. Frontend polls /api/live-pulse/* endpoints at intervals
3. Same visualization pipeline, but data is real-time from F1 timing feeds
4. OpenF1 endpoints are a free fallback for basic data
```

### Database Mode (offline)
```
1. POST /api/db/sync-session → fetches from RapidAPI/OpenF1 → stores in SQLite
2. GET /api/db/session/{id}/* → serves stored data
3. No FastF1 dependency for stored sessions
```

---

## Key Design Decisions

1. **Engines as Zustand singletons** — Not React components. Engines run outside React's render cycle via `requestAnimationFrame` for 60fps animation without triggering re-renders.

2. **Single-layer offset decay** — The animation system uses one exponential decay (`smoothOffset += (target - smooth) * 0.03`) per car per frame. This replaced a dual-LERP system that caused visual discontinuities at lap boundaries.

3. **Event-driven replays** — `EventEngine` detects events from leaderboard diffs. Each event type has clip timing config (how many fractional laps before/after to capture). `ReplayEngine` records 2Hz frames into a 10K ring buffer, then plays back the relevant range in a PIP overlay.

4. **Three data sources** — FastF1 (historical, most complete), RapidAPI (real-time, paid), OpenF1 (real-time, free but limited). The `mode` system switches between simulation and live.

5. **SVG path sampling** — Circuit outlines are stored as SVG `<path>` elements. `TrackCanvas` samples each path into 600 equidistant points. Cars are placed at `pathSample[normalizedProgress * 600]`.

6. **Protocol-based insights** — `insights.py` uses Python's `Protocol` pattern. The rule-based engine can be swapped for an LLM-based generator by implementing the same interface.

7. **Glass-morphism UI** — Dark theme (#0a0a0f) with neon accent colors (green/purple/red/cyan). Panels use glass-morphism (`backdrop-blur` + semi-transparent backgrounds). All standard for F1 broadcast aesthetic.

8. **WebSocket for simulation** — During race replay, the backend broadcasts leaderboard/positions/flags via WebSocket rather than polling. Frontend `useRaceWebSocket` hook routes messages to Zustand setters.

---

## Quick Start

### Prerequisites
- **Node.js 18+**
- **Python 3.10+** (with pip)

### 1. Install Dependencies

```bash
# Root (installs concurrently)
npm install

# Backend
cd apps/api
python3 -m pip install -r requirements.txt

# Frontend
cd apps/web
npm install
```

### 2. Configure Environment (Optional)

Create `apps/api/.env`:
```env
ANTHROPIC_API_KEY=sk-...        # For AI insights + chat
ELEVENLABS_API_KEY=...          # For voice commentary
RAPIDAPI_KEY=...                # For live race data
```

All API keys are optional. Core functionality works without them.

### 3. Start Both Servers

```bash
# From project root
npm run dev

# Or separately:
# Terminal 1: cd apps/api && python3 -m uvicorn main:app --reload --port 8000
# Terminal 2: cd apps/web && npm run dev
```

> **First run**: FastF1 downloads and caches race data (~30s–2min per session).

### 4. Open http://localhost:3000

Select a GP from the dropdown, press Play.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `FASTF1_CACHE_DIR` | No | `./cache` | FastF1 data cache path |
| `ANTHROPIC_API_KEY` | No | `""` | Claude API key for AI insights + chat |
| `ELEVENLABS_API_KEY` | No | `""` | ElevenLabs API key for voice commentary |
| `RAPIDAPI_KEY` | No | `""` | RapidAPI key for F1 Live Motorsport Data |
| `LIVE_MODE_ENABLED` | No | `false` | Enable live data mode |
| `FRONTEND_URL` | No | `http://localhost:3000` | CORS allowed origin |
| `API_HOST` | No | `0.0.0.0` | Backend bind host |
| `API_PORT` | No | `8000` | Backend bind port |

---

## Extending the Project

### Adding a New Dashboard Panel
1. Create component in `src/components/YourFeature/YourPanel.tsx`
2. Import in `GridLayout.tsx`, add to the layout array and JSX
3. Wrap in `<PanelWrapper title="..." icon={...}>`

### Adding a New Engine
1. Create Zustand store in `src/engines/YourEngine.ts` using `create<>()(...)`
2. Export from `src/engines/index.ts`
3. Call from `TrackCanvas.tsx` rAF loop or `page.tsx` effects

### Adding a New API Endpoint
1. Add route in `main.py` with `@app.get("/api/your-endpoint")`
2. Add typed method in `src/lib/api.ts`
3. Add response type in `src/lib/types.ts` if needed

### Adding a New Event Type
1. Add to `RaceEventType` union in `EventEngine.ts`
2. Add detection logic in `processLeaderboard()`
3. Add `CLIP_CONFIG` entry for clip timing
4. Add styling in `EventBanner.tsx` and `ReplayPanel.tsx`

### Swapping Insight Engine for LLM
```python
# In insights.py — implement the Protocol:
class InsightGenerator(Protocol):
    def generate(self, session, at_lap=None) -> list[dict]: ...

# Create your LLM implementation and assign to insight_engine
```

### Adding a New Track SVG
1. Add SVG file to `apps/web/public/tracks/YourCircuit.svg` (must contain `<path>` elements)
2. Add mapping in `src/lib/trackMapping.ts` with circuit key, filename, metadata

---

## Dependency Graph

```
page.tsx
├── f1-store (zustand) ← lib/api ← lib/types
├── useRaceWebSocket → f1-store
├── TopBar → f1-store, Timeline, api, WeatherWidget
├── GridLayout (react-grid-layout)
│   ├── TrackCanvas → Timeline, EventEngine, ReplayEngine, CameraEngine,
│   │                  DirectorEngine, CoordMapper, AnimationLoop, trackMapping
│   │   ├── EventBanner → EventEngine
│   │   └── EventReplayModal → ReplayEngine (gsap, framer-motion)
│   ├── TimelineBar → Timeline, f1-store, api
│   ├── Leaderboard → f1-store, Timeline (gsap)
│   ├── TelemetryChart → f1-store, Timeline (recharts)
│   ├── StrategySimulator → f1-store, api
│   ├── InsightsPanel → f1-store, Timeline
│   ├── GapEvolutionChart → f1-store, api (recharts)
│   ├── StintBar → f1-store, api
│   ├── RaceUpdates → f1-store, Timeline
│   ├── TeamRadioPanel → f1-store, Timeline, EventEngine
│   ├── GPInfoPanel → f1-store, circuitData
│   ├── YouTubeHighlightsPanel → f1-store, Timeline, youtubeHighlights, api
│   └── ReplayPanel → EventEngine, ReplayEngine, Timeline
├── VoiceWidget → f1-store, Timeline, api
├── AIChatInput → f1-store, Timeline, api
├── KeyboardShortcuts → f1-store
├── ToastProvider + RaceToastWatcher → f1-store (gsap)
└── DriverFocusModal → f1-store, driverData
```

---

## License

MIT
