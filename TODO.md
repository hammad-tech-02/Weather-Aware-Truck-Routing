# TODO

## Build
- [x] Backend: risk rules, load rules, HOS-aware ETAs, ranking, recommendation reason
- [x] Backend: OSRM routes (+ third-route detour), Open-Meteo batching/cache, Photon geocoding
- [x] Frontend: form, route cards, checkpoint timeline, map, 0–48 h heatmap slider
- [x] Tests (49) + lint + CI workflow
- [x] Dockerfile + render.yaml
- [x] Deep-teal dark/light theme, Dark Matter / Voyager basemaps, satellite toggle, terrain + hillshade, Spotter favicon/mark

## Ship
- [ ] Read through the frontend code (`frontend/src/features/route-planner/`) and the README so every decision is easy to explain
- [ ] `gh repo create truck-weather-routing --public --source . --push`
- [ ] Render → New → Blueprint → pick the repo → Apply
- [ ] Keep it awake during review: UptimeRobot ping `https://<app>.onrender.com/api/health` every 10 min, or upgrade to Starter
- [ ] Smoke-test the hosted URL: plan a trip, scrub the heatmap, switch theme/satellite/terrain, check on a phone

## Demo
- [ ] Find a route with real Moderate/High risk on recording day (see `docs/demo-script.md`)
- [ ] Record the Loom following `docs/demo-script.md` (aim for 8 min)
- [ ] Put the hosted URL and Loom link into the README placeholders, commit, push

## Submit
- [ ] Check Spotter's policy on AI-assisted take-homes
- [ ] Send the GitHub repo, hosted URL and Loom link
