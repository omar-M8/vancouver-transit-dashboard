import { create } from 'zustand';
import { buildMockVehicles } from '../components/map/mockVehicles';
import type {
  LayerVisibility,
  MapLayerKey,
  SelectedMapStop,
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
 */
interface MapStore {
  vehicles: VehicleFeatureCollection;
  vehicleSource: VehicleDataSource;
  /** Epoch ms of the last successful vehicle update */
  vehiclesUpdatedAt: number | null;

  selectedVehicleId: string | null;
  selectedStop: SelectedMapStop | null;
  layers: LayerVisibility;

  setVehicles: (vehicles: VehicleFeatureCollection, source: VehicleDataSource) => void;
  selectVehicle: (vehicleId: string | null) => void;
  selectStop: (stop: SelectedMapStop | null) => void;
  toggleLayer: (layer: MapLayerKey) => void;
}

const loadedAt = Date.now();

export const useMapStore = create<MapStore>((set) => ({
  // Phase 1: mock vehicles until GET /vehicles exists (Phase 3)
  vehicles: buildMockVehicles(loadedAt),
  vehicleSource: 'mock',
  vehiclesUpdatedAt: loadedAt,

  selectedVehicleId: null,
  selectedStop: null,
  // Defaults match the mockup: Vehicles and Stops on, Routes off
  layers: { vehicles: true, routes: false, stops: true },

  setVehicles: (vehicles, source) =>
    set({ vehicles, vehicleSource: source, vehiclesUpdatedAt: Date.now() }),
  selectVehicle: (vehicleId) => set({ selectedVehicleId: vehicleId }),
  selectStop: (stop) => set({ selectedStop: stop }),
  toggleLayer: (layer) =>
    set((state) => ({ layers: { ...state.layers, [layer]: !state.layers[layer] } })),
}));

/** The full feature for one vehicle, or null if it isn't in the current data */
export function findVehicle(
  vehicles: VehicleFeatureCollection,
  vehicleId: string | null,
): VehicleFeature | null {
  if (!vehicleId) return null;
  return vehicles.features.find((f) => f.properties.vehicleId === vehicleId) ?? null;
}
