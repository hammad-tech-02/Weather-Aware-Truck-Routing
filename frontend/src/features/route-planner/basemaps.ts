/**
 * Basemap styles and the overlay colours that go with each one. Overlays are
 * re-added after every style switch, so they pick their palette from the
 * active "appearance" (dark map, light map or satellite imagery).
 */
import type { StyleSpecification } from "maplibre-gl";

import type { Theme } from "@/lib/theme";

export type BasemapKind = "map" | "satellite";
export type Appearance = Theme | "satellite";

const CARTO_STYLES: Record<Theme, string> = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
};

/** Unversioned CARTO glyph endpoint, so route and stop labels also render on the satellite style. */
const CARTO_GLYPHS = "https://tiles.basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf";

const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  glyphs: CARTO_GLYPHS,
  sources: {
    "esri-imagery": {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
    },
  },
  // no label overlay: CARTO's raster label tiles now need an api key, and the imagery reads fine without
  layers: [{ id: "satellite", type: "raster", source: "esri-imagery" }],
};

export function getAppearance(theme: Theme, kind: BasemapKind): Appearance {
  return kind === "satellite" ? "satellite" : theme;
}

export function basemapStyle(appearance: Appearance): string | StyleSpecification {
  return appearance === "satellite" ? SATELLITE_STYLE : CARTO_STYLES[appearance];
}

export interface OverlayPalette {
  routeAlt: string;
  routeAltOpacity: number;
  routeCasing: string;
  routeBase: string;
  labelText: string;
  labelRecommended: string;
  labelHalo: string;
  pointStroke: string;
  stopFill: string;
  stopText: string;
  activeRing: string;
  activeFill: string;
  heatmapOpacity: number;
  hillshade: {
    shadow: string;
    highlight: string;
    accent: string;
    exaggeration: number;
  };
}

export const OVERLAY_PALETTES: Record<Appearance, OverlayPalette> = {
  dark: {
    routeAlt: "#8fb1b8",
    routeAltOpacity: 0.5,
    routeCasing: "#031015",
    routeBase: "#5d858e",
    labelText: "#e6f1f3",
    labelRecommended: "#5fd0ca",
    labelHalo: "#071a20",
    pointStroke: "#031015",
    stopFill: "#e6f1f3",
    stopText: "#071a20",
    activeRing: "#2bb3ad",
    activeFill: "rgba(43, 179, 173, 0.2)",
    heatmapOpacity: 0.8,
    hillshade: { shadow: "#000000", highlight: "rgba(143, 177, 184, 0.35)", accent: "#0b252d", exaggeration: 0.4 },
  },
  light: {
    routeAlt: "#4d6d76",
    routeAltOpacity: 0.5,
    routeCasing: "#ffffff",
    routeBase: "#0b2a33",
    labelText: "#0b2a33",
    labelRecommended: "#0b7c79",
    labelHalo: "#ffffff",
    pointStroke: "#ffffff",
    stopFill: "#0b2a33",
    stopText: "#ffffff",
    activeRing: "#0b7c79",
    activeFill: "rgba(13, 133, 130, 0.15)",
    heatmapOpacity: 0.7,
    hillshade: { shadow: "#47626a", highlight: "#ffffff", accent: "#8aa7ae", exaggeration: 0.3 },
  },
  satellite: {
    routeAlt: "#e2e8f0",
    routeAltOpacity: 0.7,
    routeCasing: "#020c0f",
    routeBase: "#e6f1f3",
    labelText: "#ffffff",
    labelRecommended: "#7fdcd7",
    labelHalo: "#020c0f",
    pointStroke: "#020c0f",
    stopFill: "#ffffff",
    stopText: "#020c0f",
    activeRing: "#7fdcd7",
    activeFill: "rgba(127, 220, 215, 0.25)",
    heatmapOpacity: 0.85,
    hillshade: { shadow: "#000000", highlight: "rgba(255, 255, 255, 0.4)", accent: "#000000", exaggeration: 0.2 },
  },
};
