import { create } from 'zustand';
import { buildMockVehicles } from '../components/map/mockVehicles';
import { VEHICLE_REQUEST_TIMEOUT_MS } from '../components/map/mapConfig';
import { useTransitStore } from './useTransitStore';
import type {
  LayerVisibility,
  MapLayerKey,
  RouteShapeCollection,
  SelectedMapStop,
  ShownRoute,
  VehicleDataSource,
  VehicleFeature,
  VehicleFeatureCollection,
} from '../types/transitMap';

/**
 * Map-only state, kept separate from useTransitStore on purpose:
 * the existing dashboard components subscribe to useTransitStore as a whole,
 * so putting fast-changing map state there (vehicle refreshes, selections)
 * would re-render the header, metric cards, station board and leaderboard
 * every time. Components here subscribe with selectors.
 *
 * The backend URL and demo-mode switch still live in useTransitStore; the
 * fetch actions below read them from there.
 */
interface MapStore {
  vehicles: VehicleFeatureCollection;
  vehicleSource: VehicleDataSource;
  /** Epoch ms of the last successful vehicle update; null until the first one */
  vehiclesUpdatedAt: number | null;
  isFetchingVehicles: boolean;
  /** Why the latest refresh failed; the last good vehicles stay on the map */
  vehiclesError: string | null;

  selectedVehicleId: string | null;
  selectedStop: SelectedMapStop | null;
  layers: LayerVisibility;
  shownRoute: ShownRoute | null;

  fetchVehicles: () => Promise<void>;
  selectVehicle: (vehicleId: string | null) => void;
  selectStop: (stop: SelectedMapStop | null) => void;
  toggleLayer: (layer: MapLayerKey) => void;
  showRoute: (routeId: string) => Promise<void>;
  hideRoute: () => void;
}

// Empty FeatureCollection to use while waiting for the first fetch or when switching from mock to live
const EMPTY_VEHICLES: VehicleFeatureCollection = { type: 'FeatureCollection', features: [] };

/**
 * Validates that a value is a GeoJSON FeatureCollection with a features array. 
 * This is used to check the response from the backend.
 * @param value the value to check 
 * @returns boolean indicating whether the value is a FeatureCollection
 */
function isFeatureCollection(value: unknown): value is { type: 'FeatureCollection'; features: unknown[] } {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { type?: unknown; features?: unknown };
  return candidate.type === 'FeatureCollection' && Array.isArray(candidate.features);
}

/**
 * Fetches a GeoJSON FeatureCollection from the given URL, with a timeout.
 * @param url endpoint to fetch the FeatureCollection from
 * @returns a Promise that resolves to the FeatureCollection
 */
