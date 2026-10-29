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
  heatmapLegendGradient,
  type HeatmapMetric,
} from "../heatmap";
import type { PlannerMap } from "../map-controller";
import { useHeatmap } from "../queries";
import type { PlanResponse } from "../types";

const PLAY_STEP_MS = 400;
const DEFAULT_HOURS = 49;

const METRIC_OPTIONS = HEATMAP_METRICS.map((metric) => ({ value: metric.id, label: metric.label }));

interface HeatmapPanelProps {
  controller: PlannerMap;
  plan: PlanResponse;
}

/**
 * Forecast slider and heatmap controls. Hour, metric and visibility live
 * here, not in the planner, so scrubbing re-renders only this panel; the
 * controller turns each change into a paint-property update (no data upload)
 * and remembers it for basemap switches.
 */
export function HeatmapPanel({ controller, plan }: HeatmapPanelProps) {
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
    controller.setHeatmapData(collection, spacingPx);
  }, [controller, collection, spacingPx]);

  // per-frame path while scrubbing or playing
  useEffect(() => {
    controller.setHeatmapView({ metric, hour: shownHour, visible });
  }, [controller, metric, shownHour, visible]);

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

  const timeLabel = formatDateTime(startMs + shownHour * HOUR_MS);

  return (
    // side margins keep the bottom-right attribution button uncovered at every width
    <div className="absolute bottom-2 left-2 right-10 z-10 sm:right-auto sm:bottom-4 sm:left-1/2 sm:w-[min(36rem,calc(100%-6rem))] sm:-translate-x-1/2">
      <div className="rounded-2xl bg-overlay p-3 shadow-panel ring-1 ring-line backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setPlaying(!isPlaying)}
            disabled={!ready || !visible}
            aria-label={isPlaying ? "Pause forecast animation" : "Play forecast animation"}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-fg shadow-sm transition-colors hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40"
          >
            {isPlaying ? <Pause className="size-3.5 fill-current" /> : <Play className="ml-0.5 size-3.5 fill-current" />}
          </button>

          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate font-semibold text-fg tabular-nums">
                <span className="text-accent">+{shownHour}h</span>
                <span className="font-normal text-muted"> &middot; {timeLabel}</span>
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
              aria-valuetext={`+${shownHour} hours, ${timeLabel}`}
              className="range-slider disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            title={visible ? "Hide weather heatmap" : "Show weather heatmap"}
            aria-label={visible ? "Hide weather heatmap" : "Show weather heatmap"}
            className={`grid size-9 shrink-0 place-items-center rounded-lg ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
              visible ? "text-accent ring-accent-line hover:bg-accent-soft" : "text-muted ring-line hover:bg-sunken hover:text-fg"
            }`}
          >
            {visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </button>
        </div>

        <div className={`mt-3 flex items-center gap-3 transition-opacity ${visible ? "" : "opacity-50"}`}>
          <div className="w-56 shrink-0">
            <SegmentedControl ariaLabel="Heatmap metric" size="sm" value={metric} options={METRIC_OPTIONS} onChange={setMetric} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="h-2 rounded-full ring-1 ring-line" style={{ background: heatmapLegendGradient(metric) }} />
            <div className="mt-1 flex justify-between text-[10px] text-muted">
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
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sunken px-2 py-0.5 text-[10px] text-muted ring-1 ring-line">
        <Loader2 className="size-3 animate-spin text-accent" />
        Loading forecast grid...
      </span>
    );
  }
  if (error) {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-[10px] text-danger ring-1 ring-danger-line hover:opacity-80"
      >
        <AlertCircle className="size-3" />
        Forecast grid failed. Retry
      </button>
    );
  }
  return null;
}
