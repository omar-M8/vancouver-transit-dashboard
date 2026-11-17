"""Build compact JSON lookups from TransLink's GTFS static zip.

The realtime feeds only carry ids. Stop names and coordinates, route names and
colors, trip headsigns and route shapes all come from the static schedule,
which TransLink republishes weekly. This script downloads the zip and writes
the files the API loads at startup into backend/data/ (committed to the repo
so the Vercel deployment has them):

  stops.json        [{stop_id, stop_code, name, lat, lon}]   boardable stops only
  routes.json       [{route_id, short_name, long_name, color, text_color, route_type}]
  trips_index.json  {trip_id: [route_id, headsign, direction_id, shape_id]}
  route_shapes.json {"shapes": {shape_id: [[lon, lat], ...]},
                     "routes": {route_id: [shape_id, ...]}}   busiest shape first
  stop_routes.json  {stop_id: [route_id, ...]}
  meta.json         feed version, build time and row counts

Run it from anywhere, about once a week:

    python backend/scripts/build_static_data.py
    python backend/scripts/build_static_data.py --zip path/to/google_transit.zip

Commit backend/data/ after a refresh. Locally the API also runs this on startup
when the files are missing; on Vercel missing files are an error.
"""

import argparse
import csv
import io
import json
import math
import os
import tempfile
import time
import zipfile
from collections import Counter
from collections.abc import Iterator
from pathlib import Path

import httpx

STATIC_GTFS_URL = "https://gtfs-static.translink.ca/gtfs/google_transit.zip"
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DOWNLOAD_TIMEOUT_SECONDS = 120

# Every file the API needs; meta.json is written last, so its presence means
# the whole set is complete.
DATA_FILES = (
    "stops.json",
    "routes.json",
    "trips_index.json",
    "route_shapes.json",
    "stop_routes.json",
    "meta.json",
)

# Shape points closer than this to the simplified line are dropped. 5 m is
# invisible at city zoom levels and removes most of the points.
SIMPLIFY_TOLERANCE_METERS = 5.0
COORDINATE_DECIMALS = 5  # ~1 m
METERS_PER_DEGREE = 111_320.0
# Metro Vancouver's latitude, for scaling longitude degrees to meters
REFERENCE_LATITUDE = 49.25


def read_csv(zf: zipfile.ZipFile, name: str) -> Iterator[dict[str, str]]:
    """Yield one dict per row of a GTFS .txt file, without loading it whole."""
    with zf.open(name) as raw:
        yield from csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig"))


def clean(row: dict[str, str], key: str) -> str:
    """Stripped value of a CSV column; missing or empty becomes ''."""
    return (row.get(key) or "").strip()


def hex_color(value: str) -> str | None:
    """'007c9f' -> '#007C9F'. Most TransLink routes have no color at all."""
    value = value.strip().lstrip("#")
    if len(value) != 6:
        return None
    try:
        int(value, 16)
    except ValueError:
        return None
    return f"#{value.upper()}"


def build_stops(zf: zipfile.ZipFile) -> list[dict]:
    """Boardable stops (platforms/poles) with code, name and coordinates; parent stations and entrances are skipped."""
    stops = []
    for row in read_csv(zf, "stops.txt"):
        stop_id = clean(row, "stop_id")
        # location_type 0/blank = a stop or platform you can board at. Parent
        # stations (1) and entrances (2) never appear in the realtime feeds.
        if not stop_id or (clean(row, "location_type") or "0") != "0":
            continue
        try:
            lat = round(float(row["stop_lat"]), 6)
            lon = round(float(row["stop_lon"]), 6)
        except (KeyError, ValueError):
            continue
        stops.append({
            "stop_id": stop_id,
            "stop_code": clean(row, "stop_code"),
            "name": clean(row, "stop_name"),
            "lat": lat,
            "lon": lon,
        })
    return stops


def build_routes(zf: zipfile.ZipFile) -> list[dict]:
    """Every route with its public number, name, hex colors and GTFS route_type (0 tram, 1 subway, 3 bus, 4 ferry)."""
    routes = []
    for row in read_csv(zf, "routes.txt"):
        route_id = clean(row, "route_id")
        if not route_id:
            continue
        route_type = clean(row, "route_type")
        routes.append({
            "route_id": route_id,
            "short_name": clean(row, "route_short_name"),
            "long_name": clean(row, "route_long_name"),
            "color": hex_color(clean(row, "route_color")),
            "text_color": hex_color(clean(row, "route_text_color")),
            "route_type": int(route_type) if route_type.isdigit() else None,
        })
    return routes


def build_trips(zf: zipfile.ZipFile) -> tuple[dict[str, list], dict[str, Counter]]:
    """Return the trip index and, per route, how many trips use each shape."""
    trips: dict[str, list] = {}
    route_shape_counts: dict[str, Counter] = {}
    for row in read_csv(zf, "trips.txt"):
        trip_id = clean(row, "trip_id")
        route_id = clean(row, "route_id")
        if not trip_id or not route_id:
            continue
        direction = clean(row, "direction_id")
        shape_id = clean(row, "shape_id")
        trips[trip_id] = [
            route_id,
            clean(row, "trip_headsign"),
            int(direction) if direction.isdigit() else None,
            shape_id or None,
        ]
        if shape_id:
            route_shape_counts.setdefault(route_id, Counter())[shape_id] += 1
    return trips, route_shape_counts


