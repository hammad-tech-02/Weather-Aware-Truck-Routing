/**
 * Imperative owner of the MapLibre map.
 *
 * React pushes state in through setters; the controller keeps the latest copy
 * of everything it has been given. That copy is what makes basemap and theme
 * switches safe: `setStyle` wipes every custom source and layer, so on each
 * `style.load` the overlays are rebuilt and the stored state (route data,
 * selection, heatmap hour/metric/visibility, terrain) is replayed. Setters
 * called mid-switch only update the stored state and are applied on load.
 */
import type { FeatureCollection } from "geojson";
import maplibregl, {
  type ExpressionSpecification,
  type IControl,
  type LngLatBoundsLike,
  type LngLatLike,
  type MapGeoJSONFeature,
  type MapLayerMouseEvent,
} from "maplibre-gl";

import type { Theme } from "@/lib/theme";

import { basemapStyle, getAppearance, type Appearance, type BasemapKind } from "./basemaps";
import { heatmapColorExpression, heatmapRadiusExpression, heatmapWeightExpression, type HeatmapMetric } from "./heatmap";
import {
  EMPTY_COLLECTION,
  LAYERS,
  SOURCES,
  TERRAIN_EXAGGERATION,
  activeCheckpointFilter,
  addOverlays,
  alternativeRoutesFilter,
  hoveredRouteFilter,
  selectedRouteFilter,
  setSourceData,
} from "./map-layers";

export interface HeatmapView {
  metric: HeatmapMetric;
  hour: number;
  visible: boolean;
}

export interface SelectedRouteLayers {
  risk: FeatureCollection;
  checkpoints: FeatureCollection;
  stops: FeatureCollection;
}

export interface PlannerMapHandlers {
  onSelectRoute: (id: string) => void;
  onCheckpointClick: (index: number) => void;
  onStopClick: (index: number) => void;
}

interface PlannerMapState {
  appearance: Appearance;
  routes: FeatureCollection;
  selected: SelectedRouteLayers;
  selectedRouteId: string | undefined;
  activeCheckpoint: number | undefined;
  heatmap: FeatureCollection;
  heatmapSpacingPx: number | undefined;
  heatmapView: HeatmapView;
  terrain: boolean;
}

const TERRAIN_PITCH = 50;

/** Hosts React-rendered map controls inside MapLibre's own control stack. */
class ContainerControl implements IControl {
  readonly container = document.createElement("div");

  onAdd(): HTMLElement {
    this.container.className = "maplibregl-ctrl";
    return this.container;
  }

  onRemove(): void {
    this.container.remove();
  }
}

/** Checkpoints within ~1 h of the slider time stay solid; the rest fade with distance in time. */
function checkpointOpacity(hour: number): ExpressionSpecification {
  return ["interpolate", ["linear"], ["abs", ["-", ["get", "h"], hour]], 1, 1, 4, 0.3];
}

function markerElement(variant: "origin" | "destination", title: string): HTMLElement {
  const element = document.createElement("div");
  element.title = title;
  element.className =
    variant === "origin"
      ? "size-4 rounded-full border-[4px] border-[#0d8582] bg-white shadow-md ring-2 ring-black/30"
      : "size-4 rounded-full border-[3px] border-white bg-[#0d8582] shadow-md ring-2 ring-black/30";
  return element;
}

export class PlannerMap {
  readonly map: maplibregl.Map;
  readonly controlContainer: HTMLElement;

  private readonly popup = new maplibregl.Popup({ closeButton: true, maxWidth: "280px", offset: 10 });
  private readonly markers: maplibregl.Marker[] = [];
  private handlers: PlannerMapHandlers | undefined;
  private styleReady = false;
  private readyCallback: (() => void) | undefined;
  private state: PlannerMapState;

  constructor(container: HTMLElement, theme: Theme, basemap: BasemapKind) {
    const appearance = getAppearance(theme, basemap);
    this.state = {
      appearance,
      routes: EMPTY_COLLECTION,
      selected: { risk: EMPTY_COLLECTION, checkpoints: EMPTY_COLLECTION, stops: EMPTY_COLLECTION },
      selectedRouteId: undefined,
      activeCheckpoint: undefined,
      heatmap: EMPTY_COLLECTION,
      heatmapSpacingPx: undefined,
      heatmapView: { metric: "risk", hour: 0, visible: true },
      terrain: false,
    };

    this.map = new maplibregl.Map({
      container,
      style: basemapStyle(appearance),
      center: [-96.5, 38.5],
      zoom: 3.4,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      maxPitch: 70,
    });
    this.map.touchZoomRotate.disableRotation();
    this.map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    const control = new ContainerControl();
    this.map.addControl(control, "top-right");
    this.controlContainer = control.container;
    // licences require the credits; compact keeps them behind a small "i" button
    this.map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    this.map.on("style.load", this.handleStyleLoad);
    this.bindInteractions();
  }

