import type { ExpressionSpecification, Map as MaplibreMap } from "maplibre-gl";
import { AlertCircle, Eye, EyeOff, Loader2, Pause, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { SegmentedControl } from "@/components/SegmentedControl";
import { HOUR_MS, floorToHour } from "@/lib/datetime";
import { formatDateTime } from "@/lib/format";

import {
  HEATMAP_METRICS,
  buildHeatmapCollection,
  estimateGridSpacingPx,
  getMetricConfig,
  heatmapColorExpression,
  heatmapLegendGradient,
  heatmapRadiusExpression,
  heatmapWeightExpression,
  type HeatmapMetric,
} from "../heatmap";
import { LAYERS, SOURCES, setSourceData } from "../map-layers";
import { useHeatmap } from "../queries";
import type { PlanResponse } from "../types";

const PLAY_STEP_MS = 400;
const DEFAULT_HOURS = 49;

const METRIC_OPTIONS = HEATMAP_METRICS.map((metric) => ({ value: metric.id, label: metric.label }));

/** Checkpoints within ~1 h of the slider time stay solid; the rest fade out with distance in time. */
function checkpointOpacity(hour: number): ExpressionSpecification {
  return ["interpolate", ["linear"], ["abs", ["-", ["get", "h"], hour]], 1, 1, 4, 0.3];
}

interface HeatmapPanelProps {
  map: MaplibreMap;
  plan: PlanResponse;
}

/**
 * Forecast slider and heatmap controls. Hour, metric and visibility live
 * here, not in the planner, so scrubbing re-renders only this panel and
 * updates the map through `setPaintProperty` without touching the data.
 */
export function HeatmapPanel({ map, plan }: HeatmapPanelProps) {
  const { data, isFetching, isError, refetch } = useHeatmap(plan);
  const [hour, setHour] = useState(0);
  const [metric, setMetric] = useState<HeatmapMetric>("risk");
  const [visible, setVisible] = useState(true);
  const [playing, setPlaying] = useState(false);

  const hours = data?.hours ?? DEFAULT_HOURS;
  const maxHour = Math.max(0, hours - 1);
  const shownHour = Math.min(hour, maxHour);
  const startMs = floorToHour(Date.parse(data?.start_time ?? plan.departure_time));

  const collection = useMemo(() => (data ? buildHeatmapCollection(data) : undefined), [data]);
  const spacingPx = useMemo(() => (data ? estimateGridSpacingPx(data.points) : undefined), [data]);

  // the only data upload: once per heatmap response
  useEffect(() => {
    setSourceData(map, SOURCES.heatmap, collection ?? { type: "FeatureCollection", features: [] });
    if (spacingPx !== undefined) map.setPaintProperty(LAYERS.heatmap, "heatmap-radius", heatmapRadiusExpression(spacingPx));
  }, [map, collection, spacingPx]);

  useEffect(() => {
    map.setPaintProperty(LAYERS.heatmap, "heatmap-color", heatmapColorExpression(metric));
  }, [map, metric]);

  // per-frame path while scrubbing or playing: swap the property name only
  useEffect(() => {
    map.setPaintProperty(LAYERS.heatmap, "heatmap-weight", heatmapWeightExpression(metric, shownHour));
  }, [map, metric, shownHour]);

  useEffect(() => {
    map.setLayoutProperty(LAYERS.heatmap, "visibility", visible ? "visible" : "none");
    const opacity = visible ? checkpointOpacity(shownHour) : 1;
    map.setPaintProperty(LAYERS.checkpoints, "circle-opacity", opacity);
    map.setPaintProperty(LAYERS.checkpoints, "circle-stroke-opacity", opacity);
  }, [map, visible, shownHour]);

  const config = getMetricConfig(metric);
  const ready = data !== undefined;
  // pauses implicitly while a new grid loads or the layer is hidden
  const isPlaying = playing && ready && visible;

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setHour((h) => (Math.min(h, maxHour) >= maxHour ? 0 : h + 1));
    }, PLAY_STEP_MS);
    return () => window.clearInterval(timer);
  }, [isPlaying, maxHour]);

  return (
    <div className="absolute inset-x-2 bottom-2 z-10 sm:inset-x-auto sm:bottom-4 sm:left-1/2 sm:w-[min(36rem,calc(100%-2rem))] sm:-translate-x-1/2">
      <div className="rounded-xl bg-white/95 p-3 shadow-lg ring-1 ring-slate-900/10 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlaying(!isPlaying)}
            disabled={!ready || !visible}
            aria-label={isPlaying ? "Pause forecast animation" : "Play forecast animation"}
            className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-900 text-white transition-colors hover:bg-slate-700 disabled:opacity-40"
          >
            {isPlaying ? <Pause className="size-3.5 fill-current" /> : <Play className="ml-0.5 size-3.5 fill-current" />}
          </button>

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-900 tabular-nums">
                +{shownHour}h <span className="font-normal text-slate-600">&middot; {formatDateTime(startMs + shownHour * HOUR_MS)}</span>
              </span>
              <StatusChip loading={isFetching && !ready} error={isError && !ready} onRetry={() => void refetch()} />
            </div>
            <input
              type="range"
              min={0}
              max={maxHour}
              step={1}
              value={shownHour}
              disabled={!ready}
              onChange={(event) => {
                setHour(Number(event.target.value));
                setPlaying(false);
              }}
              aria-label="Forecast hour"
              aria-valuetext={`+${shownHour} hours, ${formatDateTime(startMs + shownHour * HOUR_MS)}`}
              className="range-slider disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setVisible((v) => !v);
            }}
            aria-pressed={visible}
            title={visible ? "Hide weather heatmap" : "Show weather heatmap"}
            aria-label={visible ? "Hide weather heatmap" : "Show weather heatmap"}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-900"
          >
            {visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </button>
        </div>

        <div className={`mt-2.5 flex items-center gap-3 ${visible ? "" : "opacity-50"}`}>
          <div className="w-56 shrink-0">
            <SegmentedControl ariaLabel="Heatmap metric" size="sm" value={metric} options={METRIC_OPTIONS} onChange={setMetric} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="h-2 rounded-full ring-1 ring-slate-900/5" style={{ background: heatmapLegendGradient(metric) }} />
            <div className="mt-0.5 flex justify-between text-[10px] text-slate-500">
              <span>{config.legend[0]}</span>
              <span>{config.legend[1]}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusChip({ loading, error, onRetry }: { loading: boolean; error: boolean; onRetry: () => void }) {
  if (loading) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
        <Loader2 className="size-3 animate-spin" />
        Loading forecast grid...
      </span>
    );
  }
  if (error) {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] text-red-700 hover:bg-red-100"
      >
        <AlertCircle className="size-3" />
        Forecast grid failed. Retry
      </button>
    );
  }
  return null;
}
