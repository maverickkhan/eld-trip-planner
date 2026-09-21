# ELD Trip Planner

Trip-planning tool for property-carrying truck drivers. Enter where you are, where you pick
up, where you deliver, and how many hours of the 70-hour cycle you have already used. The app
geocodes the stops, routes the trip, runs an FMCSA Hours-of-Service rule engine, and returns:

1. A map of the route with every planned stop (pickup, drop-off, fuel, 30-minute breaks,
   10-hour rests, 34-hour restarts).
2. A stop-by-stop schedule.
3. One auto-filled ELD daily log sheet per calendar day, drawn as the familiar 24-hour grid
   with duty-status lines.

**Stack:** Django 5 + Django REST Framework (API) · React 19 + Vite + Material UI (frontend) ·
Leaflet · OSRM (routing) · Nominatim (geocoding).

The UI implements the Stitch design in `docs/stitch-prompts.md` (design tokens live in
`frontend/src/theme.js`): a dispatcher console with the trip form and driver clocks on the left,
and Map · Schedule · Log sheets tabs on the right. Log sheets are printable (Print / PDF) and both
the schedule and log entries export to CSV.

---

## Repository layout

```
eld-logs/
├── backend/                    Django project
│   ├── config/                 settings, root urls, wsgi
│   ├── trips/                  the one Django app
│   │   ├── hos/                ★ HOS rule engine (pure Python, no Django)
│   │   │   ├── rules.py        rule parameters (11/14/8/30-min/10/70/8/34, fuel, dwell)
│   │   │   ├── models.py       dataclasses: DutyEvent, Leg, Schedule, DailyLog, ...
│   │   │   ├── engine.py       HOSEngine + DriverState simulation
│   │   │   └── daily_logs.py   slices the timeline into 24-hour log sheets
│   │   ├── services/
│   │   │   ├── geocoding.py    Nominatim client (throttled, cached)
│   │   │   ├── routing.py      OSRM client (per-leg distance/duration, GeoJSON geometry)
│   │   │   ├── geometry.py     RouteLocator: odometer miles -> lat/lon on the polyline
│   │   │   └── planner.py      orchestrates geocode -> route -> engine -> logs
│   │   ├── presenters.py       dataclasses -> API JSON
│   │   ├── serializers.py      input validation
│   │   ├── views.py / urls.py  DRF endpoints
│   │   ├── models.py           Trip (persists inputs + plan JSON for permalinks)
│   │   └── tests/              engine, geometry and API tests (pytest)
│   ├── Dockerfile              container image (Railway / Fly.io / Render docker)
│   └── requirements*.txt
├── frontend/                   Vite + React + Material UI
│   └── src/
│       ├── theme.js            MUI theme + design tokens (from the Stitch design system)
│       ├── api/client.js       fetch wrapper (ApiError carries status + backend error code)
│       ├── hooks/              useTripPlan (request lifecycle), useRecentTrips
│       ├── components/layout/  AppShell (AppBar, HOS rules dialog), Sidebar (form / recent / clocks)
│       ├── components/common/  SectionCard, StatTile, StatusChip
│       ├── features/trip/      TripForm, TripSummary, TripResults, PermalinkBar, PlanningStatus,
│       │                       WelcomePanel, ErrorPanel, FleetContext, RecentTrips, errorInfo.js
│       ├── features/map/       RouteMap (Leaflet)
│       ├── features/schedule/  ScheduleTable (table / visual rail, day filter, CSV), scheduleUtils.js
│       ├── features/logsheets/ LogSheetList (day filter, print, CSV), LogSheet, LogGrid (SVG),
│       │                       logGridGeometry.js (pure path maths)
│       ├── utils/              format.js, csv.js
│       ├── pages/              TripPlannerPage (/, /trips/:id?tab=map|schedule|logs)
│       └── test/               Vitest setup + a real-data plan fixture
├── docs/stitch-prompts.md      the design prompts the UI was built from
├── render.yaml                 Render blueprint for the API
└── README.md
```

---

## Running locally

Prerequisites: Python 3.12+, Node 20+.

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate     # or: uv venv && source .venv/bin/activate
pip install -r requirements-dev.txt                    # or: uv pip install -r requirements-dev.txt
cp .env.example .env                                   # optional; defaults work
python manage.py migrate
python manage.py runserver 8000
```

API is now at `http://localhost:8000/api/`.

### Frontend

```bash
cd frontend
npm install
npm run dev                                            # http://localhost:5173
```

In development Vite proxies `/api/*` to `http://localhost:8000`, so no `.env` is needed.

### Tests

