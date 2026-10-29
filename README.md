# Weather-Aware Truck Routing

Plan a truck trip, get three route options, and see which one is safest given the forecast at the time the truck will actually be at each point along the way, the load weight, and travel time.

Live: `<hosted-url>` · Walkthrough: `<loom-url>`

## What it does

- Takes origin, destination, departure time, load weight and a checkpoint interval (10 / 25 / 50 mi).
- Fetches three distinct route options.
- Places a checkpoint every N miles, computes the truck's ETA there (truck speed cap + hours-of-service stops), and samples the hourly forecast for that hour.
- Classifies each checkpoint with the risk table and load rules, aggregates miles per risk level, and ranks the routes.
- Shows routes, risk-coloured checkpoints, ETAs, HOS stops and route summaries on a map, plus a forecast heatmap over the trip corridor with a 0–48 h slider.

## Run it

```bash
# backend (Python 3.12+), http://localhost:8000
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
python manage.py runserver

# frontend (Node 22 + pnpm), http://localhost:5173 (proxies /api to :8000)
cd frontend
pnpm install
pnpm dev

# tests and lint
cd backend && pytest -q && ruff check .
cd frontend && pnpm lint && pnpm build

# production image (serves the built React app and the API from one container)
docker build -t truck-weather-routing .
docker run -p 8000:8000 -e DJANGO_ALLOWED_HOSTS=localhost truck-weather-routing
```

No API keys are needed. All providers are free and keyless (see below).

## Deploy (Railway)

1. New Project → Deploy from GitHub repo → pick this repo. `railway.json` tells Railway to build the Dockerfile and health-check `/api/health`.
2. Variables: `DJANGO_SECRET_KEY` (any long random string). `DJANGO_DEBUG` already defaults to `false` in the image, and the Railway domain is allowed automatically.
3. Settings → Networking → Generate Domain.

The service runs one gunicorn worker with 8 threads (about 100 MB RAM) and sleeps when idle, so it fits the free plan's credit. Raise `WEB_CONCURRENCY` for more throughput.

## Layout

```
backend/
  config/                  settings, urls, SPA fallback view
  routing/
    services/
      risk.py              risk table + load rules (pure, no I/O)
      hos.py               hours-of-service stops → wall-clock ETAs
      planner.py           checkpoints, scoring, ranking, explanation
      routing.py           OSRM client, truck speed cap, 3rd-route top-up
      weather.py           Open-Meteo client, batching, grid snapping, cache
      heatmap.py           corridor grid + 49-hour risk series
      geocoding.py         Photon place search
      geo.py               haversine, interpolation, simplification
    serializers.py         request validation
    views.py               /api/geocode, /api/plan, /api/heatmap, /api/health
    tests/                 risk thresholds, load rules, HOS, ranking
frontend/
  src/
    api/                   fetch wrapper + typed ApiError
    config/env.ts          env getters
    features/route-planner/
      components/          form, route cards, checkpoint list, map, heatmap controls
      queries.ts           TanStack Query hooks
      types.ts             API types (mirrors docs/api.md)
docs/api.md                API contract
Dockerfile                 multi-stage: builds React, runs Django on gunicorn
railway.json               Railway build + deploy config
```

## Providers

| Need | Provider | Why |
| --- | --- | --- |
| Routing | OSRM public server | Free, keyless, returns full geometry with per-segment distance/duration |
| Weather | Open-Meteo forecast API | Free, keyless, hourly to 16 days, many points per request, native mph and inches |
| Geocoding | Photon (Komoot, OSM data) | Free, keyless, fast type-ahead |
| Basemap | CARTO Positron vector style | Free, keyless, low-contrast so risk colours stand out |

Base URLs are environment variables (`OSRM_URL`, `OPEN_METEO_URL`, `PHOTON_URL`), so any of them can be swapped for a self-hosted or paid instance.

## Rules baked in

**Risk table** (`backend/routing/services/risk.py`). A checkpoint's level is the worst of wind, rain and snow.

| Condition | Low | Moderate | High | Severe | No Travel |
| --- | --- | --- | --- | --- | --- |
| Wind (mph) | < 25 | 25 – 34 | 35 – 44 | 45 – 54 | ≥ 55 |
| Rain (in/hr) | < 0.10 | 0.10 – 0.25 | 0.25 – 0.50 | 0.50 – 1.00 | > 1.00 |
| Snow (in/hr) | < 0.5 | 0.5 – 1.0 | 1.0 – 2.0 | 2.0 – 3.0 | > 3.0 |

- Lower bounds are inclusive where bands touch (0.25 in/hr is High), and 1.00 in/hr rain / 3.0 in/hr snow are still Severe because the brief uses strict `>` for No Travel.
- Wind values between whole numbers (e.g. 34.5 mph) fall into the lower band: the bands are read as `[25, 35)`, `[35, 45)` and so on.

**Load rules.** These apply to the wind level only:

- ≥ 55 mph is No Travel for any load.
- 45 – 54 mph with a load over 30,000 lb becomes No Travel.
- 35 – 44 mph with a load over 40,000 lb becomes Severe.

**Checkpoints and miles.**

- Checkpoints sit at mile 0, then every N miles, then at the destination.
- Each checkpoint stands for the stretch halfway to its neighbours, so the "miles at level X" figures add up exactly to the route length.

**ETAs.**

- OSRM's per-segment durations are capped at 65 mph, a typical speed governor.
- FMCSA hours-of-service are applied: a 30-minute break after 8 h of driving and a 10-hour rest after 11 h. Without them, checkpoints late in a multi-day trip would be checked against a forecast up to 10 hours too early.

**Forecast sampling.**

- Each checkpoint uses the hourly forecast for the hour nearest its ETA.
- Rain is `rain + showers`, i.e. large-scale plus convective liquid precipitation.
- Wind is sustained 10 m wind. Gusts are shown but not scored, because the table describes sustained wind.

**Recommendation.** Routes are ranked lexicographically by:

1. No Travel miles (stricter than Severe, so it comes first)
2. Severe miles
3. High miles
4. Distance-weighted average risk (0 – 4)
5. Trip time including HOS stops

The UI shows the reason, i.e. the first criterion that separates the winner from the runner-up. If the safer route is slower, it also says how much time that costs.

**Three routes.**

- OSRM often returns only one or two alternatives on long trips.
- The third route comes from a "via" detour: the trip is forced through a point pushed sideways from the midpoint.
- A detour route is kept only if under 85 % of it overlaps an existing option and it is no more than 1.5× the fastest driving time.

**Heatmap.**

- The corridor is a grid of cells within 30 mi of any route, capped at 250 points.
- One request returns 49 hourly values per cell. The slider only changes which value the heatmap layer reads; nothing is refetched or re-uploaded, so scrubbing stays smooth.

**Provider load.**

- Forecast points are snapped to a 0.1° grid, close to the weather model's own resolution, and deduplicated across routes.
- Requests are batched 50 locations at a time, sent in parallel, and cached for 30 minutes.

## Limitations

- OSRM's public server uses a car network. It doesn't know about truck restrictions (low bridges, weight limits, hazmat). A truck profile such as GraphHopper or HERE is a drop-in change in `routing.py`.
- Departure must fall within 7 days, so the whole trip plus the 48 h heatmap fits Open-Meteo's forecast horizon.
- The cache is per-process memory. Redis would replace it if this ran on more than one instance.
