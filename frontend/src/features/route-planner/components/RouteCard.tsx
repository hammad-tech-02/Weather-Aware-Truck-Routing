import { AlertTriangle, Clock, Flag, Star } from "lucide-react";

import { RiskBadge } from "@/components/RiskBadge";
import { formatDateTime, formatHours, formatMiles, formatNumber } from "@/lib/format";

import type { RouteOption } from "../types";

import { RiskMilesBar } from "./RiskMilesBar";

interface RouteCardProps {
  route: RouteOption;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function RouteCard({ route, selected, onSelect }: RouteCardProps) {
  const { summary } = route;
  const stopHours = route.trip_hours - route.driving_hours;

  return (
    <button
      type="button"
      onClick={() => onSelect(route.id)}
      aria-pressed={selected}
      className={`group relative w-full overflow-hidden rounded-xl border p-3.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        selected
          ? "border-accent-line bg-surface shadow-panel ring-1 ring-accent-line dark:bg-raised"
          : "border-line bg-surface hover:border-line-strong dark:bg-raised/40 dark:hover:bg-raised/70"
      }`}
    >
      {/* teal edge marks the selected route, matching its highlight on the map */}
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1 transition-colors ${selected ? "bg-accent" : "bg-transparent"}`}
      />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-fg">{route.name}</span>
            {route.recommended && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-accent-soft px-1.5 py-px text-[10px] font-semibold tracking-wide text-accent uppercase ring-1 ring-accent-line">
                <Star className="size-2.5 fill-current" />
                Recommended
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted" title={route.via}>
            via {route.via || "local roads"}
          </p>
        </div>
        <RiskBadge level={summary.max_level} />
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-sunken/70 px-2.5 py-2 text-xs dark:bg-sunken">
        <div>
          <dt className="text-[11px] text-muted">Distance</dt>
          <dd className="font-semibold text-fg tabular-nums">{formatMiles(route.distance_mi)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted">Driving</dt>
          <dd className="font-semibold text-fg tabular-nums">{formatHours(route.driving_hours)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted" title="Driving plus required HOS breaks and rest">
            Trip (HOS)
          </dt>
          <dd className="font-semibold text-fg tabular-nums">{formatHours(route.trip_hours)}</dd>
        </div>
      </dl>

      <div className="mt-3">
        <RiskMilesBar milesByLevel={summary.miles_by_level} totalMiles={route.distance_mi} />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <Flag className="size-3.5 text-subtle" />
          Arrives <span className="text-fg">{formatDateTime(route.arrival_time)}</span>
        </span>
        <span className="inline-flex items-center gap-2 tabular-nums">
          {stopHours > 0.01 && (
            <span className="inline-flex items-center gap-1" title="Time spent in HOS breaks and rest">
              <Clock className="size-3.5 text-subtle" />
              {formatHours(stopHours)} stops
            </span>
          )}
          <span title="Average checkpoint risk (0 Low to 4 No Travel)">
            avg risk {summary.avg_risk === null ? "n/a" : formatNumber(summary.avg_risk, 2)}
          </span>
        </span>
      </div>

      {!route.travelable && (
        <div className="mt-2.5 flex items-center gap-1.5 rounded-md bg-purple-500/10 px-2 py-1.5 text-xs font-medium text-purple-700 ring-1 ring-purple-500/30 dark:text-purple-300">
          <AlertTriangle className="size-3.5 shrink-0" />
          Not travelable: No Travel conditions forecast on this route.
        </div>
      )}
    </button>
  );
}