def simplify(points: list[tuple[float, float]], tolerance_m: float) -> list[tuple[float, float]]:
    """Douglas-Peucker algorithm for simplifying (lon, lat) points, with the tolerance in meters."""
    if len(points) < 3:
        return points

    lon_scale = METERS_PER_DEGREE * math.cos(math.radians(REFERENCE_LATITUDE)) # Scale longitude degrees to meters at Metro Vancouver's latitude
    xy = [(lon * lon_scale, lat * METERS_PER_DEGREE) for lon, lat in points]
    keep = [False] * len(points)
    keep[0] = keep[-1] = True   # Always keep the endpoints

    # Explicit stack: long shapes would overflow a recursive version
    stack = [(0, len(points) - 1)] 
    while stack:
        first, last = stack.pop()
        if last - first < 2:
            continue
        ax, ay = xy[first]
        bx, by = xy[last]
        dx, dy = bx - ax, by - ay
        length_sq = dx * dx + dy * dy
        worst_distance, worst_index = -1.0, first
        for i in range(first + 1, last):
            px, py = xy[i]
            if length_sq == 0:
                distance = math.hypot(px - ax, py - ay)
            else:
                # Distance from the point to the segment first -> last
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length_sq))
                distance = math.hypot(px - (ax + t * dx), py - (ay + t * dy))
            if distance > worst_distance:
                worst_distance, worst_index = distance, i
        if worst_distance > tolerance_m:
            keep[worst_index] = True
            stack.append((first, worst_index))
            stack.append((worst_index, last))

    return [point for point, kept in zip(points, keep) if kept]


def build_route_shapes(zf: zipfile.ZipFile, route_shape_counts: dict[str, Counter]) -> dict:
    """Simplify each shape and keep, per route, its distinct lines busiest first.

    Returns {"shapes": {shape_id: [[lon, lat], ...]}, "routes": {route_id: [shape_id, ...]}};
    shapes no trip uses are dropped.
    """
    # shapes.txt is not ordered by sequence, so collect then sort
    raw: dict[str, list[tuple[int, float, float]]] = {}
    for row in read_csv(zf, "shapes.txt"):
        shape_id = clean(row, "shape_id")
        try:
            point = (
                int(row["shape_pt_sequence"]),
                float(row["shape_pt_lon"]),
                float(row["shape_pt_lat"]),
            )
        except (KeyError, ValueError):
            continue
        raw.setdefault(shape_id, []).append(point) # Collect all points for each shape_id

    simplified: dict[str, list[list[float]]] = {}
    for shape_id, points in raw.items():
        points.sort()
        line = simplify([(lon, lat) for _, lon, lat in points], SIMPLIFY_TOLERANCE_METERS)
        coordinates: list[list[float]] = []
        for lon, lat in line:
            coordinate = [round(lon, COORDINATE_DECIMALS), round(lat, COORDINATE_DECIMALS)]
            if not coordinates or coordinates[-1] != coordinate:
                coordinates.append(coordinate)
        if len(coordinates) >= 2:
            simplified[shape_id] = coordinates

    shapes: dict[str, list[list[float]]] = {}
    routes: dict[str, list[str]] = {}
    for route_id, counts in route_shape_counts.items():
        shape_ids: list[str] = []
        seen_lines: set[tuple] = set()
        # Busiest shape first, so the first line is the route's main pattern
        for shape_id, _ in sorted(counts.items(), key=lambda item: (-item[1], item[0])):
            coordinates = simplified.get(shape_id)
            if coordinates is None:
                continue
            # Different shape_ids sometimes trace the exact same line
            line_key = tuple(map(tuple, coordinates))
            if line_key in seen_lines:
                continue
            seen_lines.add(line_key)
            shape_ids.append(shape_id)
            shapes[shape_id] = coordinates
        if shape_ids:
            routes[route_id] = shape_ids

    return {"shapes": shapes, "routes": routes}


def build_stop_routes(
    zf: zipfile.ZipFile,
    trips: dict[str, list],
    route_order: dict[str, int],
) -> dict[str, list[str]]:
    """stop_times.txt is ~90 MB, so read it row by row and keep only the sets."""
    stop_routes: dict[str, set[str]] = {}
    with zf.open("stop_times.txt") as raw:
        reader = csv.reader(io.TextIOWrapper(raw, encoding="utf-8-sig"))
        header = next(reader)
        trip_column = header.index("trip_id")
        stop_column = header.index("stop_id")
        for row in reader:
            trip = trips.get(row[trip_column].strip())
            if trip is None:
                continue
            stop_routes.setdefault(row[stop_column].strip(), set()).add(trip[0])

    unknown = len(route_order)
    return {
        stop_id: sorted(route_ids, key=lambda route_id: (route_order.get(route_id, unknown), route_id))
        for stop_id, route_ids in stop_routes.items()
    }


