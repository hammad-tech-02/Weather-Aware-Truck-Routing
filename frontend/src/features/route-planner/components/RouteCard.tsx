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
      className={`w-full rounded-xl border bg-white p-3.5 text-left transition focus-visible:outline-2 focus-visible:outline-sky-500 ${
        selected
          ? "border-sky-500 shadow-md ring-2 ring-sky-500/20"
          : "border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-900">{route.name}</span>
            {route.recommended && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-100 px-1.5 py-px text-[10px] font-semibold tracking-wide text-sky-800 uppercase">
                <Star className="size-2.5 fill-current" />
                Recommended
              </span>
            )}
          </div>
          <p className="truncate text-xs text-slate-500" title={route.via}>
            via {route.via || "local roads"}
          </p>
        </div>
        <RiskBadge level={summary.max_level} />
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-slate-500">Distance</dt>
          <dd className="font-medium text-slate-900 tabular-nums">{formatMiles(route.distance_mi)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Driving</dt>
          <dd className="font-medium text-slate-900 tabular-nums">{formatHours(route.driving_hours)}</dd>
        </div>
        <div>
          <dt className="text-slate-500" title="Driving plus required HOS breaks and rest">
            Trip (HOS)
          </dt>
          <dd className="font-medium text-slate-900 tabular-nums">{formatHours(route.trip_hours)}</dd>
        </div>
      </dl>

      <div className="mt-3">
        <RiskMilesBar milesByLevel={summary.miles_by_level} totalMiles={route.distance_mi} />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1">
          <Flag className="size-3.5 text-slate-400" />
          Arrives {formatDateTime(route.arrival_time)}
        </span>
        <span className="inline-flex items-center gap-2 tabular-nums">
          {stopHours > 0.01 && (
            <span className="inline-flex items-center gap-1" title="Time spent in HOS breaks and rest">
              <Clock className="size-3.5 text-slate-400" />
              {formatHours(stopHours)} stops
            </span>
          )}
          <span title="Average checkpoint risk (0 Low to 4 No Travel)">
            avg risk {summary.avg_risk === null ? "n/a" : formatNumber(summary.avg_risk, 2)}
          </span>
        </span>
      </div>

      {!route.travelable && (
        <div className="mt-2.5 flex items-center gap-1.5 rounded-md bg-purple-50 px-2 py-1.5 text-xs font-medium text-purple-800">
          <AlertTriangle className="size-3.5 shrink-0" />
          Not travelable: No Travel conditions forecast on this route.
        </div>
      )}
    </button>
  );
}
