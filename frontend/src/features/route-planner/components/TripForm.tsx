import { ArrowUpDown, Loader2, Route } from "lucide-react";
import { useState, type FormEvent } from "react";

import { SegmentedControl } from "@/components/SegmentedControl";
import { fieldLabelClassName, inputClassName } from "@/lib/field-styles";
import { nextFullHour, parseDateTimeLocal, toDateTimeLocalValue, toIsoWithOffset } from "@/lib/datetime";
import { localTimeZoneName } from "@/lib/format";

import type { CheckpointInterval, Place, PlanRequest } from "../types";

import { PlaceAutocomplete } from "./PlaceAutocomplete";

const MAX_LOAD_LBS = 80_000;
const LOAD_PRESETS = [20_000, 40_000, 60_000, 80_000];
const INTERVAL_OPTIONS = [
  { value: 10, label: "10 mi" },
  { value: 25, label: "25 mi" },
  { value: 50, label: "50 mi" },
] as const satisfies readonly { value: CheckpointInterval; label: string }[];

interface FormErrors {
  origin?: string;
  destination?: string;
  departure?: string;
  load?: string;
}

interface TripFormProps {
  isPending: boolean;
  onSubmit: (request: PlanRequest) => void;
}

/** Mirrors the backend's validation so most mistakes are caught before a round trip. */
function validate(origin: Place | null, destination: Place | null, departure: string, load: string): FormErrors {
  const errors: FormErrors = {};
  if (!origin) errors.origin = "Choose an origin from the suggestions.";
  if (!destination) errors.destination = "Choose a destination from the suggestions.";
  if (origin && destination && origin.lat === destination.lat && origin.lon === destination.lon) {
    errors.destination = "Destination must differ from the origin.";
  }

  const date = parseDateTimeLocal(departure);
  const now = Date.now();
  if (!date) errors.departure = "Enter a departure date and time.";
  else if (date.getTime() < now - 3_600_000) errors.departure = "Departure cannot be more than 1 hour in the past.";
  else if (date.getTime() > now + 7 * 24 * 3_600_000) errors.departure = "Departure must be within the next 7 days.";

  const lbs = Number(load);
  if (load.trim() === "" || !Number.isFinite(lbs)) errors.load = "Enter the load weight in pounds.";
  else if (lbs < 0 || lbs > MAX_LOAD_LBS) errors.load = "Load must be between 0 and 80,000 lbs.";

  return errors;
}

export function TripForm({ isPending, onSubmit }: TripFormProps) {
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [departure, setDeparture] = useState(() => toDateTimeLocalValue(nextFullHour()));
  const [load, setLoad] = useState("40000");
  const [checkpointInterval, setCheckpointInterval] = useState<CheckpointInterval>(25);
  const [submitted, setSubmitted] = useState(false);

  // only nag after the first submit attempt, then keep errors live as fields are fixed
  const errors = submitted ? validate(origin, destination, departure, load) : {};
  const [timeZone] = useState(localTimeZoneName);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    const current = validate(origin, destination, departure, load);
    if (Object.keys(current).length > 0 || !origin || !destination) return;
    onSubmit({
      origin,
      destination,
      departure_time: toIsoWithOffset(parseDateTimeLocal(departure)!),
      load_lbs: Math.round(Number(load)),
      checkpoint_interval_mi: checkpointInterval,
    });
  };

  const swap = () => {
    setOrigin(destination);
    setDestination(origin);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="relative space-y-3">
        <PlaceAutocomplete
          label="Origin"
          placeholder="City, address or place"
          value={origin}
          onChange={setOrigin}
          error={errors.origin}
          variant="origin"
        />
        <PlaceAutocomplete
          label="Destination"
          placeholder="City, address or place"
          value={destination}
          onChange={setDestination}
          error={errors.destination}
          variant="destination"
        />
        <button
          type="button"
          onClick={swap}
          disabled={!origin && !destination}
          title="Swap origin and destination"
          aria-label="Swap origin and destination"
          className="absolute -top-0.5 right-0 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted transition-colors hover:bg-sunken hover:text-accent disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ArrowUpDown className="size-3" />
          Swap
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <div>
          <label htmlFor="departure" className={fieldLabelClassName}>
            Departure <span className="font-normal text-subtle">({timeZone})</span>
          </label>
          <input
            id="departure"
            type="datetime-local"
            value={departure}
            onChange={(event) => setDeparture(event.target.value)}
            aria-invalid={errors.departure ? true : undefined}
            className={`px-2.5 py-2 ${inputClassName(Boolean(errors.departure))}`}
          />
          {errors.departure && <p className="mt-1 text-xs text-danger">{errors.departure}</p>}
        </div>

        <div>
          <label htmlFor="load" className={fieldLabelClassName}>
            Load weight
          </label>
          <div className="relative">
            <input
              id="load"
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_LOAD_LBS}
              step={500}
              value={load}
              onChange={(event) => setLoad(event.target.value)}
              aria-invalid={errors.load ? true : undefined}
              className={`py-2 pr-10 pl-2.5 tabular-nums ${inputClassName(Boolean(errors.load))}`}
            />
            <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-subtle">
              lbs
            </span>
          </div>
          {errors.load && <p className="mt-1 text-xs text-danger">{errors.load}</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5" aria-label="Load presets">
        {LOAD_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setLoad(String(preset))}
            className={`rounded-full border px-2.5 py-0.5 text-xs tabular-nums transition-colors ${
              Number(load) === preset
                ? "border-accent-line bg-accent-soft text-accent"
                : "border-line text-muted hover:border-line-strong hover:text-fg"
            }`}
          >
            {preset / 1000}k lbs
          </button>
        ))}
      </div>

      <div>
        <span className={fieldLabelClassName}>Checkpoint every</span>
        <SegmentedControl
          ariaLabel="Checkpoint interval"
          value={checkpointInterval}
          options={INTERVAL_OPTIONS}
          onChange={setCheckpointInterval}
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg shadow-sm transition-colors hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70"
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Route className="size-4" />}
        {isPending ? "Planning routes..." : "Plan routes"}
      </button>
    </form>
  );
}
