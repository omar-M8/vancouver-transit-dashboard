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
    return {"message": f"You have asked for station number: {station_id}" }