/**
 * Overlay sources and layers. `setStyle` throws away everything that is not
 * part of the basemap, so `addOverlays` must be able to rebuild the full stack
 * from scratch on every `style.load`; data and view state are then re-applied
 * by the map controller.
 */
import type { FeatureCollection } from "geojson";
import type { ExpressionSpecification, FilterSpecification, GeoJSONSource, Map as MaplibreMap } from "maplibre-gl";

import { RISK_COLOR_EXPRESSION } from "@/lib/risk-levels";

import { OVERLAY_PALETTES, type Appearance } from "./basemaps";
import { HEATMAP_INTENSITY, heatmapColorExpression } from "./heatmap";

/** A font stack the CARTO glyph server serves (taken from its GL styles). */
const LABEL_FONT = ["Montserrat SemiBold", "Open Sans Bold", "Noto Sans Regular", "Noto Sans CJK JP Regular"];

const TERRARIUM_TILES = ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"];

export const SOURCES = {
  heatmap: "heatmap",
  routes: "routes",
  routeRisk: "route-risk",
  checkpoints: "checkpoints",
  stops: "stops",
  // terrain and hillshade read separate copies; maplibre degrades quality when one source serves both
  terrainDem: "terrain-dem",
  hillshadeDem: "hillshade-dem",
} as const;

export const LAYERS = {
  hillshade: "hillshade",
  heatmap: "heatmap",
  routesAlt: "routes-alt",
  routeHover: "route-hover",
  routesHit: "routes-hit",
  routeSelectedCasing: "route-selected-casing",
  routeSelectedBase: "route-selected-base",
  routeRisk: "route-risk",
  routeLabels: "route-labels",
  stops: "stops",
  stopLabels: "stop-labels",
  checkpointActive: "checkpoint-active",
  checkpoints: "checkpoints",
} as const;

export const TERRAIN_EXAGGERATION = 1.3;

export const EMPTY_COLLECTION: FeatureCollection = { type: "FeatureCollection", features: [] };

export function setSourceData(map: MaplibreMap, id: string, data: FeatureCollection): void {
  (map.getSource(id) as GeoJSONSource | undefined)?.setData(data);
}

export function selectedRouteFilter(routeId: string | undefined): FilterSpecification {
  return ["==", ["get", "id"], routeId ?? ""];
}

export function alternativeRoutesFilter(routeId: string | undefined): FilterSpecification {
  return ["!=", ["get", "id"], routeId ?? ""];
}

