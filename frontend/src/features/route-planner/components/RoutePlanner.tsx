import { CloudLightning } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { usePlanRoute } from "../queries";
import type { PlanRequest, PlanResponse } from "../types";

import { PlanError } from "./PlanError";
import { PlanResults, PlanResultsSkeleton } from "./PlanResults";
import { RouteMap, type CheckpointFocusRequest } from "./RouteMap";
import { TripForm } from "./TripForm";

/**
 * Page shell and the state shared between sidebar and map: the current plan,
 * the selected route and the active checkpoint. Heatmap slider state is kept
 * out of here on purpose (see HeatmapPanel).
 */
export function RoutePlanner() {
  const planRoute = usePlanRoute();
  const [plan, setPlan] = useState<PlanResponse>();
  const [selectedRouteId, setSelectedRouteId] = useState<string>();
  const [activeCheckpoint, setActiveCheckpoint] = useState<number>();
  const [focusRequest, setFocusRequest] = useState<CheckpointFocusRequest>();

  const routes = useMemo(() => [...(plan?.routes ?? [])].sort((a, b) => a.rank - b.rank), [plan]);
  const selectedRoute = routes.find((route) => route.id === selectedRouteId);

  const handleSubmit = (request: PlanRequest) => {
    planRoute.mutate(request, {
      onSuccess: (data) => {
        setPlan(data);
        setSelectedRouteId(data.recommended_route_id || data.routes[0]?.id);
        setActiveCheckpoint(undefined);
        setFocusRequest(undefined);
      },
    });
  };

  const selectRoute = useCallback((id: string) => {
    setSelectedRouteId(id);
    setActiveCheckpoint(undefined);
    setFocusRequest(undefined);
  }, []);

  const focusCheckpoint = useCallback((index: number) => {
    setActiveCheckpoint(index);
    setFocusRequest({ index });
  }, []);

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:flex-row lg:overflow-hidden">
      <main className="relative h-[55vh] shrink-0 lg:order-last lg:h-auto lg:flex-1">
        <RouteMap
          plan={plan}
          selectedRoute={selectedRoute}
          isPlanning={planRoute.isPending}
          activeCheckpoint={activeCheckpoint}
          focusRequest={focusRequest}
          onSelectRoute={selectRoute}
          onActivateCheckpoint={setActiveCheckpoint}
        />
      </main>

      <aside className="flex w-full flex-col border-slate-200 bg-white lg:w-[400px] lg:shrink-0 lg:overflow-y-auto lg:border-r">
        <header className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
          <span className="grid size-8 place-items-center rounded-lg bg-slate-900 text-sky-300">
            <CloudLightning className="size-4.5" />
          </span>
          <div>
            <h1 className="text-sm font-semibold text-slate-900">Weather-Aware Truck Routing</h1>
            <p className="text-xs text-slate-500">Compare routes by forecast risk along the way</p>
          </div>
        </header>

        <div className="space-y-5 px-5 py-5">
          <TripForm isPending={planRoute.isPending} onSubmit={handleSubmit} />

          {planRoute.isError && <PlanError error={planRoute.error} />}

          {planRoute.isPending ? (
            <PlanResultsSkeleton />
          ) : (
            plan && (
              <PlanResults
                plan={plan}
                routes={routes}
                selectedRoute={selectedRoute}
                activeCheckpoint={activeCheckpoint}
                onSelectRoute={selectRoute}
                onSelectCheckpoint={focusCheckpoint}
              />
            )
          )}
        </div>
      </aside>
    </div>
  );
}
