import { create } from 'zustand';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface SystemMetrics {
  activeStops: number;
  totalStops: number;
  punctualityPercent: number;
  avgDelayMinutes: number;
  delayedTripsCount: number;
  totalActiveTrips: number;
}

export interface Departure {
  tripId: string;
  routeId: string;
  destination: string;
  stopSequence: number;
  vehicleId: string;
  etaMinutes: number;
  delaySeconds: number;
  status: 'ON_TIME' | 'LATE' | 'EARLY';
}

export interface LeaderboardItem {
  rank: number;
  routeId: string;
  avgDelayMinutes: number;
  activeTripsCount: number;
  percentDelayed: number;
}

/** One row from GET /stops/search */
export interface StopSearchResult {
  stop_id: string;
  stop_code: string;
  stop_name: string;
  direction: string | null;
  /** Display name with the direction moved to the end, e.g. "Fraser St @ E 49 Ave, Northbound" */
  label: string;
  score: number;
}

export interface PresetStation {
  id: string;
  name: string;
  description: string;
}

export const POPULAR_STATIONS: PresetStation[] = [
  { id: '50915', name: 'Broadway & Cambie', description: '99 B-Line & Canada Line Hub' },
  { id: '54483', name: 'Burrard Station', description: 'Downtown Financial / Expo Line' },
  { id: '50001', name: 'Granville & Georgia', description: 'Downtown Core Transit Mall' },
  { id: '51479', name: 'Commercial-Broadway', description: 'Millennium & Expo Line Transfer' },
  { id: '58313', name: 'Granville & Pender', description: 'Northbound Granville Transit Mall' },
  { id: '50160', name: 'Waterfront Station', description: 'SeaBus, WCE & Skytrain Terminus' },
];

const DEMO_METRICS: SystemMetrics = {
  activeStops: 1248,
  totalStops: 1480,
  punctualityPercent: 93.6,
  avgDelayMinutes: 1.4,
  delayedTripsCount: 42,
  totalActiveTrips: 658,
};

const DEMO_DEPARTURES: Departure[] = [
  {
    tripId: 'TRIP-99B-84912',
    routeId: '099',
    destination: 'UBC B-Line',
    stopSequence: 14,
    vehicleId: 'BUS-1829',
    etaMinutes: 2,
    delaySeconds: 15,
    status: 'ON_TIME',
  },
  {
    tripId: 'TRIP-R4-90214',
    routeId: 'R4',
    destination: '41st Ave RapidBus',
    stopSequence: 8,
    vehicleId: 'BUS-2104',
    etaMinutes: 5,
    delaySeconds: 180,
    status: 'LATE',
  },
  {
    tripId: 'TRIP-015-77219',
    routeId: '015',
    destination: 'Cambie / Olympic Village',
    stopSequence: 22,
    vehicleId: 'BUS-1450',
    etaMinutes: 7,
    delaySeconds: -75,
    status: 'EARLY',
  },
  {
    tripId: 'TRIP-009-66120',
    routeId: '009',
    destination: 'Boundary / Alma',
    stopSequence: 19,
    vehicleId: 'BUS-1988',
    etaMinutes: 11,
    delaySeconds: 40,
    status: 'ON_TIME',
  },
  {
    tripId: 'TRIP-017-54011',
    routeId: '017',
    destination: 'Downtown via Oak',
    stopSequence: 11,
    vehicleId: 'BUS-1205',
    etaMinutes: 14,
    delaySeconds: 240,
    status: 'LATE',
  },
];

const DEMO_LEADERBOARD: LeaderboardItem[] = [
  { rank: 1, routeId: '099', avgDelayMinutes: 1.1, activeTripsCount: 24, percentDelayed: 12.5 },
  { rank: 2, routeId: 'R4', avgDelayMinutes: 1.5, activeTripsCount: 19, percentDelayed: 18.0 },
  { rank: 3, routeId: '014', avgDelayMinutes: 2.0, activeTripsCount: 16, percentDelayed: 22.2 },
  { rank: 4, routeId: '049', avgDelayMinutes: 2.3, activeTripsCount: 14, percentDelayed: 27.5 },
  { rank: 5, routeId: '009', avgDelayMinutes: 2.9, activeTripsCount: 12, percentDelayed: 33.3 },
];

interface TransitStore {
  // State
  systemMetrics: SystemMetrics | null;
  selectedStopId: string;
  selectedStopName: string;
  departures: Departure[];
  selectedTripId: string | null;
  leaderboard: LeaderboardItem[];
  
  backendUrl: string;
  isConnected: boolean;
  isDemoMode: boolean;
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;

  // Actions
  setBackendUrl: (url: string) => void;
  setSelectedStop: (stopId: string, stopName?: string) => void;
  setSelectedTripId: (tripId: string | null) => void;
  toggleDemoMode: (enabled?: boolean) => void;
  fetchDashboardData: () => Promise<void>;
  checkBackendHealth: () => Promise<boolean>;
  searchStops: (query: string, signal?: AbortSignal) => Promise<StopSearchResult[]>;
}

