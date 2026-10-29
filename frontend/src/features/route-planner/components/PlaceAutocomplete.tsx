import { Loader2, MapPin } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { inputClassName } from "@/lib/field-styles";

import { GEOCODE_MIN_CHARS, useGeocode } from "../queries";
import type { Place } from "../types";

interface PlaceAutocompleteProps {
  label: string;
  placeholder: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
  error?: string;
  /** marker style next to the label, matching the map marker */
  variant: "origin" | "destination";
}

/**
 * Combobox for picking a geocoded place. Typing clears the current selection,
 * so a plan can only be submitted with coordinates the backend returned.
 */
export function PlaceAutocomplete({ label, placeholder, value, onChange, error, variant }: PlaceAutocompleteProps) {
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
      // enter with nothing highlighted takes the top suggestion
      const place = results[activeIndex] ?? results[0];
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
      <label htmlFor={id} className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
        <span
          className={`size-2.5 rounded-full ${variant === "origin" ? "border-2 border-accent" : "bg-accent"}`}
          aria-hidden="true"
        />
        {label}
      </label>
      <div className="relative">
        <MapPin className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle" />
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
          className={`py-2 pr-8 pl-8 ${inputClassName(Boolean(error))}`}
        />
        {isFetching && searchEnabled && (
          <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-accent" />
        )}
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg bg-surface py-1 text-sm shadow-panel ring-1 ring-line dark:bg-raised"
        >
          {isError && <li className="px-3 py-2 text-danger">Place search failed. Try again.</li>}
          {!isError && results.length === 0 && <li className="px-3 py-2 text-muted">No places found.</li>}
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
              className={`cursor-pointer px-3 py-2 ${index === activeIndex ? "bg-accent-soft text-accent" : "text-fg"}`}
            >
              {place.label}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
