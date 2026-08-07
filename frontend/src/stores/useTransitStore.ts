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

interface TransitStore {
  // Empty initial states
  systemMetrics: SystemMetrics | null;
  selectedStopId: string;
  selectedStopName: string;
  departures: Departure[];
  selectedTripId: string | null;
  leaderboard: LeaderboardItem[];
  
  isLoading: boolean;
  error: string | null;

  // Actions
  setSelectedStop: (stopId: string, stopName: string) => void;
  setSelectedTripId: (tripId: string | null) => void;
  fetchDashboardData: () => Promise<void>;
}

const BACKEND_URL = 'http://localhost:8000';

export const useTransitStore = create<TransitStore>((set, get) => ({
  systemMetrics: null,
  selectedStopId: '50915', // Default starting station (Broadway & Cambie)
  selectedStopName: 'Broadway & Cambie',
  departures: [],
  selectedTripId: null,
  leaderboard: [],
  isLoading: false,
  error: null,

  setSelectedStop: (stopId, stopName) => {
    set({ selectedStopId: stopId, selectedStopName: stopName, selectedTripId: null });
    get().fetchDashboardData(); // Immediately re-fetch live data for new stop
  },

  setSelectedTripId: (tripId) => {
    set({ selectedTripId: tripId });
  },

  fetchDashboardData: async () => {
    set({ isLoading: true, error: null });
    try {
      const { selectedStopId } = get();
      const response = await fetch(`${BACKEND_URL}/metrics/dashboard/${selectedStopId}`);
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      const data = await response.json();

      set({
        systemMetrics: data.system_metrics,
        departures: data.departures,
        leaderboard: data.leaderboard,
        isLoading: false,
      });
    } catch (err: any) {
      console.error('Failed to fetch live transit data:', err);
      set({ error: err.message || 'Failed to fetch data', isLoading: false });
    }
  },
}));