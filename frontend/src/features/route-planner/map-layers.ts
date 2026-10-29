/**
 * Sources and layers for the route map. They are created once when the style
 * loads and afterwards only mutated (`setData`, `setFilter`,
 * `setPaintProperty`), which is much cheaper than re-adding them.
 */
import type { FeatureCollection } from "geojson";
import type { ExpressionSpecification, FilterSpecification, GeoJSONSource, Map as MaplibreMap } from "maplibre-gl";

import { RISK_COLOR_EXPRESSION } from "@/lib/risk-levels";

import { HEATMAP_INTENSITY, heatmapColorExpression } from "./heatmap";

export const BASEMAP_STYLE_URL = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

/** A font stack the CARTO glyph server actually serves (taken from the positron style). */
const LABEL_FONT = ["Montserrat SemiBold", "Open Sans Bold", "Noto Sans Regular", "Noto Sans CJK JP Regular"];

export const SOURCES = {
  heatmap: "heatmap",
  routes: "routes",
  routeRisk: "route-risk",
  checkpoints: "checkpoints",
  stops: "stops",
} as const;

export const LAYERS = {
  heatmap: "heatmap",
  routesAlt: "routes-alt",
  routeSelectedCasing: "route-selected-casing",
  routeSelectedBase: "route-selected-base",
  routeRisk: "route-risk",
  routeLabels: "route-labels",
  stops: "stops",
  stopLabels: "stop-labels",
  checkpointActive: "checkpoint-active",
  checkpoints: "checkpoints",
} as const;

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

export function setSourceData(map: MaplibreMap, id: string, data: FeatureCollection): void {
  (map.getSource(id) as GeoJSONSource | undefined)?.setData(data);
}

export function selectedRouteFilter(routeId: string | undefined): FilterSpecification {
  return ["==", ["get", "id"], routeId ?? ""];
}

export function alternativeRoutesFilter(routeId: string | undefined): FilterSpecification {
  return ["!=", ["get", "id"], routeId ?? ""];
}

export function activeCheckpointFilter(index: number | undefined): FilterSpecification {
  return ["==", ["get", "index"], index ?? -1];
}

const zoomScaled = (low: number, high: number): ExpressionSpecification => [
  "interpolate",
  ["linear"],
  ["zoom"],
  4,
  low,
  11,
  high,
];

export function addPlannerLayers(map: MaplibreMap): void {
  for (const id of Object.values(SOURCES)) {
    map.addSource(id, { type: "geojson", data: EMPTY });
  }

  // heatmap sits above roads but below place labels so city names stay readable
  const layers = map.getStyle().layers;
  const labelLayer =
    layers.find((layer) => layer.type === "symbol" && layer.id.startsWith("watername")) ??
    layers.find((layer) => layer.type === "symbol");

  map.addLayer(
    {
      id: LAYERS.heatmap,
      type: "heatmap",
      source: SOURCES.heatmap,
      layout: { visibility: "visible" },
      paint: {
        "heatmap-weight": 0,
        "heatmap-intensity": HEATMAP_INTENSITY,
        "heatmap-color": heatmapColorExpression("risk"),
        "heatmap-opacity": 0.75,
      },
    },
    labelLayer?.id,
  );

  map.addLayer({
    id: LAYERS.routesAlt,
    type: "line",
    source: SOURCES.routes,
    filter: alternativeRoutesFilter(undefined),
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "#475569",
      "line-width": zoomScaled(3, 6),
      "line-opacity": 0.5,
    },
  });

  map.addLayer({
    id: LAYERS.routeSelectedCasing,
    type: "line",
    source: SOURCES.routes,
    filter: selectedRouteFilter(undefined),
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": "#ffffff", "line-width": zoomScaled(8, 14) },
  });

  // drawn under the risk segments so any gap still shows the route
  map.addLayer({
    id: LAYERS.routeSelectedBase,
    type: "line",
    source: SOURCES.routes,
    filter: selectedRouteFilter(undefined),
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": "#0f172a", "line-width": zoomScaled(5, 9) },
  });

  map.addLayer({
    id: LAYERS.routeRisk,
    type: "line",
    source: SOURCES.routeRisk,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": RISK_COLOR_EXPRESSION, "line-width": zoomScaled(4, 7) },
  });

  map.addLayer({
    id: LAYERS.routeLabels,
    type: "symbol",
    source: SOURCES.routes,
    layout: {
      "symbol-placement": "line",
      "symbol-spacing": 400,
      "text-field": ["get", "label"],
      "text-font": LABEL_FONT,
      "text-size": 12,
      "text-offset": [0, -1.1],
      "text-max-angle": 30,
    },
    paint: {
      "text-color": ["case", ["get", "recommended"], "#075985", "#334155"],
      "text-halo-color": "#ffffff",
      "text-halo-width": 2,
    },
  });

  map.addLayer({
    id: LAYERS.stops,
    type: "circle",
    source: SOURCES.stops,
    paint: {
      "circle-radius": zoomScaled(6, 9),
      "circle-color": ["match", ["get", "type"], "rest", "#1e293b", "#475569"],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1.5,
    },
  });

  map.addLayer({
    id: LAYERS.stopLabels,
    type: "symbol",
    source: SOURCES.stops,
    layout: {
      "text-field": ["get", "label"],
      "text-font": LABEL_FONT,
      "text-size": 10,
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: { "text-color": "#ffffff" },
  });

  map.addLayer({
    id: LAYERS.checkpointActive,
    type: "circle",
    source: SOURCES.checkpoints,
    filter: activeCheckpointFilter(undefined),
    paint: {
      "circle-radius": zoomScaled(9, 14),
      "circle-color": "rgba(14, 165, 233, 0.15)",
      "circle-stroke-color": "#0284c7",
      "circle-stroke-width": 2,
    },
  });

  map.addLayer({
    id: LAYERS.checkpoints,
    type: "circle",
    source: SOURCES.checkpoints,
    paint: {
      "circle-radius": zoomScaled(3.5, 7),
      "circle-color": RISK_COLOR_EXPRESSION,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1.5,
    },
  });
}
