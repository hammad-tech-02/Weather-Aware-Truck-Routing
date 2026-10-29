/**
 * Heatmap metrics and the MapLibre expressions that drive the 0-48 h slider.
 *
 * Every grid point is uploaded once with flattened per-hour properties
 * (`r0..r48`, `w0..w48`, `p0..p48`, `s0..s48`). Moving the slider only swaps
 * the property name inside `heatmap-weight`, so no data is re-uploaded to the
 * GPU and scrubbing stays smooth.
 */
import type { FeatureCollection, Point } from "geojson";
import type { ExpressionSpecification } from "maplibre-gl";

import { RISK_LEVELS } from "@/lib/risk-levels";

import type { HeatmapResponse } from "./types";

export type HeatmapMetric = "risk" | "wind" | "precip" | "snow";

export interface HeatmapMetricConfig {
  id: HeatmapMetric;
  label: string;
  /** property prefix on grid features, followed by the hour index */
  prefix: string;
  /** value that maps to full weight; anything above is clamped */
  max: number;
  /**
   * minimum weight for points that have data, so calm/low areas still read as
   * a faint band instead of disappearing
   */
  floor: number;
  /** density stops for `heatmap-color`, density 0 is always transparent */
  ramp: [number, string][];
  legend: [string, string];
}

const riskRampStop = (level: number) => 0.1 + (0.9 * level) / 4;

/*
 * Ramps start transparent and run through colours that stay readable on the
 * dark, light and satellite basemaps (no near-white or near-black stops).
 */
export const HEATMAP_METRICS: readonly HeatmapMetricConfig[] = [
  {
    id: "risk",
    label: "Risk",
    prefix: "r",
    max: 4,
    floor: 0.1,
    // low risk is a light teal wash so the hazardous stretches stand out; higher
    // stops are aligned with the weight mapping so level N lands on its own colour
    ramp: [
      [0.04, "rgba(43, 179, 173, 0.14)"],
      [riskRampStop(0), "rgba(43, 179, 173, 0.45)"],
      ...RISK_LEVELS.slice(1).map((info) => [riskRampStop(info.level), info.color] as [number, string]),
    ],
    legend: ["Low", "No Travel"],
  },
  {
    id: "wind",
    label: "Wind",
    prefix: "w",
    max: 55,
    floor: 0.05,
    ramp: [
      [0.04, "rgba(94, 234, 212, 0.15)"],
      [0.3, "#5eead4"],
      [0.55, "#38bdf8"],
      [0.8, "#818cf8"],
      [1, "#e879f9"],
    ],
    legend: ["0 mph", "55+ mph"],
  },
  {
    id: "precip",
    label: "Rain",
    prefix: "p",
    max: 1,
    floor: 0.04,
    ramp: [
      [0.03, "rgba(103, 232, 249, 0.15)"],
      [0.2, "#67e8f9"],
      [0.45, "#22d3ee"],
      [0.7, "#3b82f6"],
      [1, "#6366f1"],
    ],
    legend: ["0 in/hr", "1.0+ in/hr"],
  },
  {
    id: "snow",
    label: "Snow",
    prefix: "s",
    max: 3,
    floor: 0.04,
    ramp: [
      [0.03, "rgba(196, 181, 253, 0.18)"],
      [0.2, "#c4b5fd"],
      [0.45, "#a78bfa"],
      [0.7, "#8b5cf6"],
      [1, "#d946ef"],
    ],
    legend: ["0 in/hr", "3.0+ in/hr"],
  },
];

export function getMetricConfig(metric: HeatmapMetric): HeatmapMetricConfig {
  return HEATMAP_METRICS.find((m) => m.id === metric) ?? HEATMAP_METRICS[0]!;
}

/** Weight for one metric at one hour: `floor + (1 - floor) * clamp(value / max)`, 0 when missing. */
export function heatmapWeightExpression(metric: HeatmapMetric, hour: number): ExpressionSpecification {
  const { prefix, max, floor } = getMetricConfig(metric);
  const key = `${prefix}${hour}`;
  return [
    "case",
    ["has", key],
    ["+", floor, ["*", 1 - floor, ["min", 1, ["max", 0, ["/", ["get", key], max]]]]],
    0,
  ];
}

