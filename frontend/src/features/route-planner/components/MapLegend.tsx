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
    <div className="absolute top-3 left-3 z-10 rounded-lg bg-white/95 text-[11px] shadow-md ring-1 ring-slate-900/10 backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-2.5 py-1.5 font-semibold text-slate-700"
      >
        Risk level
        <ChevronDown className={`size-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-2.5 pb-2">
          <ul className="space-y-0.5">
            {ITEMS.map((item) => (
              <li key={item.label} className="flex items-center gap-1.5 text-slate-600">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.label}
              </li>
            ))}
          </ul>
          <div className="mt-1.5 flex gap-3 border-t border-slate-100 pt-1.5 text-slate-600">
            <span className="flex items-center gap-1">
              <span className="grid size-3.5 place-items-center rounded-full bg-slate-500 text-[8px] font-bold text-white">B</span>
              Break
            </span>
            <span className="flex items-center gap-1">
              <span className="grid size-3.5 place-items-center rounded-full bg-slate-800 text-[8px] font-bold text-white">R</span>
              Rest
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