```bash
cd backend && pytest            # 497 tests: one forcing scenario per HOS rule, edge cases,
                                # rolling 8-day window, daily-log slicing, geometry, API,
                                # cross-view consistency, 400 fuzzed random trips replayed
                                # through an independent compliance checker
cd frontend && npm test         # 49 Vitest tests: log-grid geometry, CSV, formatting, error
                                # mapping, form validation/payload, request sequencing,
                                # LogSheet / ScheduleTable rendering, cross-view consistency
                                # on a real 6-day plan fixture
cd frontend && npm run lint && npm run build
```

`backend/trips/tests/test_assessment_requirements.py` is the requirement-by-requirement suite:
each test constructs a trip that forces exactly one rule to bind and asserts where/when it did,
and every schedule is replayed through an independent compliance checker.

---

## API

| Method | Path                | Purpose                                              |
| ------ | ------------------- | ---------------------------------------------------- |
| GET    | `/api/health/`      | Liveness check                                       |
| POST   | `/api/trips/`       | Plan a trip (geocode → route → HOS → logs) and save  |
| GET    | `/api/trips/`       | 20 most recent trips (summary rows)                  |
| GET    | `/api/trips/{id}/`  | Full saved plan (used by the `/trips/:id` permalink) |

### `POST /api/trips/`

```json
{
  "current_location": "Chicago, IL",
  "pickup_location": "Joliet, IL",
  "dropoff_location": "Dallas, TX",
  "current_cycle_used_hours": 12,
  "start_time": "2026-09-21T06:00"        // optional, naive local time; defaults to now
}
```

Response (`201`), abbreviated:

```json
{
  "id": 1,
  "inputs": { ... },
  "locations": { "current": {"display_name", "lat", "lon"}, "pickup": ..., "dropoff": ... },
  "route": {
    "distance_miles": 930.5, "duration_hours": 17.54, "raw_duration_hours": 17.54,
    "legs": [{"name": "to_pickup", ...}, {"name": "to_dropoff", ...}],
    "geometry": {"type": "LineString", "coordinates": [[lon, lat], ...]}
  },
  "schedule": {
    "start_time": "2026-09-21T06:00", "end_time": "2026-09-22T12:02",
    "events": [
      {"status": "driving", "type": "drive", "start": "...", "end": "...", "duration_hours": 1.05,
       "start_miles": 0, "end_miles": 44.5, "leg": "to_pickup", "location": {"lat", "lon"}, ...},
      {"status": "on_duty", "type": "pickup", ...},
      {"status": "off_duty", "type": "break", ...},
      {"status": "sleeper_berth", "type": "rest", ...}
    ],
    "stops": [ ...non-driving events only, for map markers... ],
    "summary": {"driving_hours", "on_duty_hours", "off_duty_hours", "sleeper_berth_hours",
                "total_hours", "total_miles", "total_days", "fuel_stops", "breaks", "rests",
                "restarts", "cycle_used_at_start", "cycle_used_at_end"}
  },
  "daily_logs": [
    {"date": "2026-09-21", "day_number": 1, "miles_driven": 579.1,
     "totals": {"off_duty": 6.5, "sleeper_berth": 5.5, "driving": 11.0, "on_duty": 1.0},
     "recap": {"on_duty_hours_today": 12.0, "cycle_used_at_end_of_day": 24.0,
               "hours_available_tomorrow": 46.0, "cycle_limit_hours": 70},
     "entries": [{"status", "type", "label", "start", "end", "start_minute", "end_minute",
                  "start_miles", "end_miles", "location", "cycle_used_at_end"}, ...]}
  ]
}
```

Duty statuses: `off_duty`, `sleeper_berth`, `driving`, `on_duty`.
Event types: `drive`, `pickup`, `dropoff`, `fuel`, `break`, `rest`, `restart`, `pre_trip`, `post_trip`.

Errors: `400` validation, `422` with `code` = `geocoding_failed` / `routing_failed` /
`hos_planning_failed`, `502` with `code` = `upstream_unavailable` when OSRM/Nominatim are down.

---

## HOS rule engine

`backend/trips/hos/` is plain Python with no Django imports, so it can be tested and reused on
its own. `HOSEngine.plan()` simulates the driver through the two driving legs and inserts the
stops the rules demand, producing a contiguous list of `DutyEvent`s. `build_daily_logs()` then
slices that timeline at midnight into 24-hour sheets, padding the first/last day with off-duty
time so every sheet totals exactly 24 h.

Rules applied (49 CFR §395.3, property-carrying, no adverse-conditions or short-haul exceptions):

| Rule                                     | Implementation                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| 11-hour driving limit                    | Driving stops at 11 h since the last 10-h reset → 10 h sleeper berth            |
| 14-hour on-duty window                   | Window opens at first on-duty activity; no driving past its end → 10 h rest    |
| 30-minute break after 8 h driving        | Off-duty 30 min. Any ≥30-min non-driving period (pickup, fuel) also satisfies it |
| 10 consecutive hours off duty            | Resets the 11-h and 14-h clocks (logged as sleeper berth)                       |
| 70 h / 8 days cycle                      | Driving + on-duty hours; when exhausted → 34 h off-duty restart                 |
| 34-hour restart                          | Zeroes the cycle and all daily clocks                                           |
| Fuel every 1,000 miles                   | 30-min on-duty stop, exactly at each 1,000-mile mark since the last fill        |
| Pickup / drop-off                        | 1 h on-duty (not driving) each                                                  |

