import type { Feature, FeatureCollection, Point } from 'geojson';

/** Same three values the existing departures board uses */
export type VehicleStatus = 'ON_TIME' | 'LATE' | 'EARLY';

/**
 * Properties of one live vehicle. This mirrors what GET /vehicles will return
 * in Phase 3 (as a GeoJSON FeatureCollection), so the map code won't change
 * when the mock data is swapped for the real endpoint.
 */
export interface VehicleProperties {
  vehicleId: string;
  label: string;
  routeId: string;
  routeShortName: string;
  routeLongName: string;
  /** Hex color including the leading "#" */
  routeColor: string;
  routeTextColor: string;
  tripId: string;
  headsign: string;
  /** Degrees clockwise from north, if the feed reports it */
  bearing: number | null;
  /** Metres per second (GTFS-RT unit), if the feed reports it */
  speed: number | null;
  /** Unix epoch seconds of the position fix */
  timestamp: number;
  delaySeconds: number;
  status: VehicleStatus;
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

/** Where the vehicles on the map came from */
export type VehicleDataSource = 'mock' | 'live';