  /** Runs once, after the first style has loaded and overlays exist. */
  onReady(callback: () => void): void {
    if (this.styleReady) callback();
    else this.readyCallback = callback;
  }

  setHandlers(handlers: PlannerMapHandlers): void {
    this.handlers = handlers;
  }

  destroy(): void {
    this.readyCallback = undefined;
    this.markers.forEach((marker) => marker.remove());
    this.map.remove();
  }

  setBasemap(theme: Theme, basemap: BasemapKind): void {
    const appearance = getAppearance(theme, basemap);
    if (appearance === this.state.appearance) return;
    this.state.appearance = appearance;
    this.styleReady = false;
    // the terrain source is about to disappear with the old style
    if (this.state.terrain) this.map.setTerrain(null);
    // diff: false guarantees a full reload, and with it a style.load to rebuild on
    this.map.setStyle(basemapStyle(appearance), { diff: false });
  }

  setRoutes(routes: FeatureCollection): void {
    this.state.routes = routes;
    if (this.styleReady) setSourceData(this.map, SOURCES.routes, routes);
  }

  setSelectedRouteLayers(selected: SelectedRouteLayers): void {
    this.state.selected = selected;
    this.popup.remove();
    if (this.styleReady) this.applySelectedRouteLayers();
  }

  setSelectedRouteId(routeId: string | undefined): void {
    this.state.selectedRouteId = routeId;
    if (this.styleReady) this.applySelection();
  }

  setActiveCheckpoint(index: number | undefined): void {
    this.state.activeCheckpoint = index;
    if (this.styleReady) this.map.setFilter(LAYERS.checkpointActive, activeCheckpointFilter(index));
  }

  setHeatmapData(data: FeatureCollection | undefined, spacingPx: number | undefined): void {
    this.state.heatmap = data ?? EMPTY_COLLECTION;
    this.state.heatmapSpacingPx = spacingPx;
    if (this.styleReady) this.applyHeatmapData();
  }

  /** Called on every slider tick; only touches paint properties, never data. */
  setHeatmapView(view: HeatmapView): void {
    const previous = this.state.heatmapView;
    this.state.heatmapView = view;
    if (this.styleReady) this.applyHeatmapView(previous);
  }

  setTerrain(enabled: boolean): void {
    if (enabled === this.state.terrain) return;
    this.state.terrain = enabled;
    if (this.styleReady) this.applyTerrain();
    if (enabled) {
      this.map.dragRotate.enable();
      this.map.touchZoomRotate.enableRotation();
      this.map.easeTo({ pitch: TERRAIN_PITCH, duration: 900 });
    } else {
      this.map.dragRotate.disable();
      this.map.touchZoomRotate.disableRotation();
      this.map.easeTo({ pitch: 0, bearing: 0, duration: 700 });
    }
  }

  setEndpoints(endpoints: [LngLatLike, LngLatLike] | undefined): void {
    // dom markers live outside the style, so they survive basemap switches untouched
    this.markers.forEach((marker) => marker.remove());
    this.markers.length = 0;
    if (!endpoints) return;
    this.markers.push(
      new maplibregl.Marker({ element: markerElement("origin", "Origin") }).setLngLat(endpoints[0]).addTo(this.map),
      new maplibregl.Marker({ element: markerElement("destination", "Destination") })
        .setLngLat(endpoints[1])
        .addTo(this.map),
    );
  }

  fitBounds(bounds: LngLatBoundsLike, duration: number): void {
    const container = this.map.getContainer();
    const { clientWidth: width, clientHeight: height } = container;
    const side = Math.min(64, width * 0.08);
    this.map.fitBounds(bounds, {
      // the bottom leaves room for the heatmap panel
      padding: { top: Math.min(64, height * 0.1), left: side, right: side + 40, bottom: Math.min(190, height * 0.38) },
      duration,
      maxZoom: 11,
      pitch: this.map.getPitch(),
      bearing: this.map.getBearing(),
    });
  }

  flyTo(center: LngLatLike): void {
    this.map.flyTo({ center, zoom: Math.max(this.map.getZoom(), 8), duration: 800, essential: true });
  }

  openPopup(lngLat: LngLatLike, html: string): void {
    this.popup.setLngLat(lngLat).setHTML(html).addTo(this.map);
  }

  private handleStyleLoad = () => {
    addOverlays(this.map, this.state.appearance);
    this.styleReady = true;
    setSourceData(this.map, SOURCES.routes, this.state.routes);
    this.applySelectedRouteLayers();
    this.applySelection();
    this.map.setFilter(LAYERS.checkpointActive, activeCheckpointFilter(this.state.activeCheckpoint));
    this.applyHeatmapData();
    this.applyHeatmapView(undefined);
    this.applyTerrain();
    this.collapseAttribution();
    // the compact control only switches to compact mode once the new style's credits arrive
    this.map.once("idle", this.collapseAttribution);

    const callback = this.readyCallback;
    this.readyCallback = undefined;
    callback?.();
  };