export const useTransitStore = create<TransitStore>((set, get) => ({
  systemMetrics: null,
  selectedStopId: '50915',
  selectedStopName: 'Broadway & Cambie',
  departures: [],
  selectedTripId: null,
  leaderboard: [],

  backendUrl: 'http://localhost:8000',
  isConnected: false,
  isDemoMode: false,
  isLoading: false,
  error: null,
  lastUpdated: null,

  setBackendUrl: (url: string) => {
    set({ backendUrl: url.replace(/\/$/, '') });
    get().fetchDashboardData();
  },

  setSelectedStop: (stopId: string, stopName?: string) => {
    const matchedPreset = POPULAR_STATIONS.find((s) => s.id === stopId);
    const finalName = stopName || matchedPreset?.name || `Stop #${stopId}`;
    set({ selectedStopId: stopId, selectedStopName: finalName, selectedTripId: null });
    get().fetchDashboardData();
  },

  setSelectedTripId: (tripId: string | null) => {
    set({ selectedTripId: tripId });
  },

  toggleDemoMode: (enabled?: boolean) => {
    const nextState = enabled !== undefined ? enabled : !get().isDemoMode;
    if (nextState) {
      set({
        isDemoMode: true,
        isConnected: true,
        error: null,
        systemMetrics: DEMO_METRICS,
        departures: DEMO_DEPARTURES,
        leaderboard: DEMO_LEADERBOARD,
        lastUpdated: new Date().toLocaleTimeString(),
      });
    } else {
      set({ isDemoMode: false });
      get().fetchDashboardData();
    }
  },

  checkBackendHealth: async () => {
    const { backendUrl } = get();
    try {
      const res = await fetch(`${backendUrl}/`, { method: 'GET' });
      const ok = res.ok;
      set({ isConnected: ok });
      return ok;
    } catch {
      set({ isConnected: false });
      return false;
    }
  },

  searchStops: async (query: string, signal?: AbortSignal) => {
    const { backendUrl } = get();
    const params = new URLSearchParams({ q: query, limit: '20' });
    const res = await fetch(`${backendUrl}/stops/search?${params}`, { signal });
    if (!res.ok) throw new Error(`Stop search failed (${res.status})`);
    const data = await res.json();
    return (data.results ?? []) as StopSearchResult[];
  },

  fetchDashboardData: async () => {
    const { isDemoMode, backendUrl, selectedStopId } = get();

    if (isDemoMode) {
      set({
        systemMetrics: DEMO_METRICS,
        departures: DEMO_DEPARTURES,
        leaderboard: DEMO_LEADERBOARD,
        lastUpdated: new Date().toLocaleTimeString(),
      });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      // First attempt: try consolidated endpoint /metrics/dashboard/{station_id}
      let succeeded = false;
      try {
        const response = await fetch(`${backendUrl}/metrics/dashboard/${selectedStopId}`);
        if (response.ok) {
          const data = await response.json();
          set({
            systemMetrics: data.system_metrics,
            departures: data.departures || [],
            leaderboard: data.leaderboard || [],
            isConnected: true,
            isLoading: false,
            error: null,
            lastUpdated: new Date().toLocaleTimeString(),
          });
          succeeded = true;
        }
      } catch {
        // Fallback to separate endpoints below
      }

      if (!succeeded) {
        // Fallback: Query /debug/active-stops and /transit/{station_id}
        const [stopsRes, transitRes] = await Promise.all([
          fetch(`${backendUrl}/debug/active-stops`),
          fetch(`${backendUrl}/transit/${selectedStopId}`),
        ]);

        if (!stopsRes.ok && !transitRes.ok) {
          throw new Error(`Backend unavailable at ${backendUrl}`);
        }

        const stopsData = stopsRes.ok ? await stopsRes.json() : null;
        const transitData = transitRes.ok ? await transitRes.json() : null;

        const systemMetrics: SystemMetrics | null = stopsData
          ? {
              activeStops: stopsData.active_stops_broadcasting ?? 0,
              totalStops: stopsData.total_stops_constant ?? 1480,
              punctualityPercent: stopsData.network_punctuality ?? 100,
              avgDelayMinutes: stopsData.avg_system_delay_min ?? 0,
              delayedTripsCount: stopsData.delayed_trips_right_now ?? 0,
              totalActiveTrips: stopsData.total_active_trips ?? 0,
            }
          : null;

        const departures: Departure[] = (transitData?.estimates || []).map(
          (est: { trip_id?: string; route_id?: string; stop_sequences?: number; delay_seconds?: number }) => {
            const delaySec = est.delay_seconds || 0;
            let status: 'ON_TIME' | 'LATE' | 'EARLY' = 'ON_TIME';
            if (delaySec > 60) status = 'LATE';
            else if (delaySec < -60) status = 'EARLY';

            return {
              tripId: est.trip_id || 'UNKNOWN',
              routeId: est.route_id || 'Transit',
              destination: `Stop #${selectedStopId}`,
              stopSequence: est.stop_sequences || 0,
              vehicleId: (est.trip_id || '').slice(0, 8),
              etaMinutes: Math.max(0, Math.round(delaySec / 60)),
              delaySeconds: delaySec,
              status,
            };
          }
        );

        set({
          systemMetrics,
          departures,
          leaderboard: DEMO_LEADERBOARD,
          isConnected: true,
          isLoading: false,
          error: null,
          lastUpdated: new Date().toLocaleTimeString(),
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect to backend';
      console.warn('Transit backend fetch notice:', message);
      set({
        isConnected: false,
        isLoading: false,
        error: message,
      });
    }
  },
}));
