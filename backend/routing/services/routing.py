"""Route options from OSRM, adjusted for truck speeds.

OSRM's public server only uses a car profile and often returns fewer than three
alternatives on long trips. To always offer three meaningfully different
options we top up with "via" routes: the trip is forced through a point pushed
sideways from the midpoint, and kept only if it is not a near-duplicate of a
route we already have and is not an absurd detour.
"""

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from itertools import accumulate

from django.conf import settings

from routing.exceptions import UpstreamError
from routing.services.geo import LatLon, haversine_m, offset_midpoint, sample_every
from routing.services.http import get_json

ROUTE_COUNT = 3
# Class 8 trucks are commonly governed to 65 mph; OSRM car speeds go higher.
TRUCK_MAX_SPEED_MPS = 65 * 0.44704
MAX_DETOUR_RATIO = 1.5
DUPLICATE_OVERLAP = 0.85
DUPLICATE_RADIUS_M = 5_000
VIA_OFFSETS = (0.15, -0.15, 0.3, -0.3)
# OSRM snaps to the nearest road, which across an ocean can be a different continent
MAX_SNAP_M = 25_000


@dataclass(frozen=True)
class RawRoute:
    points: list[LatLon]
    cumulative_m: list[float]
    cumulative_s: list[float]
    via: str

    @property
    def distance_m(self) -> float:
        return self.cumulative_m[-1]

    @property
    def duration_s(self) -> float:
        return self.cumulative_s[-1]


def _parse(route: dict) -> RawRoute:
    points = [(lat, lon) for lon, lat in route["geometry"]["coordinates"]]
    distances: list[float] = []
    durations: list[float] = []
    for leg in route["legs"]:
        annotation = leg["annotation"]
        distances.extend(annotation["distance"])
        # never faster than the truck speed cap
        durations.extend(
            max(dur, dist / TRUCK_MAX_SPEED_MPS)
            for dist, dur in zip(annotation["distance"], annotation["duration"], strict=True)
        )
    names = [leg["summary"] for leg in route["legs"] if leg.get("summary")]
    via = ", ".join(dict.fromkeys(", ".join(names).split(", "))) if names else ""
    return RawRoute(
        points=points,
        cumulative_m=[0.0, *accumulate(distances)],
        cumulative_s=[0.0, *accumulate(durations)],
        via=via,
    )


def _osrm(coords: list[LatLon], alternatives: bool) -> list[RawRoute]:
    path = ";".join(f"{lon:.6f},{lat:.6f}" for lat, lon in coords)
    try:
        data = _request(path, alternatives)
    except UpstreamError as exc:
        # OSRM answers 400 for unroutable input (e.g. across an ocean)
        if exc.status_code == 400:
            return []
        raise
    if data.get("code") != "Ok":
        if data.get("code") == "NoRoute":
            return []
        raise UpstreamError("Routing service", data.get("message") or "No route could be computed.")
    return [_parse(r) for r in data["routes"]]


def _request(path: str, alternatives: bool) -> dict:
    return get_json(
        "Routing service",
        f"{settings.OSRM_URL}/route/v1/driving/{path}",
        params={
            "alternatives": "3" if alternatives else "false",
            "overview": "full",
            "geometries": "geojson",
            "annotations": "distance,duration",
            # only needed for the leg summary (main road names)
            "steps": "true",
        },
    )


def _overlap(candidate: RawRoute, existing: RawRoute) -> float:
    """Share of the candidate's length that runs within DUPLICATE_RADIUS_M of `existing`."""
    step = max(candidate.distance_m / 60, 1_000)
    sampled = sample_every(candidate.points, candidate.cumulative_m, step)
    reference = sample_every(existing.points, existing.cumulative_m, max(existing.distance_m / 400, 500))
    close = sum(1 for p in sampled if min(haversine_m(p, q) for q in reference) <= DUPLICATE_RADIUS_M)
    return close / len(sampled)


def _is_distinct(candidate: RawRoute, chosen: list[RawRoute]) -> bool:
    return all(_overlap(candidate, route) < DUPLICATE_OVERLAP for route in chosen)


def get_route_options(origin: LatLon, destination: LatLon) -> list[RawRoute]:
    routes = [
        r
        for r in _osrm([origin, destination], alternatives=True)
        if haversine_m(r.points[0], origin) <= MAX_SNAP_M and haversine_m(r.points[-1], destination) <= MAX_SNAP_M
    ]
    if not routes:
        raise UpstreamError("Routing service", "No drivable route found between these locations.")

    chosen = [routes[0]]
    for route in routes[1:]:
        if len(chosen) < ROUTE_COUNT and _is_distinct(route, chosen):
            chosen.append(route)
    if len(chosen) >= ROUTE_COUNT:
        return chosen

    fastest = chosen[0].duration_s
    vias = [offset_midpoint(origin, destination, f) for f in VIA_OFFSETS]
    with ThreadPoolExecutor(max_workers=len(vias)) as pool:
        results = list(pool.map(lambda via: _osrm([origin, via, destination], alternatives=False), vias))

    for candidates in results:
        for route in candidates:
            if len(chosen) >= ROUTE_COUNT:
                break
            if route.duration_s <= fastest * MAX_DETOUR_RATIO and _is_distinct(route, chosen):
                chosen.append(route)
    return chosen
