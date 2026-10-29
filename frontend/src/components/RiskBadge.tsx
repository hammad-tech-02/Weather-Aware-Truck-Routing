import type { RiskLevel } from "@/features/route-planner/types";
import { riskColor, riskLabel } from "@/lib/risk-levels";

interface RiskBadgeProps {
  level: RiskLevel | null | undefined;
  size?: "sm" | "md";
}

export function RiskBadge({ level, size = "md" }: RiskBadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full font-semibold whitespace-nowrap text-white ${
        size === "sm" ? "px-1.5 py-px text-[10px]" : "px-2 py-0.5 text-xs"
      }`}
      style={{ backgroundColor: riskColor(level) }}
    >
      {riskLabel(level)}
    </span>
  );
}
