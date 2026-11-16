# Live transit map

The dashboard's map shows every TransLink vehicle that reports a position, colored by how late it
is, refreshed every 30 seconds. Clicking a vehicle opens its details; picking a stop highlights the
stop, the routes serving it and the vehicles on those routes.

## How it fits together

```
TransLink GTFS-realtime ──► backend/main.py ──► GET /vehicles, /alerts, /transit, ...
  (positions, trip updates,    (30s cache per feed)          │
   alerts; needs API key)                                    ▼
                                                    frontend (React + MapLibre)
TransLink GTFS static zip ──► scripts/build_static_data.py
  (weekly schedule)             └─► backend/data/*.json ──► loaded once at startup
```

The realtime feeds only carry ids. Names, colors, coordinates, headsigns and route shapes come from
the static schedule, which is pre-processed into small JSON files so the API never parses the
100 MB schedule at request time.

### Backend

| File | Role |
|---|---|
| `backend/main.py` | FastAPI app: feed fetching and caching, all endpoints. |
| `backend/static_data.py` | Loads `backend/data/*.json` into memory at startup (`StaticData`). |
| `backend/scripts/build_static_data.py` | Downloads the GTFS static zip and writes the JSON files. |
| `backend/stop_search.py` | Free-text and stop-code search over stop names. |

`get_feed(name)` keeps one parsed copy of each GTFS-realtime feed for 30 seconds, so any number of
requests cost TransLink at most one call per feed every 30 seconds.

`/vehicles` joins three sources: positions (`gtfsposition`), delays (`gtfsrealtime` trip updates,
matched by trip id, using the stop the vehicle is heading to) and static data (route, headsign,
next-stop name). A vehicle whose trip has no trip update gets `delaySeconds: null`.

### Frontend

| File | Role |
|---|---|
| `src/components/TransitMap.tsx` | The map card: MapLibre map, sources and layers, hover and click handling. |
| `src/components/map/VehicleLayers.tsx` | The vehicle source and its two layers; re-renders per animation frame. |
| `src/components/map/VehicleDetailsPanel.tsx` | Details for the selected vehicle (side panel, or bottom sheet on phones). |
| `src/components/map/RouteFilter.tsx` | Multi-select that limits the map to chosen routes. |
| `src/components/map/RouteAlerts.tsx` | Service alerts for the selected vehicle's route. |
| `src/components/map/LiveIndicator.tsx`, `MapLayerToggles.tsx`, `LayerHint.tsx`, `MapLegend.tsx`, `MapControls.tsx`, `SelectedStopChip.tsx` | The floating overlays. |
| `src/components/map/delayStatus.ts` | Delay thresholds and colors, shared by the layer paint, the legend and the panel. |
| `src/components/map/mapConfig.ts` | Style URL, intervals, zoom levels, colors, source and layer ids. |
| `src/stores/useMapStore.ts` | All map state (Zustand) and the fetch actions. |
| `src/hooks/useVehiclePolling.ts` | 30s polling, paused while the browser tab is hidden. |
| `src/hooks/useAnimatedVehicles.ts` | Glides vehicles from their old position to the new one over 2s. |
| `src/hooks/useServiceAlerts.ts` | Loads alerts and refreshes them every 5 minutes. |

Things worth knowing before changing the map:

- **Vehicles are one GeoJSON source with a circle layer**, not one React marker each. Color, size,
  fading and the route filter are MapLibre expressions, so restyling ~1,000 vehicles never touches
  React. Only the single highlighted stop uses a `<Marker>`.
- **Draw order is fixed** by always mounting every source (empty until needed): route network,
  highlighted routes, stops, vehicles.
- **Map state lives in `useMapStore`**, separate from `useTransitStore`, because the older dashboard
  components subscribe to that store as a whole and would re-render on every vehicle refresh. The
  backend URL and demo-mode switch are still read from `useTransitStore`.
