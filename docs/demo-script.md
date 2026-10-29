# Loom demo script (target 8 min, hard limit 10)

Set up before recording:
- Open the hosted URL in dark mode. Close other tabs. Zoom the browser to 100 %.
- Find a route that shows real weather risk today. Try a few minutes before recording, for example:
  - Denver → Salt Lake City (Rockies)
  - Minneapolis → Billings (northern Plains)
  - any route through an active storm (https://www.weather.gov)
- Have the code open in the editor at `backend/routing/services/risk.py` and `planner.py`.
- Do a warm-up plan once so the free host is awake and the forecast cache is hot.

---

## 1. Intro (0:00 – 0:40)

> "Hi, I'm Hammad. This is my take-home for Spotter: a weather-aware truck routing app in React and Django.
> A driver enters origin, destination, departure time and load weight. The app gets three routes, samples the forecast at the time the truck will actually be at each checkpoint, scores the risk with the rules from the brief, and recommends the safest route, balancing risk against travel time.
> Everything uses free, keyless providers: OSRM for routing, Open-Meteo for hourly forecasts, Photon for place search."

## 2. Planning a trip (0:40 – 2:00)

- Type the origin and destination. Show the autocomplete and keyboard selection.
- Set a departure a few hours ahead. Pick 42,000 lb (mention it matters for the wind load rules) and a 25 mi interval.
- Click Plan routes.

> "Routes come back in a couple of seconds. Each one is checked every 25 miles. That's about 120 forecast lookups, which are deduplicated, batched and cached on the backend."

## 3. Reading the results (2:00 – 3:30)

- Point at the recommendation banner.

> "The recommendation tells you why it won: here, fewer Severe miles than the runner-up. If the safer route is slower, it says how much time that costs."

- Walk through a route card: distance, driving time, trip time including hours-of-service stops, arrival time, and the miles-by-risk bar.
- Select another route. The map highlights it, with the line coloured by risk.
- Scroll the checkpoint timeline and click a checkpoint. The map flies to it and opens a popup with the ETA, wind and gusts, rain, snow, temperature, and the reason for its level.
- Point at the B / R markers.

> "These are the 30-minute break after 8 hours of driving and the 10-hour rest after 11. They push later ETAs back, so we read the forecast for the hour the truck is really there."

## 4. Heatmap and map (3:30 – 5:00)

- Scrub the 0–48 h slider, then press play.

> "This is the forecast over the trip corridor: a grid within 30 miles of every route, with 49 hourly values per point loaded in one request. The slider only changes which hour the map draws, so nothing is refetched and it stays smooth."

- Switch the metric to Wind, then Rain or Snow.
- Toggle to light mode (Voyager basemap), then Satellite, then Terrain.

> "Terrain helps here: you can see where a route climbs over a pass, which is usually where wind and snow risk appear."

- Switch back to dark mode.

## 5. Under the hood (5:00 – 7:15)

Show `risk.py`:

> "The risk table is a pure function with no I/O.
> Bands are inclusive at the lower edge, and 1.00 inch of rain or 3.0 inches of snow is still Severe, because the brief uses a strict 'greater than' for No Travel.
> The load rules only change the wind level: 45 to 54 mph over 30,000 lb becomes No Travel, and 35 to 44 mph over 40,000 lb becomes Severe.
> The checkpoint's overall level is the worst of wind, rain and snow."

Show `planner.py`:

> "Each checkpoint stands for the stretch halfway to its neighbours, so the miles per level add up exactly to the route length.
> Ranking follows the brief's order: Severe miles, then High miles, then average risk, then travel time. I put No Travel miles first because they're stricter than Severe."

Show `routing.py`:

> "OSRM often returns only two alternatives on long trips. I add a third by forcing a detour through a point pushed sideways from the midpoint, and keep it only if it isn't mostly a copy of an existing route and isn't more than 1.5 times slower.
> Durations are capped at 65 mph for a governed truck.
> I also check that each route actually reaches the requested points. Without that, an unreachable destination would quietly be snapped to the nearest road, even on another continent."

Show the tests folder briefly:

> "Every threshold boundary, every load rule, the HOS stop sequence and the ranking order are covered by tests that run in CI."

## 6. Trade-offs and wrap-up (7:15 – 8:00)

> "Known limits: OSRM's public server uses a car road network, so it doesn't know truck restrictions like low bridges. Swapping in a truck-profile router is a change to one module. Departures are limited to 7 days ahead so the whole trip and the 48-hour heatmap stay inside the forecast range.
> The README covers every assumption I made. Thanks for watching."

---

Recording tips:
- Talk to what's on screen; don't read a wall of code. Highlight a few lines at a time.
- If a provider is slow while recording, keep talking about the design and cut in the editor later.
