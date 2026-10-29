import { Skeleton } from "@/components/Skeleton";
import { formatDateTime, formatPounds } from "@/lib/format";

import type { PlanResponse, RouteOption } from "../types";

import { CheckpointTimeline } from "./CheckpointTimeline";
import { RecommendationBanner } from "./RecommendationBanner";
import { RouteCard } from "./RouteCard";

interface PlanResultsProps {
  plan: PlanResponse;
  routes: RouteOption[];
  selectedRoute: RouteOption | undefined;
  activeCheckpoint: number | undefined;
  onSelectRoute: (id: string) => void;
  onSelectCheckpoint: (index: number) => void;
}

export function PlanResults({
  plan,
  routes,
  selectedRoute,
  activeCheckpoint,
  onSelectRoute,
  onSelectCheckpoint,
}: PlanResultsProps) {
  if (routes.length === 0) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        No truck routes were found between these places.
      </p>
    );
  }

  const recommended = routes.find((route) => route.id === plan.recommended_route_id);

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Departing {formatDateTime(plan.departure_time)} &middot; {formatPounds(plan.load_lbs)} &middot; checkpoints every{" "}
        {plan.checkpoint_interval_mi} mi
      </p>

      <RecommendationBanner route={recommended} reason={plan.recommendation_reason} />

      <section aria-label="Route options" className="space-y-2.5">
        {routes.map((route) => (
          <RouteCard key={route.id} route={route} selected={route.id === selectedRoute?.id} onSelect={onSelectRoute} />
        ))}
      </section>

      {selectedRoute && (
        <CheckpointTimeline
          route={selectedRoute}
          activeCheckpoint={activeCheckpoint}
          onSelectCheckpoint={onSelectCheckpoint}
        />
      )}
    </div>
  );
}

export function PlanResultsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Planning routes">
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-16 w-full rounded-xl" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-3 rounded-xl border border-slate-200 bg-white p-3.5">
          <div className="flex justify-between">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-36" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-7" />
            <Skeleton className="h-7" />
            <Skeleton className="h-7" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}