export function heatmapColorExpression(metric: HeatmapMetric): ExpressionSpecification {
  const { ramp } = getMetricConfig(metric);
  return [
    "interpolate",
    ["linear"],
    ["heatmap-density"],
    0,
    "rgba(0, 0, 0, 0)",
    ...ramp.flat(),
  ] as ExpressionSpecification;
}

/** CSS gradient matching the heatmap color ramp, for the legend. */
export function heatmapLegendGradient(metric: HeatmapMetric): string {
  const { ramp } = getMetricConfig(metric);
  const stops = ramp.map(([at, color]) => `${color} ${Math.round(at * 100)}%`);
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

/*
 * Kernel maths: MapLibre's heatmap kernel is a gaussian with sigma = radius / 3
 * and peak 1/sqrt(2*pi). Summed over a regular grid of spacing s, the density
 * of a uniform field is about 0.2785 * (radius / s)^2 * weight. With radius = 2s
 * that is ~1.11, so an intensity of 0.9 makes density ~= weight and the color
 * ramp reads as the value itself rather than as point density.
 */
const RADIUS_TO_SPACING = 2;
export const HEATMAP_INTENSITY = 0.9;

/** World size in px at zoom 0 for MapLibre's 512 px tiles. */
const WORLD_PX = 512;

/**
 * Median nearest-neighbour spacing of the grid in zoom-0 mercator pixels.
 * Sampled so it stays cheap for corridors with thousands of points.
 */
export function estimateGridSpacingPx(points: { lat: number; lon: number }[]): number {
  if (points.length < 2) return 0.15;
  const project = (p: { lat: number; lon: number }) => {
    const lat = (p.lat * Math.PI) / 180;
    return [
      ((p.lon + 180) / 360) * WORLD_PX,
      ((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * WORLD_PX,
    ] as const;
  };
  const projected = points.map(project);
  const step = Math.max(1, Math.floor(projected.length / 200));
  const nearest: number[] = [];

  for (let i = 0; i < projected.length; i += step) {
    const [ax, ay] = projected[i]!;
    let best = Infinity;
    for (let j = 0; j < projected.length; j++) {
      if (j === i) continue;
      const [bx, by] = projected[j]!;
      const d = (ax - bx) ** 2 + (ay - by) ** 2;
      if (d > 0 && d < best) best = d;
    }
    if (Number.isFinite(best)) nearest.push(Math.sqrt(best));
  }

  nearest.sort((a, b) => a - b);
  return nearest[Math.floor(nearest.length / 2)] ?? 0.15;
}

/**
 * Radius that grows 2x per zoom level, i.e. stays a constant ground distance,
 * so the corridor reads as one continuous band at every zoom. Capped past z12
 * to keep the GPU fill cost bounded when zoomed in tightly.
 */
export function heatmapRadiusExpression(spacingPx: number): ExpressionSpecification {
  const base = spacingPx * RADIUS_TO_SPACING;
  return ["interpolate", ["exponential", 2], ["zoom"], 0, base, 12, base * 2 ** 12];
}

export interface HeatmapFeatureProperties {
  [key: string]: number;
}

/** Flattens per-hour arrays into `r0..rN` style properties; missing values are left out. */
export function buildHeatmapCollection(
  data: HeatmapResponse,
): FeatureCollection<Point, HeatmapFeatureProperties> {
  const features = data.points.map((point) => {
    const properties: HeatmapFeatureProperties = {};
    const series: [string, (number | null)[]][] = [
      ["r", point.risk],
      ["w", point.wind],
      ["p", point.precip],
      ["s", point.snow],
    ];
    for (const [prefix, values] of series) {
      for (let hour = 0; hour < values.length; hour++) {
        const value = values[hour];
        if (typeof value === "number" && Number.isFinite(value)) properties[`${prefix}${hour}`] = value;
      }
    }
    return {
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [point.lon, point.lat] },
      properties,
    };
  });
  return { type: "FeatureCollection", features };
}
