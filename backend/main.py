import time 
from fastapi import FastAPI

app = FastAPI()

#create globla cache memomry dictionary 
cache_memory = {}

@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.get("/transit/{station_id}")
async def get_transit_data(station_id: str):
    current_time = time.time()
    if(station_id in cache_memory and current_time - cache_memory[station_id]["timestamp"] < 30):

        # Cache hit! -> data is fresh
        print("--- Fetching from internal memory cache ---")
        return {
            "source": "cache",
            "data": cache_memory[station_id]["data"],
        }
    else:
        # Cache miss (not it cache_memory or outdated ) -> request data from translink API
        print("--- Cache empty or expired. Need to fetch from TransLink ---")

        # placeholder message
        return {"message": "Cache miss. Will fetch live data here next."}