/** Types mirroring docs/api.md. Field names stay snake_case to match the wire format. */

/** 0 Low, 1 Moderate, 2 High, 3 Severe, 4 No Travel. */
export type RiskLevel = 0 | 1 | 2 | 3 | 4;

export interface Place {
  label: string;
  lat: number;
  lon: number;
}

export interface GeocodeResponse {
  results: Place[];
}

export type CheckpointInterval = 10 | 25 | 50;

export interface PlanRequest {
  origin: Place;
  destination: Place;
  departure_time: string;
  load_lbs: number;
  checkpoint_interval_mi: CheckpointInterval;
}

export interface Weather {
  wind_mph: number;
  gust_mph: number;
  rain_in_hr: number;
  snow_in_hr: number;
  temperature_f: number;
}

export interface Checkpoint {
  index: number;
  mile: number;
  lat: number;
  lon: number;
  eta: string;
  weather: Weather | null;
  level: RiskLevel | null;
  wind_level: RiskLevel | null;
  rain_level: RiskLevel | null;
  snow_level: RiskLevel | null;
  reasons: string[];
}

export type StopType = "break" | "rest";

export interface HosStop {
  type: StopType;
  mile: number;
  lat: number;
  lon: number;
  start: string;
  end: string;
}

export interface MilesByLevel {
  low: number;
  moderate: number;
  high: number;
  severe: number;
  no_travel: number;
}

export interface RouteSummary {
  miles_by_level: MilesByLevel;
  avg_risk: number | null;
  max_level: RiskLevel | null;
}

/** `[lon, lat]`, GeoJSON order. */
export type LonLat = [number, number];

/** `[lat, lon]`, as used by the corridor grid. */
export type LatLon = [number, number];

export interface RouteOption {
  id: string;
  name: string;
  via: string;
  distance_mi: number;
  driving_hours: number;
  trip_hours: number;
  arrival_time: string;
  geometry: LonLat[];
  rank: number;
  recommended: boolean;
  travelable: boolean;
  summary: RouteSummary;
  stops: HosStop[];
  checkpoints: Checkpoint[];
}

export interface Corridor {
  bbox: [number, number, number, number];
  points: LatLon[];
}

export interface PlanResponse {
  departure_time: string;
  load_lbs: number;
  checkpoint_interval_mi: CheckpointInterval;
  recommended_route_id: string;
  recommendation_reason: string;
  routes: RouteOption[];
  corridor: Corridor;
}

export interface HeatmapRequest {
  points: LatLon[];
  start_time: string;
  load_lbs: number;
}

export interface HeatmapPoint {
  lat: number;
  lon: number;
  risk: (number | null)[];
  wind: (number | null)[];
  precip: (number | null)[];
  snow: (number | null)[];
}

export interface HeatmapResponse {
  start_time: string;
  hours: number;
  points: HeatmapPoint[];
}