The tests (`trips/tests/test_hos_engine.py`) include an independent `assert_compliant()`
checker that replays any schedule and fails on a violation of the limits above, plus scenario
tests for each rule and a parametrised set of sample trips (local day trip, Chicago→Dallas,
coast-to-coast with a tired driver, cycle nearly exhausted, ...).

---

## Map / routing choice: OSRM + Nominatim

| Need       | Service                                      | Why                                                                                                                                                   |
| ---------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Geocoding  | **Nominatim** (nominatim.openstreetmap.org)  | Free, no API key or account. Returns display names + coordinates. Policy: 1 req/s and a descriptive `User-Agent` — both enforced in `geocoding.py`. Results cached 7 days. |
| Routing    | **OSRM** demo server (router.project-osrm.org) | Free, no key. One request gives per-leg distance/duration **and** the full GeoJSON route geometry, which lets the backend place fuel/rest stops at the exact odometer mile along the line. Results cached 24 h. |
| Map tiles  | **OpenStreetMap** standard tiles via Leaflet | Free for light use, no key.                                                                                                                             |

Trade-offs: both public servers are best-effort with fair-use limits (fine for a demo, not for
production traffic). Both are open source and self-hostable; the base URLs are environment
variables (`OSRM_BASE_URL`, `GEOCODER_BASE_URL`) so swapping to a self-hosted instance or to
OpenRouteService (which would need a free API key/account) is a config change. The API returns
`422`/`502` with a clear message if either service fails.

---

## Assumptions beyond the brief

- **Driver starts fresh.** At `start_time` the driver has already had ≥10 consecutive hours
  off; only the "current cycle used" figure carries over. The 11-h / 14-h clocks start at zero.
- **Cycle hours supplied have no per-day history.** They are treated conservatively: they never
  "age out" of the 8-day window and only clear with a 34-hour restart. Hours accrued during the
  trip *are* tracked per calendar day, so on a >8-day trip old days drop off correctly.
- **No split-sleeper-berth.** Every daily reset is a single 10-hour sleeper-berth period.
  30-minute breaks are logged off duty; the 34-hour restart is logged off duty.
- **Conservative on-duty scheduling.** Legally only *driving* is barred after the 14th hour /
  70th cycle hour, but the planner also keeps pickup, drop-off and fuel stops inside those
  limits — if they do not fit, the rest comes first. This never produces a log that *looks*
  like a violation.
- **Break skipped when a rest is imminent.** If after a 30-minute break fewer than 15 minutes
  of legal driving would remain, the planner goes straight to the 10-hour rest.
- **Restart taken directly when unavoidable.** If a 10-hour rest is due, fewer than 2 cycle hours
  remain and the rest of the trip cannot fit in them, the planner takes the 34-hour restart
  immediately rather than rest → a sliver of work → restart (the restart also satisfies the
  rest, so the plan is never longer).
- **Full tank at departure.** Fuel stops are scheduled at exactly 1,000 / 2,000 / … trip miles;
  each takes 30 minutes on duty and also counts as the 30-minute break.
- **Constant speed within a leg.** Each leg's average speed = OSRM distance ÷ duration. OSRM's
  `driving` profile models a car, so legs faster than `TRUCK_MAX_AVERAGE_SPEED_MPH` (default
  60) are slowed to that speed. The raw OSRM duration is returned alongside.
- **Times are the driver's home-terminal wall clock.** All datetimes are naive local times; the
  frontend sends the departure time without a UTC offset. Log sheets run 00:00–24:00 local.
