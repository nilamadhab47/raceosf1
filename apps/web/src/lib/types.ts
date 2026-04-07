// ─── API Response Types ─────────────────────────────────────────────

export interface SessionInfo {
  year: number;
  name: string;
  circuit: string;
  country: string;
  session_type: string;
  date: string;
  total_laps: number;
}

export interface Driver {
  number: string;
  abbreviation: string;
  full_name: string;
  team: string;
  team_color: string;
  position: number;
  grid_position: number;
  status: string;
  points: number;
}

export interface LapData {
  driver: string;
  lap_number: number;
  lap_time: number | null;
  sector1: number | null;
  sector2: number | null;
  sector3: number | null;
  compound: string | null;
  tyre_life: number | null;
  stint: number | null;
  is_pit_out_lap: boolean;
  is_pit_in_lap: boolean;
  speed_fl: number | null;
  speed_st: number | null;
}

export interface TelemetryData {
  driver: string;
  lap_number: number;
  distance: number[];
  speed: number[];
  throttle: number[];
  brake: number[];
  rpm: number[];
  gear: number[];
  drs: number[];
}

export interface LeaderboardEntry {
  driver: string;
  full_name: string;
  team: string;
  team_color: string;
  position: number;
  current_lap: number;
  last_lap_time: number | null;
  compound: string | null;
  tyre_life: number | null;
  stint: number | null;
  gap_to_leader: number | null;
}

export interface Insight {
  type: string;
  severity: "info" | "warning" | "alert";
  driver: string;
  message: string;
  confidence: number;
  lap: number;
}

export interface StrategyResult {
  driver: string;
  pit_lap: number;
  new_compound: string;
  total_laps: number;
  remaining_laps: number;
  pit_stop_loss: number;
  old_pace_avg: number;
  new_pace_base: number;
  time_delta_vs_no_stop: number;
  projected_position: number;
  current_position: number;
  recommendation: "PIT" | "STAY OUT" | "MARGINAL";
  explanation: string;
}

export interface LiveState {
  current_lap: number;
  total_laps: number;
  is_running: boolean;
  speed: number;
  year: number;
  gp: string;
  progress: number;
}

export interface AvailableSession {
  year: number;
  gp: string;
  name: string;
}

export interface WeatherData {
  time: string;
  air_temp: number | null;
  track_temp: number | null;
  humidity: number | null;
  pressure: number | null;
  rainfall: boolean;
  wind_speed: number | null;
  wind_direction: number | null;
}

export interface TrackMapData {
  x: number[];
  y: number[];
  corners: { number: number; x: number; y: number; letter: string }[];
  x_min?: number;
  x_max?: number;
  y_min?: number;
  y_max?: number;
}

export interface DriverPosition {
  driver: string;
  full_name: string;
  team: string;
  team_color: string;
  x: number;
  y: number;
  position: number;
  lap_time: number | null;
}

export interface RateLimitStatus {
  used: number;
  remaining: number;
  limit: number;
  window_seconds: number;
}

export interface ModeInfo {
  mode: "simulation" | "live";
  live_available: boolean;
}

export type FlagMode = "green" | "yellow" | "sc" | "vsc" | "red" | "chequered";

export interface RaceControlEvent {
  time: string;
  lap: number;
  category: "Flag" | "SafetyCar" | "Drs" | "Other";
  flag?: string;
  message: string;
}

export interface StintInfo {
  compound: string;
  stint: number;
  start_lap: number;
  end_lap: number;
  laps: number;
}

export interface DriverStints {
  driver: string;
  full_name: string;
  team_color: string;
  position: number;
  total_laps: number;
  stints: StintInfo[];
}

export interface GapEvolutionDriver {
  driver: string;
  full_name: string;
  team_color: string;
  gaps: (number | null)[];
}

export interface GapEvolutionData {
  laps: number[];
  drivers: GapEvolutionDriver[];
}
