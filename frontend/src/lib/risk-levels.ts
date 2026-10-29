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
  /** badge text colour with at least 4.5:1 contrast against `color` */
  textColor: string;
}

// white on yellow/orange/green fails contrast, so the bright levels use near-black text
const RISK_TEXT_DARK = "#020c0f";

export const RISK_LEVELS: readonly RiskLevelInfo[] = [
  { level: 0, key: "low", label: "Low", color: "#22c55e", textColor: RISK_TEXT_DARK },
  { level: 1, key: "moderate", label: "Moderate", color: "#eab308", textColor: RISK_TEXT_DARK },
  { level: 2, key: "high", label: "High", color: "#f97316", textColor: RISK_TEXT_DARK },
  { level: 3, key: "severe", label: "Severe", color: "#ef4444", textColor: RISK_TEXT_DARK },
  { level: 4, key: "no_travel", label: "No Travel", color: "#7e22ce", textColor: "#ffffff" },
];

export const UNKNOWN_RISK_COLOR = "#9ca3af";
export const UNKNOWN_RISK_LABEL = "Unknown";

export function getRiskInfo(level: RiskLevel | null | undefined): RiskLevelInfo | undefined {
  return level === null || level === undefined ? undefined : RISK_LEVELS[level];
}

export function riskColor(level: RiskLevel | null | undefined): string {
  return getRiskInfo(level)?.color ?? UNKNOWN_RISK_COLOR;
}

export function riskTextColor(level: RiskLevel | null | undefined): string {
  return getRiskInfo(level)?.textColor ?? RISK_TEXT_DARK;
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