- **Stop selection** is driven by `useTransitStore.setSelectedStop` (search box, popular stations, or
  clicking a stop on the map). It bumps `stopSelectionCount`; the map reacts by calling
  `useMapStore.showStop`.
- **Stops and the route network are fetched on first use**: stops once the layer is on and the map is
  at zoom 14 or closer, the network when the Routes toggle is first switched on.
- **Demo mode** shows ten mock vehicles (`mockVehicles.ts`) and makes no vehicle or alert requests.
- **Reduced motion**: with `prefers-reduced-motion`, vehicles snap to new positions and MapLibre
  skips fly-to animations.

Base map: OpenFreeMap's dark style (`https://tiles.openfreemap.org/styles/dark`), no API key. The
OpenStreetMap attribution must stay visible.

## Endpoints

All are `GET`. Stop parameters accept either the public stop code (the number on the sign, e.g.
`50915`) or the GTFS `stop_id`. Route parameters take the GTFS `route_id` (e.g. `6641`), not the
public route number (`099`).

| Endpoint | Returns |
|---|---|
| `/vehicles?route_id=` | GeoJSON FeatureCollection of every active vehicle. Properties: `vehicleId`, `label`, `routeId`, `routeShortName`, `routeLongName`, `routeColor`, `routeTextColor`, `tripId`, `headsign`, `bearing`, `speed`, `timestamp`, `delaySeconds`, `status` (`ON_TIME` / `LATE` / `EARLY` / null), `nextStopId`, `nextStopName`. |
| `/alerts?route_id=` | Service alerts in effect now, most severe first, with the routes and stops each affects. |
| `/stops` | GeoJSON FeatureCollection of every boardable stop (for the Stops layer). |
| `/stops/search?q=&limit=` | Up to `limit` (default 10) stops matching a name or stop code. |
| `/stops/{stop_id}` | One stop's details plus the routes serving it. |
| `/routes` | Every route: id, short name, long name, colors, type. |
| `/routes/shapes` | GeoJSON FeatureCollection of every route's lines (for the Routes layer). |
| `/routes/{route_id}/shape` | GeoJSON FeatureCollection of one route's lines. |
| `/transit/{station_id}` | Realtime arrival estimates at one stop. |
| `/metrics/dashboard/{station_id}` | System metrics, departures and leaderboard for the dashboard. |
| `/debug/active-stops` | System-wide feed statistics. |

Feed errors map to `504` (TransLink timed out) or `502` (TransLink unreachable); unknown stops and
routes return `404`.

## Regenerating the static data

TransLink republishes the schedule about once a week. To refresh:

```bash
python backend/scripts/build_static_data.py
# or, from a zip you already have:
python backend/scripts/build_static_data.py --zip path/to/google_transit.zip
```

Then restart the API. The script takes a few seconds and writes about 6 MB into `backend/data/`
(git-ignored):

| File | Contents |
|---|---|
| `stops.json` | Boardable stops: id, code, name, lat, lon. |
| `routes.json` | Routes: id, short and long name, colors, type. |
| `trips_index.json` | `trip_id → [route_id, headsign, direction_id, shape_id]`. |
| `route_shapes.json` | `shapes` (`shape_id →` simplified line) and `routes` (`route_id →` shape ids, busiest first). |
| `stop_routes.json` | `stop_id →` route ids serving it. |
| `meta.json` | Feed version, build time, counts. |

If the files are missing when the API starts (a fresh clone), it builds them automatically. When
they are more than 7 days old it logs a reminder; it does not refresh them on its own.

## Configuration

`backend/.env` (git-ignored; copy from `backend/.env.example`):

```
TRANSLINK_API_KEY=your_key_here
```

The key is only ever read from this variable.

## Known limits of the data

- TransLink's position feed currently contains buses only: no SkyTrain, SeaBus or West Coast Express.
- It reports neither bearing nor speed, so there are no direction arrows and no speed row.
- Roughly 1 vehicle in 8 has no trip update and is drawn gray ("No data").
- Only a handful of routes have a color (rail, RapidBus, the 99); the rest use default colors.
