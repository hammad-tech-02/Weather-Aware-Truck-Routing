import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useTheme } from "@/hooks/use-theme";
import { boundsOf } from "@/lib/geo";
import { getTheme } from "@/lib/theme";

import type { BasemapKind } from "../basemaps";
import { PlannerMap } from "../map-controller";
import { buildCheckpointsCollection, buildRiskSegments, buildRoutesCollection, buildStopsCollection } from "../map-data";
import { checkpointPopupHtml, stopPopupHtml } from "../popup-content";
import type { PlanResponse, RouteOption } from "../types";

import { HeatmapPanel } from "./HeatmapPanel";
import { MapLegend } from "./MapLegend";
import { MapStyleControl } from "./MapStyleControl";

/** A request to fly to a checkpoint; a fresh object each time so repeat clicks re-trigger. */
export interface CheckpointFocusRequest {
  index: number;
}

interface RouteMapProps {
  plan: PlanResponse | undefined;
  selectedRoute: RouteOption | undefined;
  isPlanning: boolean;
  activeCheckpoint: number | undefined;
  focusRequest: CheckpointFocusRequest | undefined;
  onSelectRoute: (id: string) => void;
  onActivateCheckpoint: (index: number) => void;
}

/**
 * React face of the map. Props are memoised into GeoJSON and pushed into the
 * `PlannerMap` controller, which owns the MapLibre instance and survives
 * basemap/theme switches by replaying its stored state.
 */
export function RouteMap({
  plan,
  selectedRoute,
  isPlanning,
  activeCheckpoint,
  focusRequest,
  onSelectRoute,
  onActivateCheckpoint,
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [controller, setController] = useState<PlannerMap | null>(null);
  const { theme } = useTheme();
  const [basemap, setBasemap] = useState<BasemapKind>("map");
  const [terrain, setTerrain] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // the initial style comes from the live theme; later switches go through setBasemap
    const instance = new PlannerMap(container, getTheme(), "map");
    instance.onReady(() => setController(instance));
    return () => {
      setController(null);
      instance.destroy();
    };
  }, []);

  useEffect(() => {
    controller?.setBasemap(theme, basemap);
  }, [controller, theme, basemap]);

  useEffect(() => {
    controller?.setTerrain(terrain);
  }, [controller, terrain]);

  const routesData = useMemo(() => buildRoutesCollection(plan), [plan]);
  const selectedLayers = useMemo(
    () => ({
      risk: buildRiskSegments(selectedRoute),
      checkpoints: buildCheckpointsCollection(selectedRoute, plan?.departure_time),
      stops: buildStopsCollection(selectedRoute),
    }),
    [selectedRoute, plan?.departure_time],
  );

  useEffect(() => {
    controller?.setRoutes(routesData);
  }, [controller, routesData]);

  useEffect(() => {
    controller?.setSelectedRouteLayers(selectedLayers);
  }, [controller, selectedLayers]);

  const selectedRouteId = selectedRoute?.id;
  useEffect(() => {
    controller?.setSelectedRouteId(selectedRouteId);
  }, [controller, selectedRouteId]);

  useEffect(() => {
    controller?.setActiveCheckpoint(activeCheckpoint);
  }, [controller, activeCheckpoint]);

  useEffect(() => {
    if (!controller) return;
    const line = plan?.routes[0]?.geometry;
    const start = line?.[0];
    const end = line?.[line.length - 1];
    controller.setEndpoints(start && end ? [start, end] : undefined);
  }, [controller, plan]);

  // a new plan frames every route; picking another route frames just that one
  const framedPlan = useRef<PlanResponse | undefined>(undefined);
  useEffect(() => {
    if (!controller || !plan) return;
    const isNewPlan = framedPlan.current !== plan;
    framedPlan.current = plan;
    const routes = isNewPlan ? plan.routes : plan.routes.filter((route) => route.id === selectedRouteId);
    const bounds = boundsOf(routes.flatMap((route) => route.geometry));
    if (bounds) controller.fitBounds(bounds, isNewPlan ? 900 : 600);
  }, [controller, plan, selectedRouteId]);

  useEffect(() => {
    if (!controller || !focusRequest || !selectedRoute) return;
    const checkpoint = selectedRoute.checkpoints.find((cp) => cp.index === focusRequest.index);
    if (!checkpoint) return;
    const lngLat: [number, number] = [checkpoint.lon, checkpoint.lat];
    controller.flyTo(lngLat);
    controller.openPopup(lngLat, checkpointPopupHtml(checkpoint, selectedRoute.name));
  }, [controller, focusRequest, selectedRoute]);

  // handlers close over the current route so popups always show fresh data
  useEffect(() => {
    controller?.setHandlers({
      onSelectRoute,
      onCheckpointClick: (index) => {
        const checkpoint = selectedRoute?.checkpoints.find((cp) => cp.index === index);
        if (!checkpoint || !selectedRoute) return;
        controller.openPopup([checkpoint.lon, checkpoint.lat], checkpointPopupHtml(checkpoint, selectedRoute.name));
        onActivateCheckpoint(index);
      },
      onStopClick: (index) => {
        const stop = selectedRoute?.stops[index];
        if (stop) controller.openPopup([stop.lon, stop.lat], stopPopupHtml(stop));
      },
    });
  }, [controller, selectedRoute, onSelectRoute, onActivateCheckpoint]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-canvas">
      {/* maplibre forces position: relative on its container, so size it with h/w instead of inset */}
      <div ref={containerRef} className="h-full w-full" />

      {!controller && (
        <div className="absolute inset-0 grid place-items-center text-sm text-muted">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-4 animate-spin text-accent" />
            Loading map...
          </span>
        </div>
      )}

      {controller &&
        createPortal(
          <MapStyleControl basemap={basemap} onBasemapChange={setBasemap} terrain={terrain} onTerrainChange={setTerrain} />,
          controller.controlContainer,
        )}

      {controller && <MapLegend />}

      {isPlanning && (
        <div className="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-overlay px-3 py-1.5 text-xs font-medium text-fg shadow-panel ring-1 ring-line backdrop-blur">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-3.5 animate-spin text-accent" />
            Fetching routes and forecasts...
          </span>
        </div>
      )}

      {controller && plan && <HeatmapPanel controller={controller} plan={plan} />}
    </div>
  );
}
