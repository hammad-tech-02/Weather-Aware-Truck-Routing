import { Bed, Coffee, CloudRain, Snowflake, Wind } from "lucide-react";
import { memo, useEffect, useMemo, useRef } from "react";

import { RiskBadge } from "@/components/RiskBadge";
import { formatDateTime, formatDayTime, formatHours, formatNumber, localTimeZoneName } from "@/lib/format";
import { riskColor } from "@/lib/risk-levels";

import type { Checkpoint, HosStop, RouteOption } from "../types";

type TimelineItem = { kind: "checkpoint"; mile: number; checkpoint: Checkpoint } | { kind: "stop"; mile: number; stop: HosStop };

interface CheckpointTimelineProps {
  route: RouteOption;
  activeCheckpoint: number | undefined;
  onSelectCheckpoint: (index: number) => void;
}

/** Checkpoints of the selected route in mile order, with HOS stops interleaved where they happen. */
export const CheckpointTimeline = memo(function CheckpointTimeline({
  route,
  activeCheckpoint,
  onSelectCheckpoint,
}: CheckpointTimelineProps) {
  const items = useMemo<TimelineItem[]>(() => {
    const merged: TimelineItem[] = [
      ...route.checkpoints.map((checkpoint) => ({ kind: "checkpoint" as const, mile: checkpoint.mile, checkpoint })),
      ...route.stops.map((stop) => ({ kind: "stop" as const, mile: stop.mile, stop })),
    ];
    // stable sort keeps a checkpoint ahead of a stop at the same mile
    return merged.sort((a, b) => a.mile - b.mile);
  }, [route]);

  // a checkpoint clicked on the map should become visible in the list too
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (activeCheckpoint === undefined) return;
    listRef.current
      ?.querySelector(`[data-checkpoint="${activeCheckpoint}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeCheckpoint]);

  return (
    <section aria-label={`Checkpoints for ${route.name}`}>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-900">
          {route.name} checkpoints <span className="font-normal text-slate-400">({route.checkpoints.length})</span>
        </h2>
        <span className="text-xs text-slate-400">times in {localTimeZoneName()}</span>
      </div>

      <ol ref={listRef} className="relative space-y-1 before:absolute before:top-2 before:bottom-2 before:left-[0.6875rem] before:w-px before:bg-slate-200">
        {items.map((item) =>
          item.kind === "stop" ? (
            <StopRow key={`stop-${item.stop.start}`} stop={item.stop} />
          ) : (
            <CheckpointRow
              key={`cp-${item.checkpoint.index}`}
              checkpoint={item.checkpoint}
              active={item.checkpoint.index === activeCheckpoint}
              onSelect={onSelectCheckpoint}
            />
          ),
        )}
      </ol>
    </section>
  );
});

interface CheckpointRowProps {
  checkpoint: Checkpoint;
  active: boolean;
  onSelect: (index: number) => void;
}

const CheckpointRow = memo(function CheckpointRow({ checkpoint, active, onSelect }: CheckpointRowProps) {
  const { weather } = checkpoint;
  return (
    <li className="relative" data-checkpoint={checkpoint.index}>
      <button
        type="button"
        onClick={() => onSelect(checkpoint.index)}
        aria-current={active ? "true" : undefined}
        className={`flex w-full gap-2.5 rounded-lg py-1.5 pr-2 pl-0.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-sky-500 ${
          active ? "bg-sky-50 ring-1 ring-sky-200" : "hover:bg-slate-100"
        }`}
      >
        <span
          className="relative z-10 mt-1 size-4 shrink-0 rounded-full border-2 border-white shadow-sm ring-1 ring-slate-300"
          style={{ backgroundColor: riskColor(checkpoint.level) }}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-900 tabular-nums">
              Mile {formatNumber(checkpoint.mile)}
              <span className="font-normal text-slate-500"> &middot; {formatDayTime(checkpoint.eta)}</span>
            </span>
            <RiskBadge level={checkpoint.level} size="sm" />
          </span>
          {weather ? (
            <span className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-slate-500 tabular-nums">
              <span className="inline-flex items-center gap-0.5" title="Wind / gusts">
                <Wind className="size-3" />
                {formatNumber(weather.wind_mph, 0)}/{formatNumber(weather.gust_mph, 0)} mph
              </span>
              <span className="inline-flex items-center gap-0.5" title="Rain">
                <CloudRain className="size-3" />
                {formatNumber(weather.rain_in_hr, 2)} in/hr
              </span>
              <span className="inline-flex items-center gap-0.5" title="Snow">
                <Snowflake className="size-3" />
                {formatNumber(weather.snow_in_hr, 2)} in/hr
              </span>
            </span>
          ) : (
            <span className="mt-0.5 block text-[11px] text-slate-400">Forecast unavailable</span>
          )}
          {checkpoint.reasons.length > 0 && (
            <span className="mt-0.5 block text-[11px] leading-snug text-slate-600">{checkpoint.reasons.join("; ")}</span>
          )}
        </span>
      </button>
    </li>
  );
});

function StopRow({ stop }: { stop: HosStop }) {
  const isRest = stop.type === "rest";
  const Icon = isRest ? Bed : Coffee;
  const hours = (Date.parse(stop.end) - Date.parse(stop.start)) / 3_600_000;
  return (
    <li className="flex gap-2.5 py-1 pl-0.5 text-[11px] text-slate-600">
      <span className="relative z-10 grid size-4 shrink-0 place-items-center rounded-full bg-slate-700 text-white">
        <Icon className="size-2.5" />
      </span>
      <span>
        <span className="font-medium text-slate-800">{isRest ? "Rest" : "Break"}</span> {formatHours(hours)} at mile{" "}
        {formatNumber(stop.mile)} &middot; {formatDateTime(stop.start)}
      </span>
    </li>
  );
}
