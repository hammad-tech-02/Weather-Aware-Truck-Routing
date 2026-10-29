/**
 * HTML for MapLibre popups. Popups live outside the React tree, so they are
 * plain strings; every API-provided value goes through `escapeHtml`.
 */
import { formatDateTime, formatMiles, formatNumber } from "@/lib/format";
import { escapeHtml } from "@/lib/html";
import { riskColor, riskLabel, riskTextColor } from "@/lib/risk-levels";

import type { Checkpoint, HosStop } from "./types";

function row(label: string, value: string): string {
  return `<div class="flex justify-between gap-4"><span class="text-muted">${label}</span><span class="font-medium text-fg tabular-nums">${value}</span></div>`;
}

export function checkpointPopupHtml(cp: Checkpoint, routeName: string): string {
  const badge = `<span class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style="background:${riskColor(cp.level)};color:${riskTextColor(cp.level)}">${riskLabel(cp.level)}</span>`;
  const weather = cp.weather
    ? [
        row("Wind", `${formatNumber(cp.weather.wind_mph, 0)} mph, gusts ${formatNumber(cp.weather.gust_mph, 0)}`),
        row("Rain", `${formatNumber(cp.weather.rain_in_hr, 2)} in/hr`),
        row("Snow", `${formatNumber(cp.weather.snow_in_hr, 2)} in/hr`),
        row("Temp", `${formatNumber(cp.weather.temperature_f, 0)}&deg;F`),
      ].join("")
    : `<div class="text-muted">Forecast unavailable for this time.</div>`;
  const reasons = cp.reasons.length
    ? `<ul class="mt-2 list-disc space-y-0.5 border-t border-line pt-2 pl-4 text-muted">${cp.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`
    : "";

  return `<div class="w-60 text-xs">
    <div class="mb-1 flex items-center justify-between gap-2">
      <span class="font-semibold text-fg">${escapeHtml(routeName)} &middot; mile ${formatNumber(cp.mile)}</span>
      ${badge}
    </div>
    <div class="mb-2 text-muted">ETA ${formatDateTime(cp.eta)}</div>
    <div class="space-y-0.5">${weather}</div>
    ${reasons}
  </div>`;
}

export function stopPopupHtml(stop: HosStop): string {
  const title = stop.type === "rest" ? "10-hour rest (HOS)" : "30-minute break (HOS)";
  return `<div class="w-56 text-xs">
    <div class="mb-1 font-semibold text-fg">${title}</div>
    <div class="space-y-0.5">
      ${row("At", formatMiles(stop.mile))}
      ${row("From", formatDateTime(stop.start))}
      ${row("Until", formatDateTime(stop.end))}
    </div>
  </div>`;
}
