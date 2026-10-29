import { formatMiles } from "@/lib/format";
import { RISK_LEVELS, UNKNOWN_RISK_COLOR } from "@/lib/risk-levels";

import type { MilesByLevel } from "../types";

interface RiskMilesBarProps {
  milesByLevel: MilesByLevel;
  totalMiles: number;
}

/** Stacked bar of miles per risk level; any miles without a forecast show as gray. */
export function RiskMilesBar({ milesByLevel, totalMiles }: RiskMilesBarProps) {
  const known = RISK_LEVELS.reduce((sum, info) => sum + milesByLevel[info.key], 0);
  const total = Math.max(totalMiles, known);
  const unknown = Math.max(0, total - known);
  const segments = [
    ...RISK_LEVELS.map((info) => ({ key: info.key, label: info.label, color: info.color, miles: milesByLevel[info.key] })),
    { key: "unknown", label: "No forecast", color: UNKNOWN_RISK_COLOR, miles: unknown },
  ].filter((segment) => segment.miles > 0.05);

  const description = segments.map((s) => `${s.label} ${formatMiles(s.miles)}`).join(", ");

  return (
    <div
      className="flex h-2 w-full gap-px overflow-hidden rounded-full bg-sunken"
      role="img"
      aria-label={`Miles by risk level: ${description}`}
      title={description}
    >
      {total > 0 &&
        segments.map((segment) => (
          <div
            key={segment.key}
            style={{ width: `${(segment.miles / total) * 100}%`, backgroundColor: segment.color }}
            className="h-full first:rounded-l-full last:rounded-r-full"
          />
        ))}
    </div>
  );
}