def route_sort_key(route: dict) -> tuple:
    """Order routes the way riders expect: 2, 4, 99, 100, R1, R4, then unnamed lines."""
    short_name = route["short_name"]
    digits = "".join(ch for ch in short_name if ch.isdigit())
    if short_name and short_name[0].isdigit():
        return (0, int(digits), short_name)
    if short_name:
        return (1, 0, short_name)
    return (2, 0, route["long_name"])


def read_feed_info(zf: zipfile.ZipFile) -> dict[str, str]:
    """First row of feed_info.txt (feed version and validity dates), or {} if the feed has none."""
    if "feed_info.txt" not in zf.namelist():
        return {}
    return next(read_csv(zf, "feed_info.txt"), {})


def download_zip(destination: Path) -> None:
    """Stream the static GTFS zip to disk in chunks so the ~16 MB file never sits in memory."""
    with httpx.stream(
        "GET", STATIC_GTFS_URL, timeout=DOWNLOAD_TIMEOUT_SECONDS, follow_redirects=True
    ) as response:
        response.raise_for_status()
        with destination.open("wb") as out:
            for chunk in response.iter_bytes():
                out.write(chunk)


def write_json(path: Path, payload: object) -> int:
    """Write compact JSON through a temp file so readers never see half a file."""
    temporary = path.with_name(path.name + ".tmp")
    with temporary.open("w", encoding="utf-8") as out:
        json.dump(payload, out, ensure_ascii=False, separators=(",", ":"))
    os.replace(temporary, path)
    return path.stat().st_size


def build_static_data(zip_path: Path | None = None, data_dir: Path = DATA_DIR) -> dict:
    """Generate every JSON file and return the meta summary (also in meta.json)."""
    data_dir.mkdir(parents=True, exist_ok=True)
    started = time.time()

    downloaded: Path | None = None
    if zip_path is None:
        handle, name = tempfile.mkstemp(suffix=".zip", prefix="google_transit_")
        os.close(handle)
        downloaded = Path(name)
        print(f"--- Downloading {STATIC_GTFS_URL} ---")
        try:
            download_zip(downloaded)
        except BaseException:
            downloaded.unlink(missing_ok=True)
            raise
        zip_path = downloaded

    try:
        with zipfile.ZipFile(zip_path) as zf:
            feed_info = read_feed_info(zf)
            stops = build_stops(zf)
            routes = sorted(build_routes(zf), key=route_sort_key)
            trips, route_shape_counts = build_trips(zf)
            route_shapes = build_route_shapes(zf, route_shape_counts)
            route_order = {route["route_id"]: position for position, route in enumerate(routes)}
            print("--- Reading stop_times.txt (the big one) ---")
            stop_routes = build_stop_routes(zf, trips, route_order)
    finally:
        if downloaded is not None:
            downloaded.unlink(missing_ok=True)

    boardable = {stop["stop_id"] for stop in stops}
    stop_routes = {stop_id: ids for stop_id, ids in stop_routes.items() if stop_id in boardable}

    sizes = {
        "stops.json": write_json(data_dir / "stops.json", stops),
        "routes.json": write_json(data_dir / "routes.json", routes),
        "trips_index.json": write_json(data_dir / "trips_index.json", trips),
        "route_shapes.json": write_json(data_dir / "route_shapes.json", route_shapes),
        "stop_routes.json": write_json(data_dir / "stop_routes.json", stop_routes),
    }
    meta = {
        "source_url": STATIC_GTFS_URL,
        "generated_at": int(time.time()),
        "feed_version": feed_info.get("feed_version", ""),
        "feed_start_date": feed_info.get("feed_start_date", ""),
        "feed_end_date": feed_info.get("feed_end_date", ""),
        "counts": {
            "stops": len(stops),
            "routes": len(routes),
            "trips": len(trips),
            "shapes": len(route_shapes["shapes"]),
            "shape_points": sum(len(line) for line in route_shapes["shapes"].values()),
            "stops_with_routes": len(stop_routes),
        },
        "file_sizes_bytes": sizes,
    }
    write_json(data_dir / "meta.json", meta)

    for name, size in sizes.items():
        print(f"    {name:<20} {size / 1024:>8.0f} KB")
    print(f"--- Static data built in {time.time() - started:.1f}s -> {data_dir} ---")
    return meta


def main() -> None:
    """CLI entry point: build the files and print the row counts."""
    parser = argparse.ArgumentParser(description="Build backend/data/*.json from GTFS static.")
    parser.add_argument("--zip", type=Path, help="Use a local google_transit.zip instead of downloading")
    args = parser.parse_args()
    meta = build_static_data(zip_path=args.zip)
    print(json.dumps(meta["counts"], indent=2))


if __name__ == "__main__":
    main()
