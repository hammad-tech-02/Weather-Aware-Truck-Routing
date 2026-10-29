import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { RISK_LEVELS, UNKNOWN_RISK_COLOR, UNKNOWN_RISK_LABEL } from "@/lib/risk-levels";

const ITEMS = [
  ...RISK_LEVELS.map((info) => ({ label: info.label, color: info.color })),
  { label: UNKNOWN_RISK_LABEL, color: UNKNOWN_RISK_COLOR },
];

/** Collapsed by default on small screens, where the map area is short and popups need the room. */
export function MapLegend() {
  const [open, setOpen] = useState(() => window.matchMedia("(min-width: 640px)").matches);

  return (
    <div className="absolute top-3 left-3 z-10 min-w-32 rounded-xl bg-overlay text-[11px] shadow-panel ring-1 ring-line backdrop-blur-md">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-1.5 font-semibold text-fg focus-visible:outline-2 focus-visible:outline-accent"
      >
        Risk level
        <ChevronDown className={`size-3.5 text-subtle transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-2.5 pb-2">
          <ul className="space-y-1">
            {ITEMS.map((item) => (
              <li key={item.label} className="flex items-center gap-2 text-muted">
                <span className="size-2.5 rounded-full ring-1 ring-black/10" style={{ backgroundColor: item.color }} />
                {item.label}
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-3 border-t border-line pt-2 text-muted">
            <span className="flex items-center gap-1">
              <span className="grid size-3.5 place-items-center rounded-full bg-fg text-[8px] font-bold text-canvas">B</span>
              Break
            </span>
            <span className="flex items-center gap-1">
              <span className="grid size-3.5 place-items-center rounded-full bg-fg text-[8px] font-bold text-canvas">R</span>
              Rest
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
