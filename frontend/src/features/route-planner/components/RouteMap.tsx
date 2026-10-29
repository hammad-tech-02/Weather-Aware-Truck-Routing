import maplibregl, { type MapGeoJSONFeature, type MapLayerMouseEvent } from "maplibre-gl";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { boundsOf } from "@/lib/geo";

import { buildCheckpointsCollection, buildRiskSegments, buildRoutesCollection, buildStopsCollection } from "../map-data";
import {
  BASEMAP_STYLE_URL,
  LAYERS,
  SOURCES,
  activeCheckpointFilter,
  addPlannerLayers,
  alternativeRoutesFilter,
  selectedRouteFilter,
  setSourceData,
} from "../map-layers";
import { checkpointPopupHtml, stopPopupHtml } from "../popup-content";
import type { PlanResponse, RouteOption } from "../types";

import { HeatmapPanel } from "./HeatmapPanel";
import { MapEmptyState } from "./MapEmptyState";
import { MapLegend } from "./MapLegend";

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

const INITIAL_VIEW = { center: [-96.5, 38.5] as [number, number], zoom: 3.4 };

/** Room left around fitted bounds; the bottom leaves space for the heatmap panel. */
function fitPadding(container: HTMLElement) {
  const { clientWidth: width, clientHeight: height } = container;
  const side = Math.min(64, width * 0.08);
  return { top: Math.min(64, height * 0.1), left: side, right: side, bottom: Math.min(190, height * 0.38) };
}

function markerElement(color: string, title: string): HTMLElement {
  const element = document.createElement("div");
  element.title = title;
  element.className = "size-4 rounded-full border-[3px] border-white shadow-md ring-1 ring-slate-900/20";
  element.style.backgroundColor = color;
  return element;
}

