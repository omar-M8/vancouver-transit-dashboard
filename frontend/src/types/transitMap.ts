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

export interface SelectedMapStop {
  stopId: string;
  stopCode: string | null;
  name: string;
  lat: number;
  lon: number;
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
