"""Weather grid along the trip corridor for the 0–48 h forecast slider.

The corridor is every grid cell within CORRIDOR_BUFFER_MI of any route. The
grid coarsens until it fits MAX_POINTS so long trips stay within the weather
provider's limits; the heatmap blur makes the coarser spacing invisible.
"""

import math
from datetime import datetime, timedelta

from routing.services.geo import LatLon, haversine_m, sample_every
from routing.services.risk import Weather, assess
from routing.services.weather import get_forecasts, snap

CORRIDOR_BUFFER_MI = 30
MAX_POINTS = 250
MIN_SPACING_DEG = 0.1
HEATMAP_HOURS = 49  # 0..48 inclusive


def _cells(routes, spacing: float, buffer_m: float) -> set[tuple[int, int]]:
    reach = math.ceil(buffer_m / 111_000 / spacing) + 1
    cells: set[tuple[int, int]] = set()
    for route in routes:
        for lat, lon in sample_every(route.points, route.cumulative_m, spacing * 111_000 / 2):
            ci, cj = round(lat / spacing), round(lon / spacing)
            for di in range(-reach, reach + 1):
                for dj in range(-reach, reach + 1):
                    cell = (ci + di, cj + dj)
                    if haversine_m((lat, lon), (cell[0] * spacing, cell[1] * spacing)) <= buffer_m:
                        cells.add(cell)
    return cells


def corridor_points(routes) -> dict:
    buffer_m = CORRIDOR_BUFFER_MI * 1609.344
    spacing = MIN_SPACING_DEG
    cells = _cells(routes, spacing, buffer_m)
    while len(cells) > MAX_POINTS:
        spacing *= 1.25
        cells = _cells(routes, spacing, buffer_m)

    points = sorted((round(i * spacing, 3), round(j * spacing, 3)) for i, j in cells)
    lats = [lat for route in routes for lat, _ in route.points]
    lons = [lon for route in routes for _, lon in route.points]
    pad = buffer_m / 111_000
    return {
        "bbox": [
            round(min(lons) - pad, 3),
            round(min(lats) - pad, 3),
            round(max(lons) + pad, 3),
            round(max(lats) + pad, 3),
        ],
        "spacing_deg": round(spacing, 3),
        "points": [list(p) for p in points],
    }


def build_heatmap(points: list[LatLon], start: datetime, load_lbs: float) -> dict:
    start = start.replace(minute=0, second=0, microsecond=0)
    hours = [start + timedelta(hours=h) for h in range(HEATMAP_HOURS)]
    forecasts = get_forecasts(points, hours[0], hours[-1])

    out = []
    for lat, lon in points:
        series = forecasts.get(snap((lat, lon)))
        if series is None:
            continue
        risk, wind, precip, snow = [], [], [], []
        for moment in hours:
            i = series.index_at(moment)
            if i is None:
                w = r = s = 0.0
            else:
                w, r, s = series.wind_mph[i], series.rain_in[i], series.snow_in[i]
            risk.append(int(assess(Weather(wind_mph=w, rain_in_hr=r, snow_in_hr=s), load_lbs).level))
            wind.append(round(w, 1))
            precip.append(round(r, 3))
            snow.append(round(s, 3))
        out.append({"lat": lat, "lon": lon, "risk": risk, "wind": wind, "precip": precip, "snow": snow})

    return {"start_time": start.isoformat().replace("+00:00", "Z"), "hours": HEATMAP_HOURS, "points": out}
