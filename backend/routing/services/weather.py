"""Hourly forecasts from Open-Meteo, batched and cached.

Points are snapped to a 0.1° grid (~7 mi, close to the forecast model's own
resolution) so the three routes share lookups where they overlap and repeated
plans hit the cache. Requests are aligned to whole UTC days for the same reason.
"""

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import UTC, date, datetime

from django.conf import settings
from django.core.cache import cache

from routing.exceptions import UpstreamError
from routing.services.geo import LatLon
from routing.services.http import get_json
from routing.services.risk import Weather

GRID_DEG = 0.1
BATCH_SIZE = 50
MAX_FORECAST_DAYS = 15
CACHE_SECONDS = 30 * 60
HOURLY_VARS = ("wind_speed_10m", "wind_gusts_10m", "rain", "showers", "snowfall", "temperature_2m")


@dataclass(frozen=True)
class HourlySeries:
    start: datetime
    wind_mph: list[float]
    gust_mph: list[float]
    rain_in: list[float]
    snow_in: list[float]
    temperature_f: list[float]

    def index_at(self, moment: datetime) -> int | None:
        index = round((moment - self.start).total_seconds() / 3600)
        return index if 0 <= index < len(self.wind_mph) else None

    def weather_at(self, moment: datetime) -> Weather | None:
        i = self.index_at(moment)
        if i is None:
            return None
        return Weather(wind_mph=self.wind_mph[i], rain_in_hr=self.rain_in[i], snow_in_hr=self.snow_in[i])


def snap(point: LatLon) -> LatLon:
    return (round(round(point[0] / GRID_DEG) * GRID_DEG, 2), round(round(point[1] / GRID_DEG) * GRID_DEG, 2))


def _values(hourly: dict, key: str) -> list[float]:
    # open-meteo returns null for hours a model doesn't cover; treat as calm/dry
    return [v or 0.0 for v in hourly[key]]


def _parse(item: dict) -> HourlySeries:
    hourly = item["hourly"]
    rain = _values(hourly, "rain")
    showers = _values(hourly, "showers")
    return HourlySeries(
        start=datetime.fromisoformat(hourly["time"][0]).replace(tzinfo=UTC),
        wind_mph=_values(hourly, "wind_speed_10m"),
        gust_mph=_values(hourly, "wind_gusts_10m"),
        # liquid precipitation = large-scale rain + convective showers
        rain_in=[r + s for r, s in zip(rain, showers, strict=True)],
        snow_in=_values(hourly, "snowfall"),
        temperature_f=_values(hourly, "temperature_2m"),
    )


def _fetch_batch(points: list[LatLon], start: date, end: date) -> list[HourlySeries]:
    data = get_json(
        "Weather service",
        settings.OPEN_METEO_URL,
        params={
            "latitude": ",".join(f"{lat:.2f}" for lat, _ in points),
            "longitude": ",".join(f"{lon:.2f}" for _, lon in points),
            "hourly": ",".join(HOURLY_VARS),
            "wind_speed_unit": "mph",
            "precipitation_unit": "inch",
            "temperature_unit": "fahrenheit",
            "timezone": "UTC",
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
        },
    )
    items = data if isinstance(data, list) else [data]
    if len(items) != len(points):
        raise UpstreamError("Weather service", "Forecast response did not match the requested points.")
    return [_parse(item) for item in items]


def get_forecasts(points: list[LatLon], start: datetime, end: datetime) -> dict[LatLon, HourlySeries]:
    """Hourly series covering [start, end] for each point, keyed by the snapped point."""
    first_day = start.astimezone(UTC).date()
    last_day = end.astimezone(UTC).date()
    if (last_day - datetime.now(UTC).date()).days > MAX_FORECAST_DAYS:
        raise UpstreamError("Weather service", "Trip extends beyond the available forecast horizon.")

    def cache_key(p: LatLon) -> str:
        return f"wx:{p[0]:.2f}:{p[1]:.2f}:{first_day}:{last_day}"

    snapped = list(dict.fromkeys(snap(p) for p in points))
    cached = cache.get_many([cache_key(p) for p in snapped])
    result = {p: cached[cache_key(p)] for p in snapped if cache_key(p) in cached}
    missing = [p for p in snapped if p not in result]

    batches = [missing[i : i + BATCH_SIZE] for i in range(0, len(missing), BATCH_SIZE)]
    if batches:
        with ThreadPoolExecutor(max_workers=min(4, len(batches))) as pool:
            fetched = pool.map(lambda batch: _fetch_batch(batch, first_day, last_day), batches)
            for batch, series in zip(batches, fetched, strict=True):
                result.update(zip(batch, series, strict=True))
        cache.set_many({cache_key(p): result[p] for p in missing}, CACHE_SECONDS)

    return result
