import type { Step } from "react-joyride";

export const TOUR_STEPS: Step[] = [
  {
    target: '[data-tour="track"]',
    title: "Live Track Map",
    content:
      "Watch the cars move around the circuit in real time — your bird's eye view of the entire race!",
    placement: "right",
    skipBeacon: true,
  },
  {
    target: '[data-tour="leaderboard"]',
    title: "Leaderboard",
    content:
      "See who's winning! Live positions, time gaps, and what tyres each driver is using.",
    placement: "right",
    skipBeacon: true,
  },
  {
    target: '[data-tour="race-control"]',
    title: "Race Updates",
    content:
      "Live race flags, penalties, and messages from race control — stay on top of every incident.",
    placement: "left",
    skipBeacon: true,
  },
  {
    target: '[data-tour="telemetry"]',
    title: "Telemetry",
    content:
      "Compare how fast drivers go through each corner. Find out who brakes later and who's got more speed!",
    placement: "left",
    skipBeacon: true,
  },
  {
    target: '[data-tour="insights"]',
    title: "AI Race Engineer",
    content:
      "Your AI brain — it watches the race and tells you smart things, like who might overtake next.",
    placement: "left",
    skipBeacon: true,
  },
  {
    target: '[data-tour="strategy"]',
    title: "Strategy Lab",
    content:
      "Plan pit stops and tyre changes. Test different strategies to find the winning move!",
    placement: "left",
    skipBeacon: true,
  },
  {
    target: '[data-tour="gap-evo"]',
    title: "Gap Evolution",
    content:
      "Track how the gap between drivers changes lap by lap — see battles developing in real time.",
    placement: "left",
    skipBeacon: true,
  },
  {
    target: '[data-tour="stints"]',
    title: "Tyre Stints",
    content:
      "See every driver's tyre history — which compounds they used and how long each stint lasted.",
    placement: "top",
    skipBeacon: true,
  },
  {
    target: '[data-tour="team-radio"]',
    title: "Team Radio",
    content:
      "Listen in on team radio messages — hear what drivers and engineers are saying during the race!",
    placement: "left",
    skipBeacon: true,
  },
  {
    target: '[data-tour="gp-info"]',
    title: "GP Info",
    content:
      "Circuit details, weather conditions, and session info — everything you need about the current Grand Prix.",
    placement: "left",
    skipBeacon: true,
  },
  {
    target: '[data-tour="youtube"]',
    title: "Highlights",
    content:
      "Watch the best moments from the race — overtakes, crashes, and celebrations!",
    placement: "left",
    skipBeacon: true,
  },
  {
    target: '[data-tour="replay"]',
    title: "Events & Replay",
    content:
      "Jump to key moments in the race — pit stops, overtakes, and safety cars. Replay any event instantly.",
    placement: "top",
    skipBeacon: true,
  },
  {
    target: '[data-tour="simulate"]',
    title: "Start the Race!",
    content:
      "Hit this button to begin the race simulation. Cars will start moving and data flows live!",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: '[data-tour="voice-widget"]',
    title: "Voice Assistant",
    content:
      "Tap here for AI commentary — like having your own race commentator!",
    placement: "top",
    skipBeacon: true,
  },
  {
    target: '[data-tour="settings"]',
    title: "Settings — Toggle Panels",
    content:
      "Click the gear icon to open Settings. You can enable or disable any panel to customise your dashboard layout.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: ".react-grid-layout",
    title: "Drag & Rearrange",
    content:
      "Every panel is draggable! Grab any panel header and move it wherever you like to build your perfect layout.",
    placement: "auto",
    skipBeacon: true,
  },
];