  /**
   * MapLibre expands compact attribution on wide maps; fold it back to the
   * button. In 4.x the collapsed state is `open` without `compact-show`.
   */
  private collapseAttribution = () => {
    const attribution = this.map.getContainer().querySelector(".maplibregl-ctrl-attrib.maplibregl-compact");
    if (!attribution) return;
    attribution.classList.remove("maplibregl-compact-show");
    attribution.setAttribute("open", "");
  };

  private applySelectedRouteLayers(): void {
    setSourceData(this.map, SOURCES.routeRisk, this.state.selected.risk);
    setSourceData(this.map, SOURCES.checkpoints, this.state.selected.checkpoints);
    setSourceData(this.map, SOURCES.stops, this.state.selected.stops);
  }

  private applySelection(): void {
    const id = this.state.selectedRouteId;
    this.map.setFilter(LAYERS.routesAlt, alternativeRoutesFilter(id));
    this.map.setFilter(LAYERS.routesHit, alternativeRoutesFilter(id));
    this.map.setFilter(LAYERS.routeHover, hoveredRouteFilter(undefined));
    this.map.setFilter(LAYERS.routeSelectedCasing, selectedRouteFilter(id));
    this.map.setFilter(LAYERS.routeSelectedBase, selectedRouteFilter(id));
  }

  private applyHeatmapData(): void {
    setSourceData(this.map, SOURCES.heatmap, this.state.heatmap);
    if (this.state.heatmapSpacingPx !== undefined) {
      this.map.setPaintProperty(LAYERS.heatmap, "heatmap-radius", heatmapRadiusExpression(this.state.heatmapSpacingPx));
    }
  }

  /** Applies only what changed since `previous` (everything when undefined, i.e. after a style load). */
  private applyHeatmapView(previous: HeatmapView | undefined): void {
    const { metric, hour, visible } = this.state.heatmapView;
    if (metric !== previous?.metric) {
      this.map.setPaintProperty(LAYERS.heatmap, "heatmap-color", heatmapColorExpression(metric));
    }
    if (metric !== previous?.metric || hour !== previous.hour) {
      this.map.setPaintProperty(LAYERS.heatmap, "heatmap-weight", heatmapWeightExpression(metric, hour));
    }
    if (visible !== previous?.visible) {
      this.map.setLayoutProperty(LAYERS.heatmap, "visibility", visible ? "visible" : "none");
    }
    if (visible !== previous?.visible || hour !== previous.hour) {
      const opacity = visible ? checkpointOpacity(hour) : 1;
      this.map.setPaintProperty(LAYERS.checkpoints, "circle-opacity", opacity);
      this.map.setPaintProperty(LAYERS.checkpoints, "circle-stroke-opacity", opacity);
    }
  }

  private applyTerrain(): void {
    const enabled = this.state.terrain;
    this.map.setLayoutProperty(LAYERS.hillshade, "visibility", enabled ? "visible" : "none");
    this.map.setTerrain(enabled ? { source: SOURCES.terrainDem, exaggeration: TERRAIN_EXAGGERATION } : null);
  }

  /** Layer-scoped listeners are kept by the map, not the style, so they are bound only once. */
  private bindInteractions(): void {
    const map = this.map;
    const firstFeature = (event: MapLayerMouseEvent): MapGeoJSONFeature | undefined => event.features?.[0];

    map.on("click", LAYERS.routesHit, (event) => {
      // checkpoints and stops sit on top and have their own click handlers
      if (map.queryRenderedFeatures(event.point, { layers: [LAYERS.checkpoints, LAYERS.stops] }).length) return;
      const id = firstFeature(event)?.properties.id;
      if (typeof id === "string") this.handlers?.onSelectRoute(id);
    });
    map.on("mousemove", LAYERS.routesHit, (event) => {
      map.setFilter(LAYERS.routeHover, hoveredRouteFilter(firstFeature(event)?.properties.id));
    });
    map.on("mouseleave", LAYERS.routesHit, () => {
      map.setFilter(LAYERS.routeHover, hoveredRouteFilter(undefined));
    });
    map.on("click", LAYERS.checkpoints, (event) => {
      const index = firstFeature(event)?.properties.index;
      if (typeof index === "number") this.handlers?.onCheckpointClick(index);
    });
    map.on("click", LAYERS.stops, (event) => {
      const index = firstFeature(event)?.properties.i;
      if (typeof index === "number") this.handlers?.onStopClick(index);
    });

    for (const layer of [LAYERS.routesHit, LAYERS.checkpoints, LAYERS.stops]) {
      map.on("mouseenter", layer, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", layer, () => {
        map.getCanvas().style.cursor = "";
      });
    }
  }

}
