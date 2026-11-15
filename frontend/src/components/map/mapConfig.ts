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

export const VEHICLE_SOURCE_ID = 'vehicles';
export const VEHICLE_LAYER_ID = 'vehicles-circle';
export const VEHICLE_SELECTED_LAYER_ID = 'vehicles-selected';