async function fetchFeatureCollection(url: string): Promise<{ type: 'FeatureCollection'; features: unknown[] }> {
  const response = await fetch(url, { signal: AbortSignal.timeout(VEHICLE_REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Backend returned ${response.status}`);
  const body: unknown = await response.json();
  if (!isFeatureCollection(body)) throw new Error('Unexpected response from backend');
  return body;
}

/**
 * Generates an error message based on the type of error.
 * @param error the error to generate a message for
 * @returns the error message
 */
function errorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'TimeoutError') return 'Backend timed out';
  if (error instanceof TypeError) return "Can't reach the backend";
  return error instanceof Error ? error.message : 'Request failed';
}

// Responses can arrive out of order (e.g. after switching backend URL); only the newest one counts
let latestVehicleRequest = 0;

/**
 * A Zustand store for managing the state of the transit map, including vehicles, selected vehicle/stop, layer visibility, and route display.
 * It provides actions to fetch vehicles, select vehicles/stops, toggle layers, and show/hide routes.
 */
export const useMapStore = create<MapStore>((set, get) => ({
  // Initial state of the map store
  vehicles: EMPTY_VEHICLES,
  vehicleSource: 'live',
  vehiclesUpdatedAt: null,
  isFetchingVehicles: false,
  vehiclesError: null,

  selectedVehicleId: null,
  selectedStop: null,
  // Defaults match the mockup: Vehicles and Stops on, Routes off
  layers: { vehicles: true, routes: false, stops: true },
  shownRoute: null,

  // Fetches the latest vehicle data from the backend or generates mock vehicles in demo mode.
  fetchVehicles: async () => {
    const { isDemoMode, backendUrl } = useTransitStore.getState();
    const requestId = ++latestVehicleRequest;

    if (isDemoMode) {
      const now = Date.now();
      set({
        vehicles: buildMockVehicles(now),
        vehicleSource: 'mock',
        vehiclesUpdatedAt: now,
        isFetchingVehicles: false,
        vehiclesError: null,
      });
      return;
    }

    // Leaving demo mode: mock vehicles must not pass as live ones while the first request runs
    if (get().vehicleSource === 'mock') {
      set({ vehicles: EMPTY_VEHICLES, vehicleSource: 'live', vehiclesUpdatedAt: null, selectedVehicleId: null });
    }
    set({ isFetchingVehicles: true });

    // Fetch the live vehicles from the backend, with error handling and request ordering
    try {
      const collection = await fetchFeatureCollection(`${backendUrl}/vehicles`);
      if (requestId !== latestVehicleRequest) return;
      set({
        // The backend builds these features to match VehicleFeatureCollection
        vehicles: collection as VehicleFeatureCollection,
        vehicleSource: 'live',
        vehiclesUpdatedAt: Date.now(),
        isFetchingVehicles: false,
        vehiclesError: null,
      });
    } catch (error: unknown) {
      if (requestId !== latestVehicleRequest) return;
      // Keep the last good vehicles; the live indicator shows how old they are
      set({ isFetchingVehicles: false, vehiclesError: errorMessage(error) });
    }
  },

  // Selects a vehicle by its ID, updating the selected vehicle and potentially clearing the shown route if it doesn't match the new selection.
  selectVehicle: (vehicleId) => {
    const { vehicles, shownRoute } = get();
    const routeId = findVehicle(vehicles, vehicleId)?.properties.routeId ?? null;
    set({
      selectedVehicleId: vehicleId,
      // A drawn route belongs to the open details panel: drop it when the panel
      // closes or moves to a vehicle on another route
      shownRoute: shownRoute && shownRoute.routeId === routeId ? shownRoute : null,
    });
  },
  selectStop: (stop) => set({ selectedStop: stop }), // Selects a stop, updating the selected stop in the store.
  toggleLayer: (layer) => // Toggles the visibility of a map layer (vehicles, routes, or stops) by updating the layers state.
    set((state) => ({ layers: { ...state.layers, [layer]: !state.layers[layer] } })),

  // Shows the shape of a route on the map by fetching it from the backend and updating the shownRoute state.
  showRoute: async (routeId) => {
    const { backendUrl } = useTransitStore.getState();
    set({ shownRoute: { routeId, status: 'loading', shape: null } });
    // Ignore the response if the user hid the route or asked for another one meanwhile
    const stillWanted = () => get().shownRoute?.routeId === routeId;
    try {
      const collection = await fetchFeatureCollection(
        `${backendUrl}/routes/${encodeURIComponent(routeId)}/shape`,
      );
      if (!stillWanted()) return;
      if (collection.features.length === 0) throw new Error('No shape for this route');
      set({ shownRoute: { routeId, status: 'ready', shape: collection as RouteShapeCollection } });
    } catch {
      if (!stillWanted()) return;
      set({ shownRoute: { routeId, status: 'error', shape: null } });
    }
  },
  hideRoute: () => set({ shownRoute: null }),
}));

/** The full feature for one vehicle, or null if it isn't in the current data */
export function findVehicle(
  vehicles: VehicleFeatureCollection,
  vehicleId: string | null,
): VehicleFeature | null {
  if (!vehicleId) return null;
  return vehicles.features.find((f) => f.properties.vehicleId === vehicleId) ?? null;
}
