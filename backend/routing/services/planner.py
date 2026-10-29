"""Turns raw route options into scored, ranked trip plans."""

from dataclasses import dataclass, field
from datetime import datetime, timedelta

from routing.services import hos
from routing.services.geo import METERS_PER_MILE, LatLon, interpolate, simplify
from routing.services.heatmap import corridor_points
from routing.services.risk import RiskAssessment, RiskLevel, assess
from routing.services.routing import RawRoute, get_route_options
from routing.services.weather import HourlySeries, get_forecasts, snap

LEVEL_KEYS = {level: level.name.lower() for level in RiskLevel}
GEOMETRY_TOLERANCE_DEG = 0.0005


@dataclass
class Checkpoint:
    mile: float
    point: LatLon
    eta: datetime
    series: HourlySeries | None = None
    risk: RiskAssessment | None = None
    covers_mi: float = 0.0


@dataclass
class RoutePlan:
    route: RawRoute
    checkpoints: list[Checkpoint]
    arrival: datetime
    miles_by_level: dict[RiskLevel, float] = field(default_factory=dict)
    avg_risk: float = 0.0
    max_level: RiskLevel = RiskLevel.LOW
    name: str = ""

    @property
    def distance_mi(self) -> float:
        return self.route.distance_m / METERS_PER_MILE

    @property
    def trip_hours(self) -> float:
        return (self.arrival - self.checkpoints[0].eta).total_seconds() / 3600

    def miles(self, level: RiskLevel) -> float:
        return round(self.miles_by_level.get(level, 0.0), 1)

    def sort_key(self) -> tuple:
        # brief's order: fewest Severe miles, fewest High miles, lowest average risk, shortest time.
        # No Travel is stricter than Severe, so it is compared first.
        return (
            self.miles(RiskLevel.NO_TRAVEL),
            self.miles(RiskLevel.SEVERE),
            self.miles(RiskLevel.HIGH),
            round(self.avg_risk, 2),
            round(self.trip_hours, 2),
        )


def checkpoint_miles(total_mi: float, interval_mi: int) -> list[float]:
    miles = [float(m) for m in range(0, int(total_mi), interval_mi)]
    # avoid a sliver checkpoint right before the destination
    if total_mi - miles[-1] < interval_mi * 0.2 and len(miles) > 1:
        miles.pop()
    return [*miles, total_mi]


def build_checkpoints(route: RawRoute, departure: datetime, interval_mi: int) -> list[Checkpoint]:
    total_mi = route.distance_m / METERS_PER_MILE
    checkpoints = []
    for mile in checkpoint_miles(total_mi, interval_mi):
        point, i, t = interpolate(route.points, route.cumulative_m, mile * METERS_PER_MILE)
        drive_s = route.cumulative_s[i] + t * (route.cumulative_s[i + 1] - route.cumulative_s[i])
        eta = departure + timedelta(seconds=hos.elapsed_s(drive_s))
        checkpoints.append(Checkpoint(mile=mile, point=point, eta=eta))

    # each checkpoint represents the stretch halfway to its neighbours
    for idx, cp in enumerate(checkpoints):
        lo = 0.0 if idx == 0 else (checkpoints[idx - 1].mile + cp.mile) / 2
        hi = total_mi if idx == len(checkpoints) - 1 else (cp.mile + checkpoints[idx + 1].mile) / 2
        cp.covers_mi = hi - lo
    return checkpoints


def score(plan: RoutePlan, load_lbs: float) -> None:
    miles: dict[RiskLevel, float] = {level: 0.0 for level in RiskLevel}
    weighted = known_mi = 0.0
    for cp in plan.checkpoints:
        weather = cp.series.weather_at(cp.eta) if cp.series else None
        if weather is None:
            continue
        cp.risk = assess(weather, load_lbs)
        miles[cp.risk.level] += cp.covers_mi
        weighted += cp.risk.level * cp.covers_mi
        known_mi += cp.covers_mi
    plan.miles_by_level = miles
    plan.avg_risk = weighted / known_mi if known_mi else 0.0
    plan.max_level = max((cp.risk.level for cp in plan.checkpoints if cp.risk), default=RiskLevel.LOW)


def explain(ranked: list[RoutePlan]) -> str:
    best = ranked[0]
    if len(ranked) == 1:
        return f"{best.name} is the only route available."
    runner = ranked[1]

    criteria = [
        (RiskLevel.NO_TRAVEL, "No Travel"),
        (RiskLevel.SEVERE, "Severe"),
        (RiskLevel.HIGH, "High"),
    ]
    reason = None
    for level, label in criteria:
        if best.miles(level) != runner.miles(level):
            reason = (
                f"{best.name} has the fewest {label} miles "
                f"({best.miles(level):g} vs {runner.miles(level):g} on {runner.name})."
            )
            break
    if reason is None and round(best.avg_risk, 2) != round(runner.avg_risk, 2):
        reason = (
            f"Severe and High exposure is equal; {best.name} has the lowest average risk "
            f"({best.avg_risk:.2f} vs {runner.avg_risk:.2f} on {runner.name})."
        )
    if reason is None:
        reason = f"Weather risk is equivalent across routes; {best.name} is the fastest ({best.trip_hours:.1f} h)."

    fastest = min(ranked, key=lambda p: p.trip_hours)
    extra = best.trip_hours - fastest.trip_hours
    if fastest is not best and extra >= 0.1:
        reason += f" It takes {extra:.1f} h longer than {fastest.name}, the fastest option."
    if best.miles(RiskLevel.NO_TRAVEL) > 0:
        reason += " Every route currently crosses No Travel conditions; consider delaying departure."
    return reason


