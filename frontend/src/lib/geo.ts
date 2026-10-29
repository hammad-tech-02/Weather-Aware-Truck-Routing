/** Small geometry helpers; route lines are short enough that haversine is plenty. */
import type { LngLatBoundsLike } from "maplibre-gl";

type Position = [number, number];

const EARTH_RADIUS_MI = 3958.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in miles between two `[lon, lat]` positions. */
export function haversineMiles(a: Position, b: Position): number {
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(h));
}

/** Cumulative distance (miles) at every vertex of a `[lon, lat]` line. */
export function cumulativeMiles(line: Position[]): number[] {
  const result = new Array<number>(line.length);
  let total = 0;
  for (let i = 0; i < line.length; i++) {
    if (i > 0) total += haversineMiles(line[i - 1]!, line[i]!);
    result[i] = total;
  }
  return result;
}

/**
 * Splits a line into consecutive pieces at the given ascending distances.
 * Walks the line once, so slicing a long route into many pieces stays linear.
 */
export function splitLineAt(line: Position[], cumulative: number[], breaks: number[]): Position[][] {
  const pieces: Position[][] = [];
  let current: Position[] = line.length > 0 ? [line[0]!] : [];
  let vertex = 1;

  for (const target of breaks) {
    while (vertex < line.length && cumulative[vertex]! <= target) {
      current.push(line[vertex]!);
      vertex++;
    }
    if (vertex >= line.length) break;
    const start = cumulative[vertex - 1]!;
    const span = cumulative[vertex]! - start;
    const t = span > 0 ? (target - start) / span : 0;
    const a = line[vertex - 1]!;
    const b = line[vertex]!;
    const cut: Position = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    current.push(cut);
    pieces.push(current);
    current = [cut];
  }

  while (vertex < line.length) current.push(line[vertex++]!);
  pieces.push(current);
  return pieces;
}

/** Bounds covering every `[lon, lat]` position, or undefined for no input. */
export function boundsOf(positions: Iterable<Position>): LngLatBoundsLike | undefined {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of positions) {
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  }
  if (!Number.isFinite(minLon)) return undefined;
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ];
}
