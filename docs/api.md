# API contract

Base path: `/api`. JSON only. Errors return `{"error": "<message>", "details"?: {...}}` with a 4xx/5xx status.

Risk levels are integers everywhere: `0 Low, 1 Moderate, 2 High, 3 Severe, 4 No Travel`.

## GET /api/geocode?q=<text>

Place search for the origin/destination inputs (min 3 chars, US-biased).

```json
{ "results": [{ "label": "Dallas, Texas, United States", "lat": 32.7763, "lon": -96.7969 }] }
```

## POST /api/plan

Request:

```json
{
  "origin": { "label": "Dallas, TX", "lat": 32.7767, "lon": -96.797 },
  "destination": { "label": "Chicago, IL", "lat": 41.8781, "lon": -87.6298 },
  "departure_time": "2026-10-30T08:00:00-05:00",
  "load_lbs": 42000,
  "checkpoint_interval_mi": 25
}
```

- `departure_time`: ISO 8601 with offset; between now − 1 h and now + 7 days.
- `load_lbs`: 0 – 80,000.
- `checkpoint_interval_mi`: one of `10`, `25`, `50`.

Response:

```json
{
  "departure_time": "2026-10-30T13:00:00Z",
  "load_lbs": 42000,
  "checkpoint_interval_mi": 25,
  "recommended_route_id": "route-b",
  "recommendation_reason": "Route B has 0 Severe miles vs 50 on Route A.",
  "routes": [
    {
      "id": "route-a",
      "name": "Route A",
      "via": "I 35, I 44",
      "distance_mi": 967.4,
      "driving_hours": 17.6,
      "trip_hours": 28.1,
      "arrival_time": "2026-10-31T17:06:00Z",
      "geometry": [[-96.797, 32.7767], [-96.79, 32.78]],
      "rank": 2,
      "recommended": false,
      "travelable": true,
      "summary": {
        "miles_by_level": { "low": 800.1, "moderate": 117.3, "high": 0, "severe": 50, "no_travel": 0 },
        "avg_risk": 0.27,
        "max_level": 3
      },
      "stops": [
        { "type": "break", "mile": 480.2, "lat": 37.1, "lon": -94.5, "start": "...Z", "end": "...Z" },
        { "type": "rest", "mile": 660.0, "lat": 38.2, "lon": -92.1, "start": "...Z", "end": "...Z" }
      ],
      "checkpoints": [
        {
          "index": 0,
          "mile": 0,
          "lat": 32.7767,
          "lon": -96.797,
          "eta": "2026-10-30T13:00:00Z",
          "weather": { "wind_mph": 12.1, "gust_mph": 21.0, "rain_in_hr": 0.0, "snow_in_hr": 0.0, "temperature_f": 61.2 },
          "level": 0,
          "wind_level": 0,
          "rain_level": 0,
          "snow_level": 0,
          "reasons": []
        }
      ]
    }
  ],
  "corridor": {
    "bbox": [-97.5, 32.0, -87.0, 42.5],
    "points": [[32.75, -96.75], [33.0, -96.5]]
  }
}
```

- `routes` always has up to 3 entries, sorted by `rank` (1 = recommended).
- `geometry` is `[lon, lat]` pairs (GeoJSON order). `corridor.points` are `[lat, lon]`.
- `stops`: `break` = 30-min break after 8 h driving, `rest` = 10-h off-duty after 11 h driving (FMCSA HOS).
- `weather` may be `null` and `level` `null` if the forecast is unavailable for that time.

## POST /api/heatmap

Hourly weather for the corridor grid, used by the 0–48 h slider. Fetched separately so routes render first.

Request:

```json
{ "points": [[32.75, -96.75]], "start_time": "2026-10-30T13:00:00Z", "load_lbs": 42000 }
```

Response (arrays have one value per hour, index 0 = `start_time` hour, length `hours` = 49):

```json
{
  "start_time": "2026-10-30T13:00:00Z",
  "hours": 49,
  "points": [
    { "lat": 32.75, "lon": -96.75, "risk": [0, 0, 1], "wind": [12.1, 14.0], "precip": [0.0, 0.02], "snow": [0.0, 0.0] }
  ]
}
```

`risk` is the 0–4 level after load rules; `wind` mph, `precip` rain in/hr, `snow` in/hr.
