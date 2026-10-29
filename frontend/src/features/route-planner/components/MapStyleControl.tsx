import { Map as MapIcon, Mountain, Satellite } from "lucide-react";

import type { BasemapKind } from "../basemaps";

interface MapStyleControlProps {
  basemap: BasemapKind;
  onBasemapChange: (basemap: BasemapKind) => void;
  terrain: boolean;
  onTerrainChange: (enabled: boolean) => void;
}

const BASEMAPS = [
  { value: "map", label: "Map", icon: MapIcon },
  { value: "satellite", label: "Satellite", icon: Satellite },
] as const;

/** Rendered into MapLibre's top-right control stack, directly under the zoom buttons. */
export function MapStyleControl({ basemap, onBasemapChange, terrain, onTerrainChange }: MapStyleControlProps) {
  const button = (active: boolean) =>
    `flex w-full items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
      active ? "bg-accent-soft text-accent" : "text-muted hover:bg-sunken hover:text-fg"
    }`;

  return (
    <div className="w-[6.5rem] overflow-hidden rounded-lg bg-surface shadow-panel ring-1 ring-line">
      <div role="radiogroup" aria-label="Basemap" className="divide-y divide-line">
        {BASEMAPS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={basemap === value}
            onClick={() => onBasemapChange(value)}
            className={button(basemap === value)}
          >
            <Icon className="size-3.5 shrink-0" />
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-pressed={terrain}
        onClick={() => onTerrainChange(!terrain)}
        title={terrain ? "Flatten the map" : "Show 3D terrain (right-drag to rotate)"}
        className={`border-t border-line ${button(terrain)}`}
      >
        <Mountain className="size-3.5 shrink-0" />
        Terrain
      </button>
    </div>
  );
}
