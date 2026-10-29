from django.conf import settings
from django.core.cache import cache

from routing.services.http import get_json

# trips are in mph / lbs, so search North America only, biased to the continental US
US_CENTER = (39.8, -98.6)
NORTH_AMERICA_BBOX = "-170,14,-50,72"


def search_places(query: str, limit: int = 6) -> list[dict]:
    key = f"geocode:{query.lower()}"
    if (cached := cache.get(key)) is not None:
        return cached

    data = get_json(
        "Geocoding service",
        settings.PHOTON_URL,
        params={
            "q": query,
            "limit": limit,
            "lang": "en",
            "lat": US_CENTER[0],
            "lon": US_CENTER[1],
            "bbox": NORTH_AMERICA_BBOX,
        },
    )
    results: list[dict] = []
    seen: set[str] = set()
    for feature in data.get("features", []):
        props = feature["properties"]
        parts = [props.get("name"), props.get("city"), props.get("state"), props.get("country")]
        label = ", ".join(dict.fromkeys(p for p in parts if p))
        if not label or label in seen:
            continue
        seen.add(label)
        lon, lat = feature["geometry"]["coordinates"]
        results.append({"label": label, "lat": round(lat, 5), "lon": round(lon, 5)})

    cache.set(key, results, 60 * 60 * 24)
    return results
