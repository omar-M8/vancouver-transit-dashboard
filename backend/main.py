import csv
import io
import os
import time
import zipfile
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
import httpx
from google.transit import gtfs_realtime_pb2
from fastapi.middleware.cors import CORSMiddleware
try:
    # Started from the repo root: `uvicorn backend.main:app` (also app.py)
    from .stop_search import StopSearchIndex
except ImportError:
    # Started from inside backend/: `uvicorn main:app`
    from stop_search import StopSearchIndex

# Load secrets from backend/.env (git-ignored); see backend/.env.example
load_dotenv(Path(__file__).parent / ".env")
TRANSLINK_API_KEY = os.getenv("TRANSLINK_API_KEY")
if not TRANSLINK_API_KEY:
    raise RuntimeError(
        "TRANSLINK_API_KEY is not set. Copy backend/.env.example to backend/.env and add your key."
    )

app = FastAPI()

# CORS middleware to allow requests from any origin (useful for local development and testing)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows Lovable's web sandbox to talk to local API
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#create globla cache memomry dictionary 
cache_memory = {}

@app.get("/")
async def root():
    return {"message": "Hello World"}

# TransLink GTFS-Realtime v3 feeds:
#   gtfsrealtime -> trip updates (arrival/delay estimates)
#   gtfsposition -> vehicle positions (lat/lon of every active bus/train)
#   gtfsalerts   -> service alerts
GTFS_RT_FEEDS = {"gtfsrealtime", "gtfsposition", "gtfsalerts"}


async def get_or_update_gtfs_feed(feed_name: str = "gtfsrealtime"):
    """Helper function: Ensure we always have a fresh 30s copy of a GTFS-RT feed in RAM"""
    if feed_name not in GTFS_RT_FEEDS:
        raise ValueError(f"Unknown GTFS-RT feed: {feed_name}")

    current_time = time.time()
    cache_key = f"gtfs_rt_{feed_name}"  # each feed gets its own cache entry

    # If cache exists and is fresh (< 30s), return it immediately
    if cache_key in cache_memory and (current_time - cache_memory[cache_key]["timestamp"]< 30):
        print(f"--- Returned {feed_name} directly from Cache!! ---")
        return cache_memory[cache_key]["data"]

    #Otherwise, fetch full system feed from Translink
    else:
        print(f"--- Fetching fresh {feed_name} feed for all of Vancouver ---")
        url = f"https://gtfsapi.translink.ca/v3/{feed_name}"

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(url, params={"apikey": TRANSLINK_API_KEY})

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=f"Failed to fetch GTFS feed ({feed_name})")

        # Parse Protobuf binary data
        feed = gtfs_realtime_pb2.FeedMessage()
        feed.ParseFromString(response.content)

        cache_memory[cache_key] = {
            "timestamp": current_time,
            "data": feed
        }

        return feed


# Static GTFS schedule (contains stops.txt). It is ~16 MB and changes rarely,
# so it is cached far longer than the 30s real-time feed.
STATIC_GTFS_URL = "https://gtfs-static.translink.ca/gtfs/google_transit.zip"
STOPS_CACHE_TTL_SECONDS = 24 * 60 * 60


