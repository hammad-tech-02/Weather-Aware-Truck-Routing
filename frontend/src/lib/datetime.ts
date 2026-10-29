/** Helpers for the `datetime-local` input, which works in local wall-clock time without an offset. */

const pad = (value: number) => String(value).padStart(2, "0");

/** `YYYY-MM-DDTHH:mm` for a `datetime-local` value. */
export function toDateTimeLocalValue(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Start of the next full local hour. */
export function nextFullHour(now = new Date()): Date {
  const date = new Date(now);
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 1);
  return date;
}

/** ISO 8601 with the local UTC offset, e.g. `2026-10-30T08:00:00-05:00`, as the API expects. */
export function toIsoWithOffset(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/** Parses a `datetime-local` value as local time; returns undefined for empty/invalid input. */
export function parseDateTimeLocal(value: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export const HOUR_MS = 3_600_000;

/** Truncates to the start of the (UTC-aligned) hour; forecast data is hourly. */
export function floorToHour(time: number): number {
  return Math.floor(time / HOUR_MS) * HOUR_MS;
}