/** Matches nothing until a route is hovered. */
export function hoveredRouteFilter(routeId: string | undefined): FilterSpecification {
  return ["==", ["get", "id"], routeId ?? ""];
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

/**
 * Basemap layer to insert line overlays under: the first label after the last
 * fill/line layer, so routes draw above roads but city names stay readable.
 * Styles without symbol layers (satellite) get undefined, i.e. the top.
 */
function findLabelAnchor(map: MaplibreMap): string | undefined {
  const layers = map.getStyle().layers;
  let lastNonSymbol = -1;
  layers.forEach((layer, index) => {
    if (layer.type !== "symbol") lastNonSymbol = index;
  });
  return layers[lastNonSymbol + 1]?.id;
}

export function addOverlays(map: MaplibreMap, appearance: Appearance): void {
  const palette = OVERLAY_PALETTES[appearance];
  const anchor = findLabelAnchor(map);

  for (const id of [SOURCES.heatmap, SOURCES.routes, SOURCES.routeRisk, SOURCES.checkpoints, SOURCES.stops]) {
    map.addSource(id, { type: "geojson", data: EMPTY_COLLECTION });
  }
  // dem tiles are only requested once terrain or the hillshade layer is switched on
  for (const id of [SOURCES.terrainDem, SOURCES.hillshadeDem]) {
    map.addSource(id, { type: "raster-dem", tiles: TERRARIUM_TILES, encoding: "terrarium", tileSize: 256, maxzoom: 15 });
  }

  // below the label anchor, bottom to top: hillshade, heatmap, route lines
  map.addLayer(
    {
      id: LAYERS.hillshade,
      type: "hillshade",
      source: SOURCES.hillshadeDem,
      layout: { visibility: "none" },
      paint: {
        "hillshade-shadow-color": palette.hillshade.shadow,
        "hillshade-highlight-color": palette.hillshade.highlight,
        "hillshade-accent-color": palette.hillshade.accent,
        "hillshade-exaggeration": palette.hillshade.exaggeration,
      },
    },
    anchor,
  );

  map.addLayer(
    {
      id: LAYERS.heatmap,
      type: "heatmap",
      source: SOURCES.heatmap,
      paint: {
        "heatmap-weight": 0,
        "heatmap-intensity": HEATMAP_INTENSITY,
        "heatmap-color": heatmapColorExpression("risk"),
        "heatmap-opacity": palette.heatmapOpacity,
      },
    },
    anchor,
  );

  map.addLayer(
    {
      id: LAYERS.routesAlt,
      type: "line",
      source: SOURCES.routes,
      filter: alternativeRoutesFilter(undefined),
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": palette.routeAlt,
        "line-width": zoomScaled(3, 6),
        "line-opacity": palette.routeAltOpacity,
      },
    },
    anchor,
  );

  map.addLayer(
    {
      id: LAYERS.routeHover,
      type: "line",
      source: SOURCES.routes,
      filter: hoveredRouteFilter(undefined),
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": palette.routeAlt, "line-width": zoomScaled(5, 9), "line-opacity": 0.9 },
    },
    anchor,
  );

  // invisible wide line so the thin alternative routes are easy to click
  map.addLayer(
    {
      id: LAYERS.routesHit,
      type: "line",
      source: SOURCES.routes,
      filter: alternativeRoutesFilter(undefined),
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": "#000000", "line-width": 24, "line-opacity": 0 },
    },
    anchor,
  );

  map.addLayer(
    {
      id: LAYERS.routeSelectedCasing,
      type: "line",
      source: SOURCES.routes,
      filter: selectedRouteFilter(undefined),
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": palette.routeCasing, "line-width": zoomScaled(8, 14) },
    },
    anchor,
  );

  // drawn under the risk segments so any gap still shows the route
  map.addLayer(
    {
      id: LAYERS.routeSelectedBase,
      type: "line",
      source: SOURCES.routes,
      filter: selectedRouteFilter(undefined),
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": palette.routeBase, "line-width": zoomScaled(5, 9) },
    },
    anchor,
  );

  map.addLayer(
    {
      id: LAYERS.routeRisk,
      type: "line",
      source: SOURCES.routeRisk,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": RISK_COLOR_EXPRESSION, "line-width": zoomScaled(4, 7) },
    },
    anchor,
  );

  // above the basemap labels: route names, stops and checkpoints must never be hidden
  map.addLayer({
    id: LAYERS.routeLabels,
    type: "symbol",
    source: SOURCES.routes,
    layout: {
      "symbol-placement": "line",
      "symbol-spacing": 300,
      "text-field": ["get", "label"],
      "text-font": LABEL_FONT,
      "text-size": 12,
      "text-offset": [0, -1.1],
      // real road geometry bends a lot; a strict angle limit leaves no room to place a label
      "text-max-angle": 75,
      "text-keep-upright": true,
    },
    paint: {
      "text-color": ["case", ["get", "recommended"], palette.labelRecommended, palette.labelText],
      "text-halo-color": palette.labelHalo,
      "text-halo-width": 2,
    },
  });

  map.addLayer({
    id: LAYERS.stops,
    type: "circle",
    source: SOURCES.stops,
    paint: {
      "circle-radius": zoomScaled(6, 9),
      "circle-color": palette.stopFill,
      "circle-stroke-color": palette.pointStroke,
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
    paint: { "text-color": palette.stopText },
  });

  map.addLayer({
    id: LAYERS.checkpointActive,
    type: "circle",
    source: SOURCES.checkpoints,
    filter: activeCheckpointFilter(undefined),
    paint: {
      "circle-radius": zoomScaled(9, 14),
      "circle-color": palette.activeFill,
      "circle-stroke-color": palette.activeRing,
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
      "circle-stroke-color": palette.pointStroke,
      "circle-stroke-width": 1.5,
    },
  });
}
