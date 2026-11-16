/** OpenFreeMap dark style. No API key; the style carries its own OSM attribution. */
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';

/** Downtown Vancouver. The recenter button returns here. */
export const INITIAL_VIEW_STATE = {
  longitude: -123.1207,
  latitude: 49.2827,
  zoom: 12,
  bearing: 0,
  pitch: 0,
} as const;

/** Matches the backend's 30s GTFS-RT cache */
export const VEHICLE_POLL_INTERVAL_MS = 30_000;
export const VEHICLE_REQUEST_TIMEOUT_MS = 15_000;

/** Used for the route badge and line when TransLink gives the route no color */
export const DEFAULT_ROUTE_COLOR = '#0b5fad';
export const DEFAULT_ROUTE_TEXT_COLOR = '#ffffff';
/** Uncolored routes are drawn in the map's cyan accent so the line stands out on the dark base map */
export const DEFAULT_ROUTE_LINE_COLOR = '#22d3ee';

/** String IDs for map layers and sources */
export const ROUTE_SOURCE_ID = 'shown-route';
export const ROUTE_CASING_LAYER_ID = 'shown-route-casing';
export const ROUTE_LINE_LAYER_ID = 'shown-route-line';
export const VEHICLE_SOURCE_ID = 'vehicles';
export const VEHICLE_LAYER_ID = 'vehicles-circle';
export const VEHICLE_SELECTED_LAYER_ID = 'vehicles-selected';
