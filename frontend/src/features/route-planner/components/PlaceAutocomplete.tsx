import { Loader2, MapPin } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";

import { GEOCODE_MIN_CHARS, useGeocode } from "../queries";
import type { Place } from "../types";

interface PlaceAutocompleteProps {
  label: string;
  placeholder: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
  error?: string;
  /** dot color next to the label, matching the map marker */
  accent: string;
}

/**
 * Combobox for picking a geocoded place. Typing clears the current selection,
 * so a plan can only be submitted with coordinates the backend returned.
 */
export function PlaceAutocomplete({ label, placeholder, value, onChange, error, accent }: PlaceAutocompleteProps) {
  const id = useId();
  const listId = `${id}-list`;
  const [text, setText] = useState(value?.label ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // keep the input in sync when the parent changes the value (e.g. swap); adjusting state during render avoids an extra effect pass
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (value) setText(value.label);
  }

  const debounced = useDebouncedValue(text, 300);
  const searchEnabled = open && value === null && debounced.trim().length >= GEOCODE_MIN_CHARS;
  const { data, isFetching, isError } = useGeocode(searchEnabled ? debounced : "");
  const results = searchEnabled ? (data?.results ?? []) : [];
  const showList = searchEnabled && (results.length > 0 || (!isFetching && data !== undefined) || isError);

  const select = (place: Place) => {
    onChange(place);
    setText(place.label);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!results.length) return;
      event.preventDefault();
      setOpen(true);
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((i) => (i + delta + results.length) % results.length);
    } else if (event.key === "Enter") {
      const place = results[activeIndex] ?? (results.length === 1 ? results[0] : undefined);
      if (showList && place) {
        event.preventDefault();
        select(place);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600">
        <span className="size-2 rounded-full" style={{ backgroundColor: accent }} />
        {label}
      </label>
      <div className="relative">
        <MapPin className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
        <input
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={error ? true : undefined}
          aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          placeholder={placeholder}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
            if (value) onChange(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
          className={`w-full rounded-lg border bg-white py-2 pr-8 pl-8 text-sm shadow-xs transition outline-none placeholder:text-slate-400 focus:ring-2 ${
            error
              ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
              : "border-slate-300 focus:border-sky-500 focus:ring-sky-500/20"
          }`}
        />
        {isFetching && searchEnabled && (
          <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-slate-400" />
        )}
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg"
        >
          {isError && <li className="px-3 py-2 text-red-600">Place search failed. Try again.</li>}
          {!isError && results.length === 0 && <li className="px-3 py-2 text-slate-500">No places found.</li>}
          {results.map((place, index) => (
            <li
              key={`${place.label}-${place.lat}-${place.lon}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              // mousedown fires before the input blur closes the list
              onMouseDown={(event) => {
                event.preventDefault();
                select(place);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={`cursor-pointer px-3 py-2 ${index === activeIndex ? "bg-sky-50 text-sky-900" : "text-slate-700"}`}
            >
              {place.label}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
