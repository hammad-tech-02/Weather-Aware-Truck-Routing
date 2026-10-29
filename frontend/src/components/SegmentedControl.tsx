import type { KeyboardEvent } from "react";

interface SegmentedControlProps<T extends string | number> {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: "sm" | "md";
}

/** Radio-group style toggle; arrow keys move between options like native radios. */
export function SegmentedControl<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  size = "md",
}: SegmentedControlProps<T>) {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const current = options.findIndex((o) => o.value === value);
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = options[(current + delta + options.length) % options.length];
    if (next) onChange(next.value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className="inline-flex w-full rounded-lg bg-slate-100 p-0.5 ring-1 ring-slate-200"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-sky-500 ${
              size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
            } ${selected ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
