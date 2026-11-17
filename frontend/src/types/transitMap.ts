import type { Feature, FeatureCollection, LineString, Point } from 'geojson';

/** Same three values the existing departures board uses */
export type VehicleStatus = 'ON_TIME' | 'LATE' | 'EARLY';

/** Properties of one live vehicle, as returned by GET /vehicles (a GeoJSON FeatureCollection). */
export interface VehicleProperties {
  vehicleId: string;
  label: string;
  routeId: string;
  routeShortName: string;
  routeLongName: string;
  /** Hex color including the leading "#". Null for most routes: TransLink only colors rail, RapidBus and the 99. */
  routeColor: string | null;
  routeTextColor: string | null;
  tripId: string;
  headsign: string | null;
  /** Degrees clockwise from north, if the feed reports it */
  bearing: number | null;
  /** Metres per second (GTFS-RT unit), if the feed reports it */
  speed: number | null;
  /** Unix epoch seconds of the position fix */
  timestamp: number;
  /** Null when the vehicle's trip has no realtime trip update to take a delay from */
  delaySeconds: number | null;
  status: VehicleStatus | null;
  nextStopId: string | null;
  nextStopName: string | null;
}

export type VehicleFeature = Feature<Point, VehicleProperties>;
export type VehicleFeatureCollection = FeatureCollection<Point, VehicleProperties>;

export type MapLayerKey = 'vehicles' | 'routes' | 'stops';
export type LayerVisibility = Record<MapLayerKey, boolean>;

/** The stop highlighted on the map, loaded from GET /stops/{stop_id} */
export interface SelectedMapStop {
  stopId: string;
  stopCode: string | null;
  name: string;
  lat: number;
  lon: number;
  /** Routes serving the stop; vehicles on these are emphasized */
  routeIds: string[];
}

/** Progress of the stop the user picked: the chip shows it while loading and if it fails */
export interface StopRequest {
  /** What the user picked: a stop code or GTFS stop_id */
  query: string;
  /** Name to show until (or instead of) the backend's answer */
  label: string;
  status: 'loading' | 'ready' | 'error';
}

/** Properties of one stop returned by GET /stops */
export interface StopProperties {
  stopId: string;
  stopCode: string | null;
  name: string;
}

export type StopFeatureCollection = FeatureCollection<Point, StopProperties>;

/** One route from GET /routes, for the route filter */
export interface RouteSummary {
  routeId: string;
  /** The public route number ("099", "R4"); empty for SkyTrain lines and SeaBus */
  shortName: string;
  longName: string;
  color: string | null;
}

/** One alert from GET /alerts (only alerts in effect right now are returned) */
export interface ServiceAlert {
  id: string;
  header: string;
  description: string;
  /** GTFS-RT effect name, e.g. "DETOUR", "REDUCED_SERVICE" */
  effect: string;
  cause: string;
  severity: string;
  routeIds: string[];
  stopIds: string[];
  url: string | null;
}

/** A lazily fetched map layer: nothing is requested until the layer is first needed */
export interface LazyLayer<T> {
  status: 'idle' | 'loading' | 'ready' | 'error';
  data: T | null;
}

/** Where the map should fly to next. A new object is a new request, even for the same place. */
export interface CameraTarget {
  longitude: number;
  latitude: number;
  /** The map zooms in to at least this level; it never zooms out */
  minZoom: number;
  /** Also scroll the page so the map is on screen (the request came from elsewhere on the page) */
  scrollIntoView: boolean;
}

/** Properties of one line returned by GET /routes/{route_id}/shape */
export interface RouteShapeProperties {
  routeId: string;
  shapeId: string;
  routeShortName: string;
  routeLongName: string;
  routeColor: string | null;
}

export type RouteShapeCollection = FeatureCollection<LineString, RouteShapeProperties>;

/** The route currently drawn on the map by "Show route" */
export interface ShownRoute {
  routeId: string;
  status: 'loading' | 'ready' | 'error';
  shape: RouteShapeCollection | null;
}

/** Where the vehicles on the map came from */
export type VehicleDataSource = 'mock' | 'live';