def _iso(moment: datetime) -> str:
    return moment.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _serialize_checkpoint(index: int, cp: Checkpoint) -> dict:
    weather = None
    if cp.risk and cp.series and (i := cp.series.index_at(cp.eta)) is not None:
        weather = {
            "wind_mph": round(cp.series.wind_mph[i], 1),
            "gust_mph": round(cp.series.gust_mph[i], 1),
            "rain_in_hr": round(cp.series.rain_in[i], 3),
            "snow_in_hr": round(cp.series.snow_in[i], 3),
            "temperature_f": round(cp.series.temperature_f[i], 1),
        }
    return {
        "index": index,
        "mile": round(cp.mile, 1),
        "lat": round(cp.point[0], 5),
        "lon": round(cp.point[1], 5),
        "eta": _iso(cp.eta),
        "weather": weather,
        "level": int(cp.risk.level) if cp.risk else None,
        "wind_level": int(cp.risk.wind) if cp.risk else None,
        "rain_level": int(cp.risk.rain) if cp.risk else None,
        "snow_level": int(cp.risk.snow) if cp.risk else None,
        "reasons": list(cp.risk.reasons) if cp.risk else [],
    }


def _serialize_stops(plan: RoutePlan, departure: datetime) -> list[dict]:
    route = plan.route
    stops = []
    for stop in hos.stops_before(route.duration_s):
        # invert drive time → distance along the route
        point, i, t = interpolate(route.points, route.cumulative_s, stop.drive_s)
        mile = (route.cumulative_m[i] + t * (route.cumulative_m[i + 1] - route.cumulative_m[i])) / METERS_PER_MILE
        start = departure + timedelta(seconds=hos.elapsed_s(stop.drive_s))
        stops.append(
            {
                "type": stop.kind,
                "mile": round(mile, 1),
                "lat": round(point[0], 5),
                "lon": round(point[1], 5),
                "start": _iso(start),
                "end": _iso(start + timedelta(seconds=stop.duration_s)),
            }
        )
    return stops


def _serialize_route(plan: RoutePlan, rank: int, departure: datetime) -> dict:
    geometry = simplify(plan.route.points, GEOMETRY_TOLERANCE_DEG)
    return {
        "id": f"route-{plan.name[-1].lower()}",
        "name": plan.name,
        "via": plan.route.via,
        "distance_mi": round(plan.distance_mi, 1),
        "driving_hours": round(plan.route.duration_s / 3600, 2),
        "trip_hours": round(plan.trip_hours, 2),
        "arrival_time": _iso(plan.arrival),
        "geometry": [[round(lon, 5), round(lat, 5)] for lat, lon in geometry],
        "rank": rank,
        "recommended": rank == 1,
        "travelable": plan.miles(RiskLevel.NO_TRAVEL) == 0,
        "summary": {
            "miles_by_level": {LEVEL_KEYS[level]: plan.miles(level) for level in RiskLevel},
            "avg_risk": round(plan.avg_risk, 2),
            "max_level": int(plan.max_level),
        },
        "stops": _serialize_stops(plan, departure),
        "checkpoints": [_serialize_checkpoint(i, cp) for i, cp in enumerate(plan.checkpoints)],
    }


def plan_trip(origin: LatLon, destination: LatLon, departure: datetime, load_lbs: float, interval_mi: int) -> dict:
    routes = get_route_options(origin, destination)

    plans = []
    for idx, route in enumerate(routes):
        checkpoints = build_checkpoints(route, departure, interval_mi)
        arrival = departure + timedelta(seconds=hos.elapsed_s(route.duration_s))
        plans.append(RoutePlan(route=route, checkpoints=checkpoints, arrival=arrival, name=f"Route {'ABC'[idx]}"))

    all_points = [cp.point for plan in plans for cp in plan.checkpoints]
    forecasts = get_forecasts(all_points, departure, max(plan.arrival for plan in plans))
    for plan in plans:
        for cp in plan.checkpoints:
            cp.series = forecasts.get(snap(cp.point))
        score(plan, load_lbs)

    ranked = sorted(plans, key=RoutePlan.sort_key)
    corridor = corridor_points([plan.route for plan in plans])
    return {
        "departure_time": _iso(departure),
        "load_lbs": load_lbs,
        "checkpoint_interval_mi": interval_mi,
        "recommended_route_id": f"route-{ranked[0].name[-1].lower()}",
        "recommendation_reason": explain(ranked),
        "routes": [_serialize_route(plan, rank, departure) for rank, plan in enumerate(ranked, start=1)],
        "corridor": corridor,
    }
