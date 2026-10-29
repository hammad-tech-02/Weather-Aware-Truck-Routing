import { CloudSun, Route, SlidersHorizontal } from "lucide-react";

const STEPS = [
  { icon: Route, text: "Enter origin, destination, departure time and load. We fetch up to three truck routes." },
  { icon: CloudSun, text: "Each route is sampled at checkpoints and scored against the hourly forecast at your ETA." },
  { icon: SlidersHorizontal, text: "Scrub the 0-48 h slider to watch wind, rain and snow move across the corridor." },
];

export function MapEmptyState() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center p-4">
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl bg-white/95 p-5 shadow-xl ring-1 ring-slate-900/10 backdrop-blur">
        <h2 className="text-base font-semibold text-slate-900">Plan a weather-aware trip</h2>
        <p className="mt-1 text-sm text-slate-500">Routes, checkpoint risk and a forecast heatmap will appear here.</p>
        <ol className="mt-4 space-y-3">
          {STEPS.map(({ icon: Icon, text }, i) => (
            <li key={i} className="flex gap-3 text-sm text-slate-600">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-sky-50 text-sky-700">
                <Icon className="size-4" />
              </span>
              <span className="pt-0.5">{text}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