- **Intermediate stop locations are interpolated** along the route polyline (scaled to the
  road distance). Pickup/drop-off use the exact geocoded coordinates. Stops are described by
  odometer mile + coordinates rather than city names (reverse-geocoding each stop would add
  ~1 s per stop under Nominatim's rate limit).
- **Trips are persisted** (SQLite locally, Postgres via `DATABASE_URL`) purely to support
  permalinks (`/trips/:id`); no authentication. After changing the engine or the API shape, run
  `python manage.py replan_trips` to rewrite stored results in place (ids/permalinks kept).
- **Per-day "From / To"** on a log sheet names the origin, pickup or destination when the day
  starts/ends there, otherwise the route mile (`En route · mi 497.8`) because intermediate points
  are not reverse-geocoded.

---

## Deployment

### Backend → Render (free tier)

`render.yaml` at the repo root is a Render Blueprint. In Render: **New → Blueprint**, point at
the GitHub repo, and it creates the `eld-trip-planner-api` web service (Python runtime,
`rootDir: backend`, migrations run as a pre-deploy step, health check on `/api/health/`).
Then set:

- `CORS_ALLOWED_ORIGINS` → your Vercel URL (e.g. `https://eld-trip-planner.vercel.app`).
  Every `*.vercel.app` preview is already allowed by regex.
- `DJANGO_ALLOWED_HOSTS` is extended automatically with `RENDER_EXTERNAL_HOSTNAME`.
- Optional: uncomment the `databases:` block and `DATABASE_URL` for persistent Postgres
  (free-tier SQLite resets on each deploy — acceptable for a demo).

**Railway / Fly.io alternative:** `backend/Dockerfile` runs migrations then gunicorn and honours
`$PORT`. Set `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=false`, `DJANGO_ALLOWED_HOSTS=<your-host>`,
`CORS_ALLOWED_ORIGINS=<vercel-url>`.

### Frontend → Vercel

Import the repo in Vercel with **Root Directory = `frontend`** (framework auto-detects Vite;
`frontend/vercel.json` adds the SPA rewrite so `/trips/:id` deep links work). Add one
environment variable:

```
VITE_API_BASE_URL=https://<your-backend-host>
```

Redeploy after the backend URL is known, then paste the Vercel URL into the backend's
`CORS_ALLOWED_ORIGINS`.

### Environment variables (backend)

| Variable                         | Default                                | Notes                              |
| -------------------------------- | -------------------------------------- | ---------------------------------- |
| `DJANGO_SECRET_KEY`              | insecure dev key                       | required in production             |
| `DJANGO_DEBUG`                   | `true`                                 | set `false` in production          |
| `DJANGO_SECURE_SSL_REDIRECT`     | `true` (when DEBUG is false)           | set `false` behind an HTTPS-terminating edge (Render/Railway/Fly); `/api/health/` is always exempt |
| `DJANGO_ALLOWED_HOSTS`           | `localhost,127.0.0.1`                  | comma-separated                    |
| `CORS_ALLOWED_ORIGINS`           | `http://localhost:5173,...`            | comma-separated                    |
| `CORS_ALLOWED_ORIGIN_REGEXES`    | `^https://.*\.vercel\.app$`            |                                    |
| `DATABASE_URL`                   | SQLite                                 | any `dj-database-url` URL          |
| `GEOCODER_BASE_URL`              | `https://nominatim.openstreetmap.org`  |                                    |
| `GEOCODER_USER_AGENT`            | `eld-trip-planner/0.1 ...`             | Nominatim policy: identify the app |
| `GEOCODER_COUNTRY_CODES`         | `us`                                   | bias results; blank to disable     |
| `OSRM_BASE_URL`                  | `https://router.project-osrm.org`      |                                    |
| `TRUCK_MAX_AVERAGE_SPEED_MPH`    | `60`                                   | cap on OSRM car speeds             |
| `EXTERNAL_REQUEST_TIMEOUT_SECONDS` | `20`                                 |                                    |

---

## Frontend architecture

Data flow is `TripPlannerPage → useTripPlan (hook) → api/client.js`. The page owns routing state
(`/trips/:id`, `?tab=`), maps API errors onto form fields (`features/trip/errorInfo.js`) and
renders one of four main-panel states: welcome, planning (stepper + skeletons), error, results.
Everything below is presentational and receives plain data:

- `Sidebar` — console header, **New trip / Recent trips** tabs, and **Driver clocks** (11 h / 14 h /
  70 h remaining, from the API's `driving_hours_remaining` etc. once a plan exists). Collapses to
  accordions under 900 px.
- `TripForm` — the four inputs + optional departure, with field-level error pinning.
- `TripResults` — permalink bar, `TripSummary` (12 stat tiles), then Map · Schedule · Log sheets tabs.
- `ScheduleTable` — table or vertical "visual rail", day filter, day-divider rows, CSV export.
- `LogSheetList` → `LogSheet` → `LogGrid` (SVG). All coordinate math lives in
  `logGridGeometry.js` (pure functions). Each sheet mirrors the paper Driver's Daily Log: header
  facts plus the blank carrier / terminal / truck / shipping-document / signature lines, the
  Midnight→Noon→Midnight grid with quarter-hour ticks and a Total Hours column, remarks per duty
  change, and the 70-hour recap (A on duty today, B last 8 days, C available tomorrow). Print / PDF
  uses `window.print()`; `@media print` CSS hides the app shell and lays out one sheet per landscape
  Letter page.
- Duty-status / event colours, labels and chip palettes live in `src/constants/dutyStatus.js`;
  theme tokens in `src/theme.js`.

Styling is MUI-only (theme overrides + `sx`); `src/index.css` holds Leaflet popup and print rules.
