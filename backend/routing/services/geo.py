"""Small geometry helpers. Coordinates are (lat, lon) tuples unless stated otherwise."""

import math
from bisect import bisect_left
from collections.abc import Sequence

EARTH_RADIUS_M = 6_371_000
METERS_PER_MILE = 1609.344

LatLon = tuple[float, float]


def haversine_m(a: LatLon, b: LatLon) -> float:
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(h))


def interpolate(points: Sequence[LatLon], cumulative: Sequence[float], target: float) -> tuple[LatLon, int, float]:
    """Point at `target` along a polyline whose running totals are `cumulative`.

    Returns the point, the index of the segment start and the fraction into that
    segment, so callers can interpolate any other per-vertex series the same way.
    """
    if target <= cumulative[0]:
        return points[0], 0, 0.0
    if target >= cumulative[-1]:
        return points[-1], len(points) - 2, 1.0
    i = bisect_left(cumulative, target) - 1
    span = cumulative[i + 1] - cumulative[i]
    t = 0.0 if span == 0 else (target - cumulative[i]) / span
    (lat1, lon1), (lat2, lon2) = points[i], points[i + 1]
    return (lat1 + (lat2 - lat1) * t, lon1 + (lon2 - lon1) * t), i, t


def offset_midpoint(a: LatLon, b: LatLon, fraction: float) -> LatLon:
    """Midpoint of a→b pushed sideways by `fraction` of the a→b distance (sign picks the side)."""
    mid_lat = (a[0] + b[0]) / 2
    km_per_deg_lon = 111.32 * math.cos(math.radians(mid_lat))
    dx = (b[1] - a[1]) * km_per_deg_lon
    dy = (b[0] - a[0]) * 110.57
    length = math.hypot(dx, dy) or 1.0
    offset_km = length * fraction
    # perpendicular to the a→b direction
    px, py = -dy / length, dx / length
    return mid_lat + py * offset_km / 110.57, (a[1] + b[1]) / 2 + px * offset_km / km_per_deg_lon


def simplify(points: Sequence[LatLon], tolerance_deg: float) -> list[LatLon]:
    """Iterative Douglas–Peucker; keeps payloads small without visibly changing the line."""
    if len(points) < 3:
        return list(points)
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        start, end = stack.pop()
        (y1, x1), (y2, x2) = points[start], points[end]
        dx, dy = x2 - x1, y2 - y1
        norm = math.hypot(dx, dy)
        max_dist, index = 0.0, start
        for i in range(start + 1, end):
            y, x = points[i]
            dist = math.hypot(x - x1, y - y1) if norm == 0 else abs(dy * x - dx * y + x2 * y1 - y2 * x1) / norm
            if dist > max_dist:
                max_dist, index = dist, i
        if max_dist > tolerance_deg:
            keep[index] = True
            stack.extend(((start, index), (index, end)))
    return [p for p, k in zip(points, keep, strict=True) if k]


def sample_every(points: Sequence[LatLon], cumulative: Sequence[float], step: float) -> list[LatLon]:
    total = cumulative[-1]
    count = max(1, int(total // step))
    return [interpolate(points, cumulative, i * step)[0] for i in range(count + 1)] + [points[-1]]