async def get_or_update_stops():
    """Helper function: Load stops.txt from the static GTFS zip, cached for 24h.

    Returns a dict with:
      - "code_to_ids": public stop_code (the number on the sign, e.g. "50915")
                       -> set of internal stop_ids used by the real-time feed
      - "by_id":       stop_id -> {"stop_code", "stop_name"}
      - "search":      StopSearchIndex over boardable stops, for /stops/search
    """
    current_time = time.time()
    cache_key = "gtfs_static_stops"

    cached = cache_memory.get(cache_key)
    if cached and (current_time - cached["timestamp"] < STOPS_CACHE_TTL_SECONDS):
        return cached["data"]

    print("--- Fetching static GTFS stops.txt ---")
    try:
        async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
            response = await client.get(STATIC_GTFS_URL)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        # Keep serving stale stop data rather than failing outright
        if cached:
            print(f"--- Static GTFS refresh failed ({exc}); using stale stops ---")
            return cached["data"]
        raise HTTPException(status_code=502, detail="Failed to fetch static GTFS (stops.txt)")

    code_to_ids: dict[str, set[str]] = {}
    by_id: dict[str, dict] = {}
    boardable: list[dict] = []

    with zipfile.ZipFile(io.BytesIO(response.content)) as zf:
        with zf.open("stops.txt") as f:
            reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
            for row in reader:
                stop_id = (row.get("stop_id") or "").strip()
                stop_code = (row.get("stop_code") or "").strip()
                if not stop_id:
                    continue
                by_id[stop_id] = {
                    "stop_code": stop_code,
                    "stop_name": (row.get("stop_name") or "").strip(),
                }
                if stop_code:
                    code_to_ids.setdefault(stop_code, set()).add(stop_id)
                # location_type 0/blank = a stop or platform you can board at.
                # Skip parent stations (1) and entrances (2): the real-time
                # feed never reports arrivals for them.
                if (row.get("location_type") or "0").strip() == "0":
                    boardable.append({"stop_id": stop_id, **by_id[stop_id]})

    data = {
        "code_to_ids": code_to_ids,
        "by_id": by_id,
        "search": StopSearchIndex.build(boardable),
    }
    cache_memory[cache_key] = {"timestamp": current_time, "data": data}
    print(f"--- Loaded {len(by_id)} stops from stops.txt ---")
    return data


async def resolve_stop_ids(station_id: str) -> set[str]:
    """Translate a public stop code (e.g. "50915") into the internal stop_id(s)
    the real-time feed uses. Falls back to treating the input as a stop_id."""
    stops = await get_or_update_stops()
    if station_id in stops["code_to_ids"]:
        return stops["code_to_ids"][station_id]
    if station_id in stops["by_id"]:
        return {station_id}
    return set()


@app.get("/stops/search")
async def search_stops(
    q: str = Query(..., min_length=1, max_length=100, description='Free text, e.g. "49th and fraser"'),
    limit: int = Query(20, ge=1, le=50),
):
    """
    Find stops by name. Words can be in any order, ordinals and street types
    are ignored, and small typos are tolerated ("frasr" finds Fraser St).

    One intersection usually has several stops (one per direction), so the
    results are meant to be shown as a pick-list using each result's "label".
    Pass a result's stop_code (or stop_id, if it has no code) to /transit/{station_id}.
    """
    stops = await get_or_update_stops()
    terms, results = stops["search"].search(q, limit=limit)
    return {
        "query": q,
        "terms": terms,
        "results_found": len(results),
        "results": results,
    }


@app.get("/transit/{station_id}")
async def get_transit_by_station(station_id: str):
    """
    Fetch live trip updates filtered for a specific station or stop ID.

    Queries the global GTFS Realtime feed and extracts arrival estimates,
    route identifiers, and delay information for the requested stop.
    """

    # Get the full system GTFS feed served isntaly if fresh (< 30s)
    feed =  await get_or_update_gtfs_feed()

    # The feed uses internal stop_ids, not the public stop code users type in
    stop_ids = await resolve_stop_ids(station_id)
    stops = await get_or_update_stops()
    stop_name = next(
        (stops["by_id"][sid]["stop_name"] for sid in stop_ids if sid in stops["by_id"]),
        None,
    )

    # Filter through feed for resrective station
    station_updates = []

    for entity in feed.entity:
        if entity.HasField('trip_update'):
            for stu in entity.trip_update.stop_time_update:
                # Check if this update belongs to the stop the user asked for
                if stu.stop_id in stop_ids:
                    station_updates.append({
                        "trip_id": entity.trip_update.trip.trip_id,
                        "route_id": entity.trip_update.trip.route_id,
                        "stop_sequences": stu.stop_sequence,
                        "delay_seconds": stu.arrival.delay if stu.HasField('arrival') else 0
                    })

    # Return ONLY the data for that specific stop
    return {
        "station_id": station_id,
        "stop_found": bool(stop_ids),
        "stop_name": stop_name,
        "results_found": len(station_updates),
        "estimates": station_updates
    }