/**
 * MapLibre map driven imperatively from props. React owns state; this
 * component translates changes into `setData` / `setFilter` calls on sources
 * and layers created once, so re-renders never rebuild the map.
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
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [popup] = useState(() => new maplibregl.Popup({ closeButton: true, maxWidth: "280px", offset: 10 }));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const instance = new maplibregl.Map({
      container,
      style: BASEMAP_STYLE_URL,
      center: INITIAL_VIEW.center,
      zoom: INITIAL_VIEW.zoom,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    instance.touchZoomRotate.disableRotation();
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    instance.on("load", () => {
      addPlannerLayers(instance);
      setMap(instance);
    });
    return () => {
      setMap(null);
      instance.remove();
    };
  }, []);

  const routesData = useMemo(() => buildRoutesCollection(plan), [plan]);
  const riskData = useMemo(() => buildRiskSegments(selectedRoute), [selectedRoute]);
  const checkpointsData = useMemo(
    () => buildCheckpointsCollection(selectedRoute, plan?.departure_time),
    [selectedRoute, plan?.departure_time],
  );
  const stopsData = useMemo(() => buildStopsCollection(selectedRoute), [selectedRoute]);

  useEffect(() => {
    if (map) setSourceData(map, SOURCES.routes, routesData);
  }, [map, routesData]);

  useEffect(() => {
    if (!map) return;
    setSourceData(map, SOURCES.routeRisk, riskData);
    setSourceData(map, SOURCES.checkpoints, checkpointsData);
    setSourceData(map, SOURCES.stops, stopsData);
    popup.remove();
  }, [map, popup, riskData, checkpointsData, stopsData]);

  const selectedRouteId = selectedRoute?.id;
  useEffect(() => {
    if (!map) return;
    map.setFilter(LAYERS.routesAlt, alternativeRoutesFilter(selectedRouteId));
    map.setFilter(LAYERS.routeSelectedCasing, selectedRouteFilter(selectedRouteId));
    map.setFilter(LAYERS.routeSelectedBase, selectedRouteFilter(selectedRouteId));
  }, [map, selectedRouteId]);

  useEffect(() => {
    map?.setFilter(LAYERS.checkpointActive, activeCheckpointFilter(activeCheckpoint));
  }, [map, activeCheckpoint]);

  // origin/destination: two DOM markers are cheaper to style than an extra symbol layer
  useEffect(() => {
    if (!map || !plan) return;
    const first = plan.routes[0]?.geometry;
    if (!first || first.length === 0) return;
    const start = first[0]!;
    const end = first[first.length - 1]!;
    const markers = [
      new maplibregl.Marker({ element: markerElement("#0f172a", "Origin") }).setLngLat(start).addTo(map),
      new maplibregl.Marker({ element: markerElement("#0284c7", "Destination") }).setLngLat(end).addTo(map),
    ];
    return () => markers.forEach((marker) => marker.remove());
  }, [map, plan]);

  // a new plan frames every route; picking another route frames just that one
  const framedPlan = useRef<PlanResponse | undefined>(undefined);
  useEffect(() => {
    const container = containerRef.current;
    if (!map || !plan || !container) return;
    const isNewPlan = framedPlan.current !== plan;
    framedPlan.current = plan;
    const routes = isNewPlan ? plan.routes : plan.routes.filter((route) => route.id === selectedRouteId);
    const bounds = boundsOf(routes.flatMap((route) => route.geometry));
    if (bounds) map.fitBounds(bounds, { padding: fitPadding(container), duration: isNewPlan ? 900 : 600, maxZoom: 11 });
  }, [map, plan, selectedRouteId]);

  useEffect(() => {
    if (!map || !focusRequest || !selectedRoute) return;
    const checkpoint = selectedRoute.checkpoints.find((cp) => cp.index === focusRequest.index);
    if (!checkpoint) return;
    const lngLat: [number, number] = [checkpoint.lon, checkpoint.lat];
    map.flyTo({ center: lngLat, zoom: Math.max(map.getZoom(), 8), duration: 800, essential: true });
    popup.setLngLat(lngLat).setHTML(checkpointPopupHtml(checkpoint, selectedRoute.name)).addTo(map);
  }, [map, popup, focusRequest, selectedRoute]);

  // pointer interactions; rebound when the selected route changes so popups read current data
  useEffect(() => {
    if (!map) return;
    const firstFeature = (event: MapLayerMouseEvent): MapGeoJSONFeature | undefined => event.features?.[0];

    const onRouteClick = (event: MapLayerMouseEvent) => {
      const id = firstFeature(event)?.properties.id;
      if (typeof id === "string") onSelectRoute(id);
    };
    const onCheckpointClick = (event: MapLayerMouseEvent) => {
      const index = firstFeature(event)?.properties.index;
      const checkpoint = selectedRoute?.checkpoints.find((cp) => cp.index === index);
      if (!checkpoint || !selectedRoute) return;
      popup
        .setLngLat([checkpoint.lon, checkpoint.lat])
        .setHTML(checkpointPopupHtml(checkpoint, selectedRoute.name))
        .addTo(map);
      onActivateCheckpoint(checkpoint.index);
    };
    const onStopClick = (event: MapLayerMouseEvent) => {
      const i = firstFeature(event)?.properties.i;
      const stop = typeof i === "number" ? selectedRoute?.stops[i] : undefined;
      if (!stop) return;
      popup.setLngLat([stop.lon, stop.lat]).setHTML(stopPopupHtml(stop)).addTo(map);
    };
    const setPointer = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const clearPointer = () => {
      map.getCanvas().style.cursor = "";
    };

    const interactive = [LAYERS.routesAlt, LAYERS.checkpoints, LAYERS.stops];
    map.on("click", LAYERS.routesAlt, onRouteClick);
    map.on("click", LAYERS.checkpoints, onCheckpointClick);
    map.on("click", LAYERS.stops, onStopClick);
    for (const layer of interactive) {
      map.on("mouseenter", layer, setPointer);
      map.on("mouseleave", layer, clearPointer);
    }
    return () => {
      map.off("click", LAYERS.routesAlt, onRouteClick);
      map.off("click", LAYERS.checkpoints, onCheckpointClick);
      map.off("click", LAYERS.stops, onStopClick);
      for (const layer of interactive) {
        map.off("mouseenter", layer, setPointer);
        map.off("mouseleave", layer, clearPointer);
      }
    };
  }, [map, popup, selectedRoute, onSelectRoute, onActivateCheckpoint]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-100">
      {/* maplibre forces position: relative on its container, so size it with h/w instead of inset */}
      <div ref={containerRef} className="h-full w-full" />

      {!map && (
        <div className="absolute inset-0 grid place-items-center text-sm text-slate-500">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            Loading map...
          </span>
        </div>
      )}

      {map && <MapLegend />}
      {map && !plan && !isPlanning && <MapEmptyState />}

      {isPlanning && (
        <div className="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-3.5 animate-spin" />
            Fetching routes and forecasts...
          </span>
        </div>
      )}

      {map && plan && <HeatmapPanel map={map} plan={plan} />}
    </div>
  );
}
