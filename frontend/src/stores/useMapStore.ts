import { create } from 'zustand';
import { buildMockVehicles } from '../components/map/mockVehicles';
import {
  STOP_FOCUS_ZOOM,
  VEHICLE_FOCUS_ZOOM,
  VEHICLE_REQUEST_TIMEOUT_MS,
} from '../components/map/mapConfig';
import { useTransitStore } from './useTransitStore';
import type {
  CameraTarget,
  LayerVisibility,
  LazyLayer,
  MapLayerKey,
  RouteShapeCollection,
  RouteSummary,
  SelectedMapStop,
  ServiceAlert,
  ShownRoute,
  StopFeatureCollection,
  StopRequest,
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
  /** The stop highlighted on the map, once the backend has located it */
  selectedStop: SelectedMapStop | null;
  /** The stop the user last picked, including while it loads or if it failed */
  stopRequest: StopRequest | null;
  /** Lines of every route serving the selected stop */
  stopRoutes: RouteShapeCollection | null;
  layers: LayerVisibility;
  shownRoute: ShownRoute | null;
  /** All stops, for the Stops layer (fetched the first time it is visible) */
  allStops: LazyLayer<StopFeatureCollection>;
  /** All route lines, for the Routes layer (fetched the first time it is switched on) */
  routeNetwork: LazyLayer<RouteShapeCollection>;
  cameraTarget: CameraTarget | null;
  /** Every route, for the route filter's options */
  routes: LazyLayer<RouteSummary[]>;
  /** Route ids to show; empty means no filter */
  routeFilter: string[];
  /** Service alerts in effect now; empty until loaded, in demo mode, or if the request fails */
  alerts: ServiceAlert[];

  loadRoutes: () => Promise<void>;
  setRouteFilter: (routeIds: string[]) => void;
  loadAlerts: () => Promise<void>;
  fetchVehicles: () => Promise<void>;
  selectVehicle: (vehicleId: string | null) => void;
  /** Select a vehicle from outside the map and bring it into view */
  focusVehicle: (vehicleId: string) => void;
  /** Highlight a stop (by stop code or stop_id): marker, its routes, and emphasis on their vehicles */
  showStop: (query: string, label: string) => Promise<void>;
  clearStop: () => void;
  loadAllStops: () => Promise<void>;
  loadRouteNetwork: () => Promise<void>;
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

interface StopDetails {
  stop_id: string;
  stop_code: string;
  stop_name: string;
  lat: number;
  lon: number;
  routes: { route_id: string }[];
}

function isStopDetails(value: unknown): value is StopDetails {
  if (typeof value !== 'object' || value === null) return false;
  const stop = value as Partial<Record<keyof StopDetails, unknown>>;
  return (
    typeof stop.stop_id === 'string' &&
    typeof stop.stop_name === 'string' &&
    typeof stop.lat === 'number' &&
    typeof stop.lon === 'number' &&
    Array.isArray(stop.routes)
  );
}

/** GET /stops/{stop}: accepts a public stop code or a GTFS stop_id */
async function fetchStopDetails(backendUrl: string, stop: string): Promise<StopDetails> {
  const response = await fetch(`${backendUrl}/stops/${encodeURIComponent(stop)}`, {
    signal: AbortSignal.timeout(VEHICLE_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Backend returned ${response.status}`);
  const body: unknown = await response.json();
  if (!isStopDetails(body)) throw new Error('Unexpected response from backend');
  return body;
}

/** GET a JSON object and return the array under `key`, or throw if it isn't there */
async function fetchList(url: string, key: string): Promise<unknown[]> {
  const response = await fetch(url, { signal: AbortSignal.timeout(VEHICLE_REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Backend returned ${response.status}`);
  const body: unknown = await response.json();
  const list = typeof body === 'object' && body !== null ? (body as Record<string, unknown>)[key] : null;
  if (!Array.isArray(list)) throw new Error('Unexpected response from backend');
  return list;
}

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');
const asStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

function toRouteSummary(item: unknown): RouteSummary | null {
  if (typeof item !== 'object' || item === null) return null;
  const route = item as Record<string, unknown>;
  if (typeof route.route_id !== 'string') return null;
  return {
    routeId: route.route_id,
    shortName: asString(route.short_name),
    longName: asString(route.long_name),
    color: typeof route.color === 'string' ? route.color : null,
  };
}

function toServiceAlert(item: unknown): ServiceAlert | null {
  if (typeof item !== 'object' || item === null) return null;
  const alert = item as Record<string, unknown>;
  if (typeof alert.id !== 'string' || typeof alert.header !== 'string') return null;
  return {
    id: alert.id,
    header: alert.header,
    description: asString(alert.description),
    effect: asString(alert.effect),
    cause: asString(alert.cause),
    severity: asString(alert.severity),
    routeIds: asStringList(alert.routeIds),
    stopIds: asStringList(alert.stopIds),
    url: typeof alert.url === 'string' ? alert.url : null,
  };
}

function fetchRouteShape(backendUrl: string, routeId: string): Promise<RouteShapeCollection> {
  return fetchFeatureCollection(
    `${backendUrl}/routes/${encodeURIComponent(routeId)}/shape`,
  ) as Promise<RouteShapeCollection>;
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
  stopRequest: null,
  stopRoutes: null,
  // Defaults match the mockup: Vehicles and Stops on, Routes off
  layers: { vehicles: true, routes: false, stops: true },
  shownRoute: null,
  allStops: { status: 'idle', data: null },
  routeNetwork: { status: 'idle', data: null },
  cameraTarget: null,
  routes: { status: 'idle', data: null },
  routeFilter: [],
  alerts: [],

  loadRoutes: async () => {
    if (get().routes.status === 'loading' || get().routes.status === 'ready') return;
    const { backendUrl } = useTransitStore.getState();
    set({ routes: { status: 'loading', data: null } });
    try {
      const list = await fetchList(`${backendUrl}/routes`, 'routes');
      const routes = list.map(toRouteSummary).filter((route): route is RouteSummary => route !== null);
      set({ routes: { status: 'ready', data: routes } });
    } catch {
      set({ routes: { status: 'error', data: null } });
    }
  },

  setRouteFilter: (routeIds) => {
    const { vehicles, selectedVehicleId } = get();
    set({ routeFilter: routeIds });
    // A vehicle the filter just hid can't stay selected
    const selectedRoute = findVehicle(vehicles, selectedVehicleId)?.properties.routeId;
    if (routeIds.length > 0 && selectedRoute && !routeIds.includes(selectedRoute)) {
      get().selectVehicle(null);
    }
  },

  loadAlerts: async () => {
    const { isDemoMode, backendUrl } = useTransitStore.getState();
    if (isDemoMode) {
      set({ alerts: [] });
      return;
    }
    try {
      const list = await fetchList(`${backendUrl}/alerts`, 'alerts');
      set({ alerts: list.map(toServiceAlert).filter((alert): alert is ServiceAlert => alert !== null) });
    } catch {
      // Alerts are an extra; the map works without them, and the last good list stays
    }
  },

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

  focusVehicle: (vehicleId) => {
    const vehicle = findVehicle(get().vehicles, vehicleId);
    if (!vehicle) return;
    get().selectVehicle(vehicleId);
    const [longitude, latitude] = vehicle.geometry.coordinates;
    set({
      // A hidden vehicle can't be shown as selected
      layers: { ...get().layers, vehicles: true },
      cameraTarget: { longitude, latitude, minZoom: VEHICLE_FOCUS_ZOOM, scrollIntoView: true },
    });
  },

  showStop: async (query, label) => {
    const { backendUrl } = useTransitStore.getState();
    set({
      stopRequest: { query, label, status: 'loading' },
      selectedStop: null,
      stopRoutes: null,
    });
    // Ignore the answer if the user picked another stop or pressed Clear meanwhile
    const stillWanted = () => {
      const request = get().stopRequest;
      return request !== null && request.query === query && request.status !== 'error';
    };

    try {
      const details = await fetchStopDetails(backendUrl, query);
      if (!stillWanted()) return;
      const routeIds = details.routes.map((route) => route.route_id);
      set({
        stopRequest: { query, label: details.stop_name, status: 'ready' },
        selectedStop: {
          stopId: details.stop_id,
          stopCode: details.stop_code || null,
          name: details.stop_name,
          lat: details.lat,
          lon: details.lon,
          routeIds,
        },
        cameraTarget: {
          longitude: details.lon,
          latitude: details.lat,
          minZoom: STOP_FOCUS_ZOOM,
          scrollIntoView: false,
        },
      });

      // The marker and fly-to don't wait for the lines; a route whose shape fails is just left out
      const shapes = await Promise.allSettled(
        routeIds.map((routeId) => fetchRouteShape(backendUrl, routeId)),
      );
      if (!stillWanted() || get().selectedStop?.stopId !== details.stop_id) return;
      set({
        stopRoutes: {
          type: 'FeatureCollection',
          features: shapes.flatMap((result) =>
            result.status === 'fulfilled' ? result.value.features : [],
          ),
        },
      });
    } catch {
      if (!stillWanted()) return;
      set({ stopRequest: { query, label, status: 'error' } });
    }
  },

  clearStop: () => set({ stopRequest: null, selectedStop: null, stopRoutes: null }),

  loadAllStops: async () => {
    if (get().allStops.status === 'loading' || get().allStops.status === 'ready') return;
    const { backendUrl } = useTransitStore.getState();
    set({ allStops: { status: 'loading', data: null } });
    try {
      const collection = await fetchFeatureCollection(`${backendUrl}/stops`);
      set({ allStops: { status: 'ready', data: collection as StopFeatureCollection } });
    } catch {
      set({ allStops: { status: 'error', data: null } });
    }
  },

  loadRouteNetwork: async () => {
    if (get().routeNetwork.status === 'loading' || get().routeNetwork.status === 'ready') return;
    const { backendUrl } = useTransitStore.getState();
    set({ routeNetwork: { status: 'loading', data: null } });
    try {
      const collection = await fetchFeatureCollection(`${backendUrl}/routes/shapes`);
      set({ routeNetwork: { status: 'ready', data: collection as RouteShapeCollection } });
    } catch {
      set({ routeNetwork: { status: 'error', data: null } });
    }
  },

  toggleLayer: (layer) => // Toggles the visibility of a map layer (vehicles, routes, or stops) by updating the layers state.
    set((state) => ({ layers: { ...state.layers, [layer]: !state.layers[layer] } })),

  // Shows the shape of a route on the map by fetching it from the backend and updating the shownRoute state.
  showRoute: async (routeId) => {
    const { backendUrl } = useTransitStore.getState();
    set({ shownRoute: { routeId, status: 'loading', shape: null } });
    // Ignore the response if the user hid the route or asked for another one meanwhile
    const stillWanted = () => get().shownRoute?.routeId === routeId;
    try {
      const shape = await fetchRouteShape(backendUrl, routeId);
      if (!stillWanted()) return;
      if (shape.features.length === 0) throw new Error('No shape for this route');
      set({ shownRoute: { routeId, status: 'ready', shape } });
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
