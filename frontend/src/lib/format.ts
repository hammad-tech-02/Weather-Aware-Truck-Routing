/**
 * Display formatting. All times render in the browser's local timezone with
 * its abbreviation, since drivers reason in local wall-clock time.
 */

const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

const dayTimeFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDateTime(value: string | number | Date): string {
  return dateTimeFormat.format(new Date(value));
}

export function formatTime(value: string | number | Date): string {
  return timeFormat.format(new Date(value));
}

/** Compact "Thu 2:00 PM" form for dense lists where the zone is shown once elsewhere. */
export function formatDayTime(value: string | number | Date): string {
  return dayTimeFormat.format(new Date(value));
}

/** Abbreviation of the browser's timezone, e.g. "CDT". */
export function localTimeZoneName(): string {
  const part = timeFormat.formatToParts(new Date()).find((p) => p.type === "timeZoneName");
  return part?.value ?? "";
}

export function formatMiles(miles: number): string {
  return `${miles.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`;
}

/** 17.6 -> "17h 36m". */
export function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatNumber(value: number, digits = 1): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatPounds(lbs: number): string {
  return `${lbs.toLocaleString()} lbs`;
}
