import { create } from "zustand";

//Types

export interface SystemMetrics {
    activeStops: number;
    totalStops: number;
    activeStopsDelta: number;
    punctualityPercent: number;
    punctualityDelta: number;
    avgDelayMinutes: number;
    delayedTripsCount: number;
    totalActiveTrips: number;
    delayedTripsDelta: number;
}

export interface Departure {
    tripId: string;
    routeId: string;
    destination: string;
    stopSequences: number;
    totalRouteStops: number;
    vehicleId: string;
    etaMinutes: number;
    delaySeconds: number;
    status: 'ON_TIME' | 'LATE' | 'EARLY';
}

export interface LeaderboardItem {
    rank: number;
    routeId: string;
    corrider: string;
    avgDelayMinutes: number;
    activeTripCount: number;
    percentDelayed: number;
}

// Store interface

interface TransitStore {
    
    // Top Cards State
    systemMetrics: SystemMetrics | null;

    // Departure Board State
    selectedStopId: string;
    selectedStopName: string;
    departure: Departure[];

    // Trip Progres Panel State
    selectedTripId: string | null;

    // Bottom Leaderboard State
    leaderboard: LeaderboardItem[];

    // General App State
    isLoading: boolean;
    error: string | null;

    //Actions -> functions to update state
    setSelectedStop: (stopId: string, stopName: string) => void;
    setSelectedTripId: (tripId: string | null) => void;
    fetchDashboardData: () => Promise<void>;
}
