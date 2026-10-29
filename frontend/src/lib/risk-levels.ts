/**
 * Single source of truth for risk level labels and colors, shared by badges,
 * route bars, map layers and legends so a level always looks the same.
 */
import type { ExpressionSpecification } from "maplibre-gl";

import type { MilesByLevel, RiskLevel } from "@/features/route-planner/types";

export interface RiskLevelInfo {
  level: RiskLevel;
  key: keyof MilesByLevel;
  label: string;
  color: string;
}

export const RISK_LEVELS: readonly RiskLevelInfo[] = [
  { level: 0, key: "low", label: "Low", color: "#22c55e" },
  { level: 1, key: "moderate", label: "Moderate", color: "#eab308" },
  { level: 2, key: "high", label: "High", color: "#f97316" },
  { level: 3, key: "severe", label: "Severe", color: "#ef4444" },
  { level: 4, key: "no_travel", label: "No Travel", color: "#7e22ce" },
];

export const UNKNOWN_RISK_COLOR = "#9ca3af";
export const UNKNOWN_RISK_LABEL = "Unknown";

export function getRiskInfo(level: RiskLevel | null | undefined): RiskLevelInfo | undefined {
  return level === null || level === undefined ? undefined : RISK_LEVELS[level];
}

export function riskColor(level: RiskLevel | null | undefined): string {
  return getRiskInfo(level)?.color ?? UNKNOWN_RISK_COLOR;
}

export function riskLabel(level: RiskLevel | null | undefined): string {
  return getRiskInfo(level)?.label ?? UNKNOWN_RISK_LABEL;
}

/** MapLibre color expression for features carrying a numeric `level` property (-1 = unknown). */
export const RISK_COLOR_EXPRESSION = [
  "match",
  ["get", "level"],
  ...RISK_LEVELS.flatMap((info) => [info.level, info.color]),
  UNKNOWN_RISK_COLOR,
] as unknown as ExpressionSpecification;
