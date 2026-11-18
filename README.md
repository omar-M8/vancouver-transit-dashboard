# Vancouver Transit Dashboard

Live departures, delays and vehicle positions for Metro Vancouver's TransLink network.

The dashboard combines TransLink's GTFS-Realtime feeds with the published GTFS static schedule to
show where every bus and train is right now, how late it is, and what's arriving at any stop.

## Features

- **Live transit map.** Every vehicle that reports a position, colored by delay and refreshed every
  30 seconds. Vehicles glide smoothly between updates.
- **Vehicle details.** Click a vehicle to see its route, headsign, next stop, delay and any service
  alerts on that route.
- **Stop search.** Find stops by name or stop code (for example, "49th and fraser" or "50915").
  Search ignores word order and tolerates small typos.
- **Station board.** Upcoming arrivals and delays for a selected stop, with the stop, the routes
  serving it and their vehicles highlighted on the map.
- **Network metrics.** Punctuality, average delay and active trips across the system, plus a route
  punctuality leaderboard.
- **Service alerts.** Alerts in effect right now, most severe first, filterable by route.
- **Backend explorer.** A tab in the app for calling the API directly.

## Tech stack

| Layer    | Technologies                                                         |
| -------- | -------------------------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, Mantine, MapLibre GL (react-map-gl), Zustand |
| Backend  | Python, FastAPI, httpx, gtfs-realtime-bindings, RapidFuzz             |
| Data     | TransLink GTFS-Realtime API (v3), TransLink GTFS static schedule      |
| Hosting  | Vercel (Services: one project for frontend and backend)              |

## How it works

```
TransLink GTFS-Realtime ──► backend/main.py ──► GET /vehicles, /alerts, /transit, ...
  (positions, trip updates,   (30s cache per feed)          │
   alerts; needs API key)                                   ▼
                                                   frontend (React + MapLibre)
TransLink GTFS static zip ──► scripts/build_static_data.py
  (weekly schedule)             └─► backend/data/*.json ──► loaded once at startup
```

The realtime feeds carry only IDs. Names, colors, coordinates, headsigns and route shapes come from
the static schedule, which is pre-processed into small JSON files so the API never parses the full
schedule at request time. Each realtime feed is cached for 30 seconds, so the backend calls
TransLink at most once per feed every 30 seconds, however much traffic it gets.

For a detailed walkthrough of the map, see [docs/live-map.md](docs/live-map.md).

## Project structure

```
.
├── backend/
│   ├── main.py                  # FastAPI app: feed fetching, caching and all endpoints
│   ├── static_data.py           # Loads backend/data/*.json into memory at startup
│   ├── stop_search.py           # Free-text and stop-code search
│   ├── scripts/
│   │   └── build_static_data.py # Downloads GTFS static and writes backend/data/
│   └── data/                    # Generated static lookups (committed)
├── frontend/
│   └── src/
│       ├── components/          # Dashboard UI and map/ components
│       ├── hooks/               # Polling, animation and alerts hooks
│       ├── stores/              # Zustand stores
│       └── types/
├── docs/
│   └── live-map.md              # Map architecture notes
└── vercel.json                  # Vercel Services configuration
```

## Getting started

### Prerequisites

- Python 3.10 or later
- Node.js 20 or later and npm
- A free [TransLink API key](https://www.translink.ca/about-us/doing-business-with-translink/app-developer-resources)

### 1. Run the backend

From the repository root:

```bash
cp backend/.env.example backend/.env   # then set TRANSLINK_API_KEY
python -m venv backend/venv
backend/venv/bin/pip install -r backend/requirements.txt
backend/venv/bin/uvicorn backend.main:app --port 8000 --reload
```

The API is now at `http://localhost:8000`, with interactive docs at
[`http://localhost:8000/docs`](http://localhost:8000/docs).

### 2. Run the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

### Environment variables

| Variable            | Where      | Required | Description                                                                                       |
| ------------------- | ---------- | -------- | ------------------------------------------------------------------------------------------------- |
| `TRANSLINK_API_KEY` | `backend/.env` | Yes  | Key for the TransLink GTFS-Realtime API.                                                          |
| `VITE_API_URL`      | `frontend/.env` | No  | Backend base URL. Defaults to `http://localhost:8000` in development and `/api` in production builds. |

## API reference

All endpoints return JSON. In production they are served under `/api` (for example, `/api/vehicles`).

| Method | Endpoint                          | Description                                                        |
| ------ | --------------------------------- | ------------------------------------------------------------------ |
| GET    | `/`                               | Health check.                                                      |
| GET    | `/stops`                          | All stops.                                                         |
| GET    | `/stops/search?q=&limit=`         | Search stops by name or stop code.                                 |
| GET    | `/stops/{stop_id}`                | A single stop.                                                     |
| GET    | `/routes`                         | All routes.                                                        |
| GET    | `/routes/shapes`                  | Shapes for every route, as GeoJSON.                                |
| GET    | `/routes/{route_id}/shape`        | Shape for one route, as GeoJSON.                                   |
| GET    | `/transit/{station_id}`           | Live arrival estimates for a stop (stop code or stop ID).          |
| GET    | `/metrics/dashboard/{station_id}` | Delay and punctuality metrics for a stop.                          |
| GET    | `/alerts?route_id=`               | Service alerts in effect now, most severe first.                   |
| GET    | `/vehicles?route_id=`             | Active vehicles as a GeoJSON FeatureCollection.                    |
| GET    | `/debug/active-stops`             | Network-wide stats: broadcasting stops, punctuality, average delay. |

`route_id` is the GTFS route ID (for example, `6641` for the 99 B-Line), not the public route
number. See the interactive docs at `/docs` for full request and response schemas.

## Refreshing the static data

TransLink publishes a new GTFS static schedule weekly. `backend/data/` is committed to the repo
because Vercel cannot build it at startup, so refresh it by hand:

```bash
backend/venv/bin/python backend/scripts/build_static_data.py
git add backend/data
git commit -m "chore: refresh GTFS static data"
```

Pass `--zip path/to/google_transit.zip` to build from a local file instead of downloading. The
backend logs a warning at startup when the data is more than a week old.

## Deployment

The frontend and backend deploy together as a single Vercel project using
[Vercel Services](https://vercel.com/docs). The site is served at `/`, and `/api/*` is routed to
FastAPI with the `/api` prefix stripped (see [vercel.json](vercel.json)).

1. Import the GitHub repository in Vercel and leave the Root Directory at the repository root.
2. In **Settings → Environment Variables**, set `TRANSLINK_API_KEY`.
3. Deploy. Every push to `main` triggers a production deployment.

## Development

```bash
cd frontend
npm run lint     # ESLint
npm run build    # Type-check and build for production
```

## Acknowledgements

Transit data is provided by [TransLink](https://www.translink.ca/) through its open data program.
This project is not affiliated with or endorsed by TransLink.
