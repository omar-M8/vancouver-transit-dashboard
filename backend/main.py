import time 
from fastapi import FastAPI, HTTPException
import httpx
from google.transit import gtfs_realtime_pb2

app = FastAPI()

#create globla cache memomry dictionary 
cache_memory = {}

@app.get("/")
async def root():
    return {"message": "Hello World"}

async def get_or_update_gtfs_feed():
    """Helper function: Ensure we always have a fresh 30s GTFS feed in RAM """
    current_time = time.time()
    cache_key = "gtfs_realtime_all"

    # If cache exists and is fresh (< 30s), return it immediately
    print("--- Returned directly from Cache!! ---")
    if cache_key in cache_memory and (current_time - cache_memory[cache_key]["timestamp"]< 30):
        return cache_memory[cache_key]["data"]

    #Otherwise, fetch full system feed from Translink
    else:
        print("--- Fetching fresh GTFS feed for all of Vancouver ---")
        api_key = "KSJk9QxERQspOR9ff9Ul"
        url = f"https://gtfsapi.translink.ca/v3/gtfsrealtime?apikey={api_key}"

        async with httpx.AsyncClient() as client:
            response = await client.get(url)

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch GTFS feed")

        # Parse Protobuf binary data
        feed = gtfs_realtime_pb2.FeedMessage()
        feed.ParseFromString(response.content)

        cache_memory[cache_key] = {
            "timestamp": current_time,
            "data": feed
        }

        return feed

@app.get("/transit/{station_id}")
async def get_transit_by_station(station_id: str):
    """
    Fetch live trip updates filtered for a specific station or stop ID.

    Queries the global GTFS Realtime feed and extracts arrival estimates,
    route identifiers, and delay information for the requested stop.
    """

    # Get the full system GTFS feed served isntaly if fresh (< 30s)
    feed =  await get_or_update_gtfs_feed()

    # Filter through feed for resrective station
    station_updates = []

    for entity in feed.entity:
        if entity.HasField('trip_update'):
            for stu in entity.trip_update.stop_time_update:
                # Check if this update belongs to the stop the user asked for
                if stu.stop_id == station_id:
                    station_updates.append({
                        "trip_id": entity.trip_update.trip.trip_id,
                        "route_id": entity.trip_update.trip.route_id,
                        "stop_sequences": stu.stop_sequence,
                        "delay_seconds": stu.arrival.delay if stu.HasField('arrival') else 0
                    })

    # Return ONLY the data for that specific stop
    return {
        "station_id": station_id,
        "results_found": len(station_updates),
        "estimates": station_updates
    }

@app.get("/debug/active-stops")
async def get_active_stops():
    """
    Retrieve a set of all stop IDs currently broadcasting live updates in the feed.

    Useful for debugging, inspecting feed activity, and discovering valid
    station IDs across the TransLink network.
    """

    feed = await get_or_update_gtfs_feed()
    active_stops = set()

    for entity in feed.entity:
        if entity.HasField('trip_update'):
            for stu in entity.trip_update.stop_time_update:
                if stu.stop_id:
                    active_stops.add(stu.stop_id)

    return {
        "total_active_stops_systemwide": len(active_stops),
        "sampe_active_stops": list(active_stops)[:40]
    }
    