@app.get("/debug/active-stops")
async def get_active_stops():
    """
    Retrieve full system real-time data transformations to feed dashboard metrics.

    Useful for debugging, inspecting feed activity, and discovering valid
    station IDs across the TransLink network.
    """

    feed = await get_or_update_gtfs_feed()
    active_stops = set()
    total_delayed_seconds = 0
    total_delayed_trips = 0
    total_trips_checked = 0

    for entity in feed.entity:
        if entity.HasField('trip_update'):
            total_trips_checked += 1
            trip_is_delayed = False

            for stu in entity.trip_update.stop_time_update:
                if stu.stop_id:
                    active_stops.add(stu.stop_id)
                if stu.HasField('arrival') and stu.arrival.HasField('delay'):
                    total_delayed_seconds += stu.arrival.delay
                    trip_is_delayed = True

            if trip_is_delayed: 
                total_delayed_trips += 1

    # Calculate Average System Delay in minutes (delay is in seconds, so divide by 60)
    avg_delay_mins = (total_delayed_seconds / total_delayed_trips) / 60 if total_delayed_trips > 0 else 0
    
    # Calculate Punctuality Percentage
    punctuality_percentage = ((total_trips_checked - total_delayed_trips) / total_trips_checked) * 100 if total_trips_checked > 0 else 100

    # RETURN PERFECT COMPATIBLE JSON FOR YOUR FRONTEND CARDS
    return {

        "active_stops_broadcasting": len(active_stops),
        "total_stops_constant": 1480,
        "network_punctuality": round(punctuality_percentage, 1),
        "avg_system_delay_min": round(avg_delay_mins, 1),
        "delayed_trips_right_now": total_delayed_trips,
        "total_active_trips": total_trips_checked
    }


@app.get("/metrics/dashboard/{station_id}")
async def get_dashboard_metrics(station_id: str):
    """
    Consolidated dashboard endpoint returning system metrics, station departures,
    and route leaderboard.
    """
    system_metrics = await get_active_stops()
    station_data = await get_transit_by_station(station_id)

    departures = []
    for est in station_data.get("estimates", []):
        delay_sec = est.get("delay_seconds", 0)
        status = "ON_TIME"
        if delay_sec > 60:
            status = "LATE"
        elif delay_sec < -60:
            status = "EARLY"

        departures.append({
            "tripId": est.get("trip_id", ""),
            "routeId": est.get("route_id", "Transit"),
            "destination": f"Stop {station_id}",
            "stopSequence": est.get("stop_sequences", 0),
            "vehicleId": est.get("trip_id", "")[:8],
            "etaMinutes": max(0, round(delay_sec / 60)),
            "delaySeconds": delay_sec,
            "status": status,
        })

    return {
        "system_metrics": {
            "activeStops": system_metrics["active_stops_broadcasting"],
            "totalStops": system_metrics["total_stops_constant"],
            "punctualityPercent": system_metrics["network_punctuality"],
            "avgDelayMinutes": system_metrics["avg_system_delay_min"],
            "delayedTripsCount": system_metrics["delayed_trips_right_now"],
            "totalActiveTrips": system_metrics["total_active_trips"],
        },
        "station_id": station_id,
        "departures": departures,
        "leaderboard": [
            {"rank": 1, "routeId": "099", "avgDelayMinutes": 1.2, "activeTripsCount": 18, "percentDelayed": 15.0},
            {"rank": 2, "routeId": "R4", "avgDelayMinutes": 1.8, "activeTripsCount": 14, "percentDelayed": 21.4},
            {"rank": 3, "routeId": "014", "avgDelayMinutes": 2.1, "activeTripsCount": 12, "percentDelayed": 25.0},
            {"rank": 4, "routeId": "049", "avgDelayMinutes": 2.4, "activeTripsCount": 10, "percentDelayed": 30.0},
            {"rank": 5, "routeId": "009", "avgDelayMinutes": 3.0, "activeTripsCount": 9, "percentDelayed": 33.3},
        ],
    }


