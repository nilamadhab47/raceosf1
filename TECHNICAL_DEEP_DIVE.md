# Building an F1 Race Intelligence Dashboard: A Technical Deep Dive

*How I built a real-time Formula 1 operations system with live circuit visualization, AI race analysis, spring-physics camera engine, and voice commentary — from GPS telemetry to production deployment.*

---

## Table of Contents

1. [The Vision](#the-vision)
2. [Turning GPS Data Into a Living Circuit](#turning-gps-data-into-a-living-circuit)
3. [Animating 20 Cars at 60fps — Without React Re-renders](#animating-20-cars-at-60fps--without-react-re-renders)
4. [A Spring-Damper Camera That Feels Like a Broadcast](#a-spring-damper-camera-that-feels-like-a-broadcast)
5. [The Math Behind Gap Visualization](#the-math-behind-gap-visualization)
6. [Detecting Overtakes with Sub-Lap Precision](#detecting-overtakes-with-sub-lap-precision)
7. [Telemetry Graphs: Two Drivers, One X-Axis](#telemetry-graphs-two-drivers-one-x-axis)
8. [AI Insights: Rule Engine Meets Claude](#ai-insights-rule-engine-meets-claude)
9. [Strategy Simulator: Should You Pit or Stay Out?](#strategy-simulator-should-you-pit-or-stay-out)
10. [Real-Time Architecture: WebSockets All the Way Down](#real-time-architecture-websockets-all-the-way-down)
11. [Timeline Replay with a 10,000-Frame Ring Buffer](#timeline-replay-with-a-10000-frame-ring-buffer)
12. [ElevenLabs Voice: Making the Dashboard Talk](#elevenlabs-voice-making-the-dashboard-talk)
13. [The Grid Layout — A Drag-and-Drop War Room](#the-grid-layout--a-drag-and-drop-war-room)
14. [Deployment: Railway, Vercel, and the YouTube Copyright Wall](#deployment-railway-vercel-and-the-youtube-copyright-wall)
15. [Architecture Overview](#architecture-overview)
16. [Credits & Acknowledgements](#credits--acknowledgements)
17. [Lessons Learned](#lessons-learned)

---

## The Vision

Formula 1 generates an extraordinary amount of data every race weekend — telemetry from 20 cars streaming at 300Hz, real-time timing down to thousandths of a second, tire compound strategies, weather conditions, and radio communications. The official F1 live timing app gives you tables. I wanted something different: a **visual intelligence dashboard** that makes you *feel* the race unfolding.

The result is F1 Intelligence Studio — a full-stack application where animated driver dots chase each other around a telemetry-derived SVG circuit, an AI race engineer whispers insights, a camera engine zooms into battles with spring physics, and you can replay any moment with frame-perfect scrubbing.

**Tech Stack:**
- **Frontend:** Next.js 14 + TypeScript, Zustand, GSAP, Recharts, react-grid-layout
- **Backend:** FastAPI (Python), FastF1 (F1 data library), Anthropic Claude, ElevenLabs TTS
- **Deployment:** Vercel (frontend) + Railway (backend via Docker)

Let's break down the most interesting engineering challenges.

---

## Turning GPS Data Into a Living Circuit

The first challenge was fundamental: **how do you draw an F1 circuit programmatically?**

I didn't want to use static SVG files for the track map (though I do use those for a separate hero animation). I wanted the track shape to come directly from the telemetry data — the actual path a car drove. This way, every circuit is rendered from real GPS coordinates, not an artist's approximation.

### Extracting the Path

FastF1, the Python library for F1 data, gives you access to telemetry from any session. I take the fastest lap and extract its position data — raw X/Y coordinates in meters from the circuit's local coordinate system:

```python
def get_track_map(session):
    fastest = session.laps.pick_fastest()
    pos = fastest.get_pos_data()
    x, y = np.array(pos["X"]), np.array(pos["Y"])
```

These raw coordinates need to be projected into an SVG viewBox. The key insight is to use **uniform scaling** — both axes get the same scale factor — to preserve the circuit's true aspect ratio. I normalize everything into a 0–1000 coordinate space with 50px padding:

```python
x_range = x_max - x_min
y_range = y_max - y_min
scale = max(x_range, y_range)  # uniform scale preserves aspect ratio

x_norm = ((x - x_min) / scale * 900 + 50).tolist()
y_norm = ((y - y_min) / scale * 900 + 50).tolist()
```

The frontend receives these normalized points and builds an SVG `<path>` element. But here's where it gets interesting.

### The 1,000-Point Sampling Trick

Raw telemetry gives you points that are **unevenly spaced** — the car slows in corners (clustered points) and accelerates on straights (sparse points). If I used these directly for car positioning, a car at "50% around the track" would be somewhere in the middle of the point array, not actually at the track's geometric midpoint.

The solution: **resample the SVG path into 1,000 equally-spaced points.** I exploit the browser's built-in SVG geometry engine by temporarily mounting an invisible `<path>` element and calling `getPointAtLength()`:

```typescript
function samplePath(pathD: string, count: number): TrackSample[] {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathD);
  
  // Temporarily mount to get getTotalLength() — browser does the math
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.appendChild(path);
  document.body.appendChild(svg);
  
  const total = path.getTotalLength();
  const samples: TrackSample[] = [];
  
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const pt = path.getPointAtLength(t * total);
    samples.push({ x: pt.x, y: pt.y, progress: t });
  }
  
  document.body.removeChild(svg);
  return samples;
}
```

Now `samples[500]` is *exactly* the midpoint of the track, and looking up any position is **O(1)** with linear interpolation between the two nearest samples. This is the foundation that makes everything else possible — car animation, camera tracking, overtake visualization, pit lane offsets — all of it is just a lookup into this 1,000-point array.

### The Static SVG Fallback

For the landing page hero animation, I use a second system: pre-made SVG circuit files loaded from `/tracks/{circuit}.svg`. A mapping file resolves circuit names through three fallback levels: direct key → alias → fuzzy string match. GSAP animates the stroke-dashoffset for a satisfying "draw-on" effect in 1.5 seconds.

---

## Animating 20 Cars at 60fps — Without React Re-renders

This is arguably the most performance-critical code in the entire application. Twenty driver dots need to move smoothly around the circuit at 60fps, responding to real-time gap data, pit stops, and position changes. The naive approach — updating React state 60 times per second for 20 drivers — would be catastrophic.

### Zero Re-renders in the Hot Path

**The entire animation loop runs outside React's reconciliation cycle.** All driver positions are stored in `useRef` objects, and DOM updates happen via direct `setAttribute` calls:

```typescript
const carGroup = svg.getElementById(`car-${slot.driver}`);
carGroup.setAttribute(
  "transform",
  `translate(${drawX.toFixed(1)}, ${drawY.toFixed(1)})`
);
```

React state updates are **throttled to 500ms** and only used for non-critical UI like the bottom bar driver badges. The animation itself is a `requestAnimationFrame` loop that touches only refs and raw DOM.

### The Position Formula

Each car's position on the track is expressed as a float between 0 and 1 (0% to 100% around the circuit). The core formula every frame:

```typescript
const GAP_SMOOTH = 0.03;  // exponential smoothing constant

// Smooth toward target values (prevents jumping)
anim.smoothOffset += (anim.targetOffset - anim.smoothOffset) * GAP_SMOOTH;
anim.smoothSpread += (anim.targetSpread - anim.smoothSpread) * GAP_SMOOTH;

// Calculate track position
let carProgress = leaderProgress - anim.smoothOffset + anim.smoothSpread;
carProgress = ((carProgress % 1) + 1) % 1;  // wrap around [0, 1)
```

Where `targetOffset = gap_to_leader / averageLapTime` converts a gap in seconds into a fraction of the track. If a driver is 1.2 seconds behind the leader and the average lap time is 90 seconds, they're placed 1.33% of the track behind. The exponential smoothing (factor 0.03) means position changes ease into place over ~30 frames rather than jumping.

### Starting Grid Spread

On laps 1-2, there's a special case. Drivers haven't completed a lap yet, so there's no gap data. Instead, I spread them by grid position:

```typescript
if (currentLap <= 2) {
  anim.targetOffset = position * 0.018;  // 1.8% per grid slot
}
```

This gives a realistic-looking formation that gradually transitions to actual race data.

### The Pit Stop Trick

When a driver enters the pits, I can't show them on the actual pit lane (that would require a separate path). Instead, I push the dot **perpendicular to the track direction** by 35 pixels — creating the visual illusion of a pit lane running alongside the circuit:

```typescript
if (slot.isPitting) {
  const ahead = getTrackPoint(samples, carProgress + 0.005);
  const dx = ahead.x - pos.x;
  const dy = ahead.y - pos.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  
  // Perpendicular offset: rotate direction vector 90°
  drawX += (-dy / len) * PIT_LANE_OFFSET;
  drawY += (dx / len) * PIT_LANE_OFFSET;
}
```

The math is simple: take the direction vector from the current point to a point slightly ahead, rotate it 90°, and offset by 35px. The result is surprisingly convincing.

### O(1) Position Lookup

Looking up a car's pixel coordinates from its track progress is dirt cheap thanks to the pre-sampled array:

```typescript
function getTrackPoint(samples: TrackSample[], progress: number) {
  let p = ((progress % 1) + 1) % 1;
  const idx = p * (samples.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, samples.length - 1);
  const t = idx - lo;
  
  return {
    x: samples[lo].x + (samples[hi].x - samples[lo].x) * t,
    y: samples[lo].y + (samples[hi].y - samples[lo].y) * t,
  };
}
```

Linear interpolation between the two nearest samples. No binary search, no iteration. This is called 20 times per frame (once per car) and barely registers on a profiler.

---

## A Spring-Damper Camera That Feels Like a Broadcast

Real F1 broadcasts have a distinctive camera feel — the camera follows the action but with a smooth, weighted quality. It doesn't snap to targets; it *glides*. I wanted to replicate that.

### Spring Physics, Not GSAP

I deliberately chose **not** to use GSAP or CSS transitions for the camera. Spring-damper physics gives a more organic feel because the motion depends on velocity, not just position. The camera accelerates toward its target, overshoots slightly, and settles — like a real camera rig with inertia.

```typescript
const SPRING = 0.045;     // spring stiffness
const DAMPING = 0.82;     // velocity decay per frame
const ZOOM_SPRING = 0.03;
const ZOOM_DAMPING = 0.85;

function tick(dt: number) {
  const dtNorm = Math.min(dt / 16.67, 3);  // normalize to 60fps, cap at 3x
  
  // Spring force pulls toward target
  vx += (targetX - x) * SPRING * dtNorm;
  vy += (targetY - y) * SPRING * dtNorm;
  vz += (targetZoom - zoom) * ZOOM_SPRING * dtNorm;
  
  // Damping decays velocity
  vx *= DAMPING;
  vy *= DAMPING;
  vz *= ZOOM_DAMPING;
  
  // Apply velocity
  x += vx * dtNorm;
  y += vy * dtNorm;
  zoom += vz * dtNorm;
}
```

The `dtNorm` normalization ensures consistent behavior regardless of frame rate — a 30fps client feels the same as a 144fps one.

### Dynamic Battle Zoom

When two drivers are battling, the camera automatically zooms in to keep both in frame:

```typescript
const dx = Math.abs(driver1.x - driver2.x);
const dy = Math.abs(driver1.y - driver2.y);
const dist = Math.max(dx, dy) + BATTLE_PADDING;  // 200px padding

targetZoom = Math.min(
  BATTLE_ZOOM_MAX,  // 3.0x — maximum zoom for close battles
  Math.max(BATTLE_ZOOM_MIN, VIEWBOX_SIZE / dist)  // 1.8x minimum
);
```

When drivers are wheel-to-wheel (small `dist`), the zoom magnifies up to 3x. As they separate, it pulls back — all springing smoothly through the physics system.

### GPU-Composited Transforms

The output of the camera engine is a CSS `transform` applied to an SVG `<g>` element, not a `viewBox` change:

```typescript
function computeTransform(cx, cy, zoom) {
  const tx = CENTER - cx * zoom;
  const ty = CENTER - cy * zoom;
  return { tx, ty, scale: zoom };
}

// Applied as: transform="translate(tx, ty) scale(zoom)"
```

This is critical for performance. Changing `viewBox` triggers SVG relayout. Changing `transform` on a `<g>` element is a **compositor-only operation** — the browser doesn't need to recalculate any geometry, it just moves and scales the texture on the GPU.

### The AI Director

The **DirectorEngine** decides *what* the camera should follow. It's a priority-based scoring system inspired by actual TV direction:

```
Score = basePriority + severityBonus + continuityBonus - samePairSuppression
```

Events are scored by type (incidents score highest, then battles, then overtakes), boosted by severity, given a bonus if the camera is already tracking nearby (continuity), and penalized if we just showed the same drivers (suppress repetition).

Each event has a **minimum hold time** — incidents hold for 8 seconds, battles for 6, overtakes for 5 — and a 10-second cooldown before revisiting the same pair. This prevents the frantic camera-switching that would make the visualization unwatchable.

---

## The Math Behind Gap Visualization

In F1, gaps between drivers are measured in seconds, not meters. "Verstappen leads Hamilton by 1.234 seconds" means if Hamilton crossed the timing line 1.234 seconds after Verstappen. But how do you visualize seconds as a *spatial distance* on a 2D circuit?

### Seconds to Track Fraction

The conversion is elegant:

```
visual_offset = gap_seconds / average_lap_time
```

If the average lap time is 90 seconds and the gap is 1.234 seconds, the trailing driver is placed `1.234 / 90 = 0.0137` (1.37%) of the track behind the leader. On our 1,000-point sampled track, that's about 14 sample points — enough to see a clear separation on screen.

### Backend: Cumulative Lap Times

Gaps are computed from cumulative lap completion times, not real-time GPS:

```python
drv_cumulative = sum(driver_lap_times[:current_lap])
leader_cumulative = sum(leader_lap_times[:current_lap])
gap = drv_cumulative - leader_cumulative  # in seconds
```

This is how F1 timing actually works. A driver who had one slow lap 20 laps ago still carries that deficit. The gap evolves as drivers trade pace advantages across the race.

### Gap Evolution Chart

For the gap evolution panel, I pre-compute cumulative race times for each driver across all laps:

```python
for driver in top_drivers:
    running_total = 0.0
    for lap in driver_laps:
        running_total += lap.time.total_seconds()
        cumulative[driver][lap.number] = running_total
    
    # Gap = driver_cumulative - leader_cumulative per lap
```

Plot `gap_to_leader` vs `lap_number` and you get the classic F1 timing chart — converging lines mean a battle is developing, diverging lines mean clean air pace advantage.

---

## Detecting Overtakes with Sub-Lap Precision

If driver A was P3 on lap 15 and P2 on lap 16, an overtake happened *somewhere* during that lap. But where? If the visualization just jumps positions at lap boundaries, it feels robotic. I wanted overtakes to happen at the right *moment* within the lap.

### Gap-Delta Interpolation

The EventEngine uses the change in gap-to-leader to estimate when the overtake occurred:

```typescript
const prevGap = previousGaps.get(driver) ?? 0;
const currGap = currentGap ?? 0;
const gapDelta = Math.abs(prevGap - currGap);

// Large gap change → event happened early in the lap
// Small gap change → event happened late
const estimatedOffset = Math.min(0.9, Math.max(0.1,
  prevGap / (prevGap + Math.abs(currGap) + 0.01)
));

const eventTime = (lap - 1) + estimatedOffset;  // fractional lap precision
```

The intuition: if a driver's gap dropped dramatically, they probably made the pass early (the rest of the lap was accumulating their new position's advantage). If the gap barely changed, the pass likely happened near the end of the lap. The `0.01` epsilon prevents division-by-zero.

This gives sub-lap precision — overtakes don't all snap at lap boundaries, they're distributed realistically across the animation timeline.

---

## Telemetry Graphs: Two Drivers, One X-Axis

The telemetry comparison panel shows speed, throttle, and brake traces for two drivers overlaid on the same chart. The key design decision: **X-axis is distance in meters, not time.**

### Why Distance, Not Time?

If you plot against time, two drivers' traces don't align at track features. Driver A might reach turn 1 at t=12.3s while Driver B reaches it at t=12.6s. By plotting against distance, every point on the X-axis corresponds to the same physical point on the circuit. You can instantly see "Driver A carries 12 km/h more speed through turn 3."

### Downsampling for Performance

Full telemetry is ~15,000 data points per lap. Recharts would choke on 30,000 points (two drivers). The backend downsamples to 500 points:

```python
if len(telemetry) > 500:
    step = max(1, len(telemetry) // 500)
    telemetry = telemetry.iloc[::step]
```

500 points is enough for visual fidelity — you can still see braking zones and apex speeds clearly.

### The Brake Data Hack

FastF1 returns brake data as a boolean (0 or 1), not a pressure value. To make it display nicely on a 0–100% axis alongside throttle:

```python
"brake": [int(b) * 100 for b in telemetry.get("Brake", [])]
```

### Two-Driver Overlay

Both drivers' data is merged into a single array with dynamic keys:

```typescript
// Interleaved data: { distance: 120, VER_speed: 290, HAM_speed: 285 }
```

Recharts renders two `<Area>` components on the same chart, each keyed to `{DRIVER}_speed`. Team colors are used for the stroke and fill gradients — instantly recognizable even without labels.

---

## AI Insights: Rule Engine Meets Claude

The AI insights panel doesn't just throw data at an LLM and hope for the best. It uses a **two-layer system**: deterministic rules fire first, then Claude enhances and contextualizes them.

### Layer 1: Rule-Based Detection

Simple heuristics catch the most common patterns:

- **Tyre degradation**: Average lap time increasing by >0.3s/lap on tyres older than 15 laps
- **Pace drop**: Lap time increases by >1.0s over any 3-lap window
- **Undercut opportunities**: Fresh tyres within 2 positions of a driver on old tyres

These fire instantly — no API call needed.

### Layer 2: Claude Enhancement

The detected patterns are bundled with a compact race snapshot and sent to Claude:

```python
SYSTEM_PROMPT = """You are an expert F1 race engineer and strategist 
embedded in a real-time race intelligence dashboard.

Your role:
- Analyze live race data and provide tactical insights
- Identify strategy opportunities (undercuts, overcuts, pit windows)
- Detect tyre degradation trends and recommend pit stops
- Spot battles developing and predict outcomes

Guidelines:
- Be concise and data-driven — this is a live dashboard, not an article
- Use F1 terminology naturally (DRS, undercut, dirty air, tyre cliff)
- Reference specific drivers, positions, and lap numbers
- Express confidence levels when making predictions"""
```

The race context is deliberately compact — current lap, top 10 positions with lap times, compounds, and tyre ages. Claude runs at 600 max tokens to keep responses dashboard-appropriate.

### Chat Mode

The chat feature appends race context to every user question. Ask "who should pit next?" and Claude sees the full race state alongside your question. Conversation history (last 20 messages) maintains context across follow-ups.

---

## Strategy Simulator: Should You Pit or Stay Out?

The strategy panel answers F1's eternal question with a heuristic model that simulates the remaining race under two scenarios.

### The Model

Each tyre compound has characteristic parameters:

```python
compound_delta = {"SOFT": -1.5, "MEDIUM": -0.8, "HARD": -0.2}   # pace vs current
compound_degradation = {"SOFT": 0.12, "MEDIUM": 0.06, "HARD": 0.03}  # deg per lap
pit_stop_loss = 23.0  # seconds for a typical pit stop
```

For the "pit now" scenario, the simulator adds the pit stop loss, then accumulates lap times on fresh tyres with linear degradation:

```python
new_strategy_time = pit_stop_loss
for lap_on_tyre in range(1, remaining_laps + 1):
    lap_time = new_pace_base + (deg_rate * lap_on_tyre)
    new_strategy_time += lap_time
```

For "stay out," degradation accelerates on old tyres (the 0.05 factor models the non-linear "tyre cliff"):

```python
for lap_extra in range(1, remaining_laps + 1):
    lap_time = old_pace + (old_deg_rate * (current_tyre_life + lap_extra) * 0.05)
    old_strategy_time += lap_time
```

### Position Change Heuristic

Exiting the pits costs ~2 positions (the pit stop loss means you rejoin behind nearby cars). Each 3-second advantage gained translates to approximately 1 position recovery. The recommendation uses a ±2 second threshold:

- **Delta < -2s**: PIT — the fresh tyres make up for the stop
- **Delta > +2s**: STAY OUT — not enough laps to recover
- **In between**: MARGINAL — depends on track position

It's a simplification (real F1 strategy models use far more variables), but it captures the fundamental trade-off and gives the user meaningful insight.

---

## Real-Time Architecture: WebSockets All the Way Down

### The Pipeline

```
RaceSimulator (Python)
    │ elapsed_time / speed = current_lap
    ▼
start_live_broadcast() — background async loop
    │ on lap change → fetch all data
    ▼
ConnectionManager.broadcast() → JSON to all WebSocket clients
    ▼
useRaceWebSocket.onmessage → Zustand store dispatch
    ▼
Components (ref-based animation + throttled state)
```

### Backend: Dead-Simple Simulation

The race simulator doesn't model physics — it's just a clock:

```python
current_lap = int(elapsed_time / speed) + 1
```

The broadcast loop checks for lap changes. Only on a new lap does it fetch the full payload (leaderboard, positions, insights, race control messages). Between laps, it sends a lightweight state update with just the current progress.

### Frontend: Zustand, Not Redux

State management uses Zustand — a flat store with ~30 fields and action methods. No middleware, no persistence middleware, no normalized entities. For real-time data that's completely replaced every second, the overhead of Redux's immutable update patterns and selector memoization is pure waste.

### Reconnection

The WebSocket client uses exponential backoff: 2 seconds after the first disconnect, doubling to a maximum of 30 seconds. No jitter — the client count is small enough that a thundering herd isn't a concern.

### WSS Auto-Detection

When deployed to HTTPS, the browser blocks `ws://` connections (mixed content). The frontend auto-detects the protocol:

```typescript
function getWsUrl(): string {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
  if (wsUrl) return wsUrl;
  
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl && typeof window !== "undefined" 
      && window.location.protocol === "https:") {
    return apiUrl.replace(/^https?:\/\//, "wss://") + "/ws/race";
  }
  
  return "ws://localhost:8000/ws/race";
}
```

One function, three fallback levels: explicit WebSocket URL → derive from API URL → localhost default.

---

## Timeline Replay with a 10,000-Frame Ring Buffer

The replay system allows scrubbing through any point in the race with smooth playback at variable speeds.

### Continuous Race Progress

The timeline is modeled as a continuous float — `raceProgress = 10.456` means "lap 11, 45.6% through." The tick function:

```typescript
const BASE_LAP_SECONDS = 12;  // wall-clock seconds per lap at 1x
const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 5, 10];

tick(deltaMs) {
  const deltaSec = deltaMs / 1000;
  const increment = (deltaSec * speed) / BASE_LAP_SECONDS;
  raceProgress += increment;
}
```

At 1x speed, each lap takes 12 real seconds. At 10x, it takes 1.2 seconds. The `raceProgress` drives everything — car positions, leaderboard state, event overlays.

### The Ring Buffer

Every 500ms, a snapshot of the entire race state is recorded into a ring buffer:

```typescript
const MAX_FRAMES = 10000;
const _frames: (ReplayFrame | null)[] = new Array(MAX_FRAMES).fill(null);
let _writeIdx = 0;

function pushFrame(frame: ReplayFrame) {
  _frames[_writeIdx % MAX_FRAMES] = frame;
  _writeIdx++;
}
```

10,000 frames × 500ms = ~83 minutes of recording — enough for even the longest F1 race. Each frame stores:
- `raceProgress` timestamp
- Map of driver → `{x, y, progress}` positions
- Full leaderboard state

### Seeking

When the user scrubs the timeline, the nearest frame is found by scanning backward from the write head:

```typescript
function getFrameAt(targetProgress: number): ReplayFrame | null {
  // Scan backward for best locality — most seeks are near "now"
  for (let i = _writeIdx - 1; i >= Math.max(0, _writeIdx - _count); i--) {
    const frame = _frames[i % MAX_FRAMES];
    if (frame && Math.abs(frame.raceProgress - targetProgress) < 0.01) {
      return frame;
    }
  }
  return null;
}
```

Scanning backward provides good locality for the common case (seeking near the current time). For a more distant seek, it degrades gracefully — 10,000 iterations is still trivial.

### Synchronized Playback

Play/pause synchronizes both the frontend animation and the backend simulation:

```typescript
const handlePlay = async () => {
  play();                                     // start requestAnimationFrame loop
  await api.startLive(toBackendSpeed(speed)); // start backend race clock
};
```

The backend starts pushing new data via WebSocket, while the frontend independently advances its animation timeline. They stay in sync because both use the same speed multiplier.

---

## ElevenLabs Voice: Making the Dashboard Talk

The most viscerally satisfying feature: the dashboard literally *speaks* race insights in a broadcast-quality voice.

### Voice Configuration

```python
payload = {
    "text": text,
    "model_id": "eleven_multilingual_v2",
    "voice_settings": {
        "stability": 0.15,        # Very low → dramatic variation
        "similarity_boost": 0.9,  # High → consistent character
        "style": 0.85,            # High → expressive delivery
        "use_speaker_boost": True,
    },
}
```

The trick is the extreme combination: **very low stability** (0.15) gives dramatic, broadcast-like vocal variation — each utterance sounds slightly different, like a real commentator reacting in the moment. **High similarity boost** (0.9) keeps it sounding like the same person. The voice used is "Sarah" — chosen for clarity and natural F1 commentary cadence.

### Queue-Based Playback

The frontend maintains a 3-item maximum queue to prevent backlog during rapid insights:

```typescript
const MAX_QUEUE = 3;  // prevent voice backlog during rapid events
```

Auto-commentary speaks the top insight every 30 seconds. Special flag changes (safety car, red flag) trigger immediate announcements with pre-written text:

```typescript
const flagAnnouncements = {
  sc: "Safety car has been deployed.",
  red: "Red flag. The session has been suspended.",
  vsc: "Virtual safety car period is active.",
};
```

### The Emoji Problem

AI-generated insights sometimes contain emoji. ElevenLabs either skips them (creating unnatural pauses) or tries to vocalize them (even worse). The fix:

```typescript
text.replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
```

Strip the entire Unicode supplementary plane before sending to TTS. Simple, effective.

---

## The Grid Layout — A Drag-and-Drop War Room

The dashboard uses `react-grid-layout` to create a customizable, drag-and-drop panel system. Users can resize, rearrange, and toggle 12 different panels.

### Configuration

```typescript
const COLS = { lg: 24, md: 18, sm: 12, xs: 6, xxs: 4 };
const ROW_HEIGHT = 30;
```

A 24-column grid at 30px row height gives fine-grained control. Two preset layouts are available:

- **Broadcast mode**: Large circuit center (14×18), leaderboard left (5×12), telemetry right (5×8)
- **Analysis mode**: Smaller circuit (8×14), expanded telemetry (11×10), more room for strategy panels

### Panel Inventory

Twelve panels, each wrapped in a `<PanelWrapper>` with drag handles and an `<ErrorBoundary>`:

1. Track Map (SVG canvas + animated cars)
2. Leaderboard (real-time positions, gaps, tyres)
3. Race Control (flags, messages, penalties)
4. Telemetry (speed/throttle/brake comparison)
5. Strategy Simulator (pit/stay out model)
6. AI Insights (Claude-powered analysis)
7. Gap Evolution (convergence/divergence chart)
8. Stint History (tyre strategy visualization)
9. Team Radio (intercepted messages)
10. GP Info (circuit details, weather)
11. Video Highlights (Dailymotion/YouTube)
12. Replay Controls (timeline scrubbing)

### Persistence

Layout state is saved to localStorage (`f1-world-monitor-layout-v3`) so your customized arrangement survives page reloads. Panel visibility is managed by a separate Zustand store, enabling a Settings modal where users can toggle individual panels on/off.

---

## Deployment: Railway, Vercel, and the YouTube Copyright Wall

Deployment was deceptively complex. What should have been "push and deploy" turned into a multi-day adventure.

### The Railway Dockerfile Saga

Railway uses a Dockerfile builder in a monorepo. Three separate failures, three separate fixes:

**Fix 1: Path Resolution.** `dockerfilePath = "Dockerfile"` in `railway.toml` resolves from the *repository root*, not the config file's directory. Changed to `apps/api/Dockerfile`.

**Fix 2: Build Context.** Railway's build context is the repository root. So `COPY requirements.txt .` fails because there's no `requirements.txt` at the root. Changed to:

```dockerfile
COPY apps/api/requirements.txt .
COPY apps/api/ .
```

**Fix 3: The $PORT Mystery.** Railway's `startCommand` in `railway.toml` doesn't run through a shell — `$PORT` is treated as a literal string, not an environment variable. The fix: remove `startCommand` entirely and let the Dockerfile's CMD handle it (CMD in shell form invokes `/bin/sh -c`, which *does* expand variables):

```dockerfile
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
```

### The CORS Battle

After deploying, the Vercel frontend couldn't call the Railway backend — CORS blocked. Added the production URL:

```python
allow_origins=[
    settings.FRONTEND_URL,
    "http://localhost:3000",
    "https://raceosf1-web.vercel.app",
]
```

### The YouTube Copyright Wall

This was the most frustrating challenge. YouTube highlights worked perfectly in local development. In production? "Video unavailable."

**Attempt 1**: Switched from proxy streaming to YouTube iframe embeds. Result: "Video unavailable." Formula One Management (FOM) uses YouTube's Content ID system to block **all** F1 race footage from being embedded on third-party domains.

**Attempt 2**: Added the YouTube Data API v3 with `videoEmbeddable=true` filter. Result: Still blocked. The Content ID block is applied at the domain level *after* the embed loads — the API says it's embeddable, but FOM's restrictions override at playback time.

**Attempt 3**: Explored scraping. Declined — it's both unethical and fragile.

**The Solution: A 3-Tier Approach**

1. **Dailymotion embeds** — FOM doesn't police Dailymotion as aggressively. Race highlight compilations are widely available and actually embedable.
2. **YouTube non-blocked content** — Onboard cameras, tech analysis, and review videos from channels FOM doesn't target.
3. **YouTube thumbnail cards** — For actual race highlights, show a thumbnail with a play button that opens YouTube in a new tab.

The final UI fills the entire panel block with the video player. A hover overlay slides up from the bottom showing alternative videos — Dailymotion items switch the embedded player, YouTube items open externally.

---

## Architecture Overview

```
┌──────────────────────────┐       ┌─────────────────────────────┐
│       Vercel (Free)       │       │     Railway (~$5/mo)        │
│                           │       │                             │
│  Next.js 14 + TypeScript  │◄─────►│   FastAPI + Python 3.12     │
│  Zustand State            │ REST  │   FastF1 Data Extraction    │
│  GSAP Animations          │  +    │   Anthropic Claude API      │
│  Recharts Graphs          │  WS   │   ElevenLabs TTS API        │
│  react-grid-layout        │       │   YouTube/Dailymotion APIs  │
│  ElevenLabs Client        │       │   Race Simulation Engine    │
└──────────────────────────┘       └─────────────────────────────┘
         │                                      │
         │ CDN (static assets)                  │ FastF1 Cache (Docker volume)
         ▼                                      ▼
   Global Edge Network                  Cached F1 Telemetry Data
```

**API Surface**: 56 FastAPI endpoints with Swagger documentation, covering everything from race classification to lap-by-lap telemetry to AI insights generation.

**Background Sync**: Every 5 minutes, the server checks for new race data and pre-caches it, so most API calls are served from cache.

---

## Credits & Acknowledgements

This project stands on the shoulders of some incredible open-source projects and APIs. A huge shoutout to the communities behind them.

### The F1 Data Layer

- **[FastF1](https://github.com/theOehrly/Fast-F1)** — The backbone of the entire backend. Theehrly's FastF1 library provides access to F1 timing data, telemetry, and session results with a clean Pandas-based API. Without it, extracting lap times, position data, tyre compounds, and car telemetry (speed, throttle, brake at 300Hz!) would have required months of reverse-engineering. The track map rendering, gap calculations, strategy simulator, and telemetry charts all start with a FastF1 `session.load()` call. Genuinely one of the best sports data libraries in any ecosystem.

- **[OpenF1](https://openf1.org)** — A free, open-source, community-maintained API for real-time and historical F1 data. No API key required. I use it for session listings, driver info, and as the primary data source for the background sync service. The fact that this exists for free is a gift to the F1 developer community.

- **[F1 Live Motorsport Data (RapidAPI)](https://rapidapi.com/api-sports/api/f1-live-motorsport-data)** — Supplements OpenF1 with real-time timing, positions, race control messages, pit stops, and team radio during live sessions. The live mode of the dashboard depends on this for sub-second data freshness.

### The Frontend Stack

- **[Zustand](https://github.com/pmndrs/zustand)** — Flat, minimal, zero-boilerplate state management that just gets out of the way. Perfect for real-time data where you're replacing state 60 times per second.

- **[GSAP](https://gsap.com/)** — Powers the cinematic lab entry animation, stroke-dashoffset track drawing, and various UI transitions. The `@gsap/react` integration is seamless.

- **[Recharts](https://recharts.org/)** — The telemetry comparison charts (speed, throttle, brake), gap evolution, and stint visualizations are all Recharts. Handles 500+ data points per chart without breaking a sweat.

- **[react-grid-layout](https://github.com/react-grid-layout/react-grid-layout)** — Makes the entire dashboard drag-and-drop customizable. The responsive breakpoint system and layout persistence were critical for the "war room" feel.

- **[react-joyride](https://github.com/gilbarbara/react-joyride)** — The 17-step guided onboarding tour that walks new users through every panel. V3's improved positioning and styling made it a drop-in solution.

### The AI & Voice Layer

- **[Anthropic Claude](https://www.anthropic.com/)** — Claude Sonnet powers the AI insights engine and interactive chat. The race engineer persona, with its concise, data-driven style, was shaped by prompt engineering against Claude's strengths.

- **[ElevenLabs](https://elevenlabs.io/)** — The multilingual v2 model with aggressive style settings gives the voice commentary its broadcast quality. The "Sarah" voice with 0.15 stability is *chef's kiss*.

### The Backend & Infrastructure

- **[FastAPI](https://fastapi.tiangolo.com/)** — 56 endpoints with auto-generated Swagger docs, WebSocket support, and async everything. The best Python web framework for this kind of data-heavy, real-time application.

- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** — Used as a fallback video search engine when the YouTube Data API quota runs dry. The flat-search mode extracts video metadata without downloading anything.

- **[Dailymotion API](https://developer.dailymotion.com/)** — Free, no API key, and FOM doesn't police it. The unsung hero of the video highlights panel.

Special thanks to the broader F1 open-data community — the people documenting telemetry formats, maintaining free APIs, and building tools that make F1 data accessible to developers. This project exists because of you.

---

## Lessons Learned

### 1. The Browser's SVG Engine is Free Compute
Using `getPointAtLength()` for curve sampling saved me from implementing Bézier math. The browser already has world-class geometry code — mount an invisible element, query it, remove it. Unorthodox but effective.

### 2. Refs Beat State for Animation
React's reconciliation cycle has no business in a 60fps animation loop. Direct DOM manipulation via `useRef` + `setAttribute` is the right tool when you need guaranteed frame timing.

### 3. Spring Physics Over Tweens
GSAP and CSS transitions interpolate between two endpoints. Spring-damper systems generate motion that *feels* physical — the camera decelerates, overshoots, settles. The math is just as simple (multiply by spring constant, multiply by damping), but the result is dramatically more natural.

### 4. Copyright Defines Architecture
I spent more time fighting YouTube's Content ID system than building the video panel. The technical solution (Dailymotion + thumbnail cards) only emerged after three failed approaches. Sometimes the hardest engineering problem isn't engineering at all — it's understanding the legal landscape.

### 5. Environment Variables Don't Expand Themselves
Railway's `startCommand` doesn't use a shell. Docker's exec-form CMD doesn't use a shell. The implicit assumption that `$PORT` will be expanded is so natural that you don't even think to question it — until a container crash log says `"$PORT" is not a valid integer`.

### 6. Flat State for Real-Time
Zustand with no middleware outperformed every other state management option for this use case. When your data is completely replaced every second, normalization and memoization are overhead, not optimization.

---

## What's Next

The roadmap includes:
- **Live session support** — connecting to real-time F1 timing feeds during actual race weekends
- **Multi-user rooms** — shared viewing sessions with synchronized playback
- **Predictive models** — machine learning for tyre degradation prediction and race outcome probability
- **Mobile layout** — responsive grid presets for tablet viewing

---

*If you're interested in the code, the full project is on GitHub. Built with Next.js, FastAPI, FastF1, Claude, and ElevenLabs.*

*Got questions or suggestions? I'd love to hear them.*
