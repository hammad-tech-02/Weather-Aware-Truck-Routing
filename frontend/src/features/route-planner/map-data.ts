/**
 * Builders that turn a plan into GeoJSON for the map. They are pure and are
 * memoised by the map component so sources are only updated via `setData`
 * when the plan or the selected route actually changes.
 */
import type { FeatureCollection, LineString, Point } from "geojson";

import { HOUR_MS, floorToHour } from "@/lib/datetime";
import { cumulativeMiles, splitLineAt } from "@/lib/geo";

import type { PlanResponse, RouteOption } from "./types";

export interface RouteLineProperties {
  id: string;
  label: string;
  recommended: boolean;
}

export function buildRoutesCollection(plan: PlanResponse | undefined): FeatureCollection<LineString, RouteLineProperties> {
  return {
    type: "FeatureCollection",
    features: (plan?.routes ?? []).map((route) => ({
      type: "Feature",
      geometry: { type: "LineString", coordinates: route.geometry },
      properties: {
        id: route.id,
        label: route.recommended ? `${route.name} - Recommended` : route.name,
        recommended: route.recommended,
      },
    })),
  };
}

export interface RiskSegmentProperties {
  /** risk level, -1 when unknown */
  level: number;
}

/**
 * Colors the selected route by checkpoint risk. Each checkpoint owns the
 * stretch from half-way to its previous neighbour to half-way to its next, and
 * consecutive checkpoints with the same level are merged into one line.
 */
export function buildRiskSegments(route: RouteOption | undefined): FeatureCollection<LineString, RiskSegmentProperties> {
  const empty: FeatureCollection<LineString, RiskSegmentProperties> = { type: "FeatureCollection", features: [] };
  if (!route || route.geometry.length < 2 || route.checkpoints.length === 0) return empty;

  const line = route.geometry;
  const cumulative = cumulativeMiles(line);
  const lineMiles = cumulative[cumulative.length - 1] ?? 0;
  if (lineMiles <= 0) return empty;

  // checkpoint miles follow the backend's distance; rescale them onto the drawn line
  const scale = route.distance_mi > 0 ? lineMiles / route.distance_mi : 1;
  const checkpoints = [...route.checkpoints].sort((a, b) => a.mile - b.mile);
  const levels = checkpoints.map((cp) => cp.level ?? -1);

  // break where the level changes, at the midpoint between the two checkpoints
  const breaks: number[] = [];
  const pieceLevels: number[] = [levels[0]!];
  for (let i = 1; i < checkpoints.length; i++) {
    if (levels[i] === levels[i - 1]) continue;
    const midpoint = ((checkpoints[i - 1]!.mile + checkpoints[i]!.mile) / 2) * scale;
    breaks.push(Math.min(Math.max(midpoint, 0), lineMiles));
    pieceLevels.push(levels[i]!);
  }

  const pieces = splitLineAt(line, cumulative, breaks);
  return {
    type: "FeatureCollection",
    features: pieces
      .map((coordinates, i) => ({
        type: "Feature" as const,
        geometry: { type: "LineString" as const, coordinates },
        properties: { level: pieceLevels[i] ?? -1 },
      }))
      .filter((feature) => feature.geometry.coordinates.length >= 2),
  };
}

export interface CheckpointPointProperties {
  index: number;
  level: number;
  /** hours since the forecast start hour, used to emphasise checkpoints near the slider time */
  h: number;
}

export function buildCheckpointsCollection(
  route: RouteOption | undefined,
  departureTime: string | undefined,
): FeatureCollection<Point, CheckpointPointProperties> {
  const start = departureTime ? floorToHour(Date.parse(departureTime)) : 0;
  return {
    type: "FeatureCollection",
    features: (route?.checkpoints ?? []).map((cp) => ({
      type: "Feature",
      id: cp.index,
      geometry: { type: "Point", coordinates: [cp.lon, cp.lat] },
      properties: {
        index: cp.index,
        level: cp.level ?? -1,
        h: (Date.parse(cp.eta) - start) / HOUR_MS,
      },
    })),
  };
}

export interface StopPointProperties {
  /** position in `route.stops` */
  i: number;
  type: string;
  label: string;
}

export function buildStopsCollection(route: RouteOption | undefined): FeatureCollection<Point, StopPointProperties> {
  return {
    type: "FeatureCollection",
    features: (route?.stops ?? []).map((stop, i) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [stop.lon, stop.lat] },
      properties: { i, type: stop.type, label: stop.type === "rest" ? "R" : "B" },
    })),
  };
}
