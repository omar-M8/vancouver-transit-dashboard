import { useEffect } from 'react';
import { VEHICLE_POLL_INTERVAL_MS } from '../components/map/mapConfig';
import { useMapStore } from '../stores/useMapStore';
import { useTransitStore } from '../stores/useTransitStore';

/**
 * Refreshes the vehicles every 30s while the browser tab is visible.
 * Hiding the tab stops the timer; showing it again fetches straight away.
 * Changing the backend URL or the demo-mode switch also refetches at once.
 */
export function useVehiclePolling(): void {
  const fetchVehicles = useMapStore((s) => s.fetchVehicles);
  const backendUrl = useTransitStore((s) => s.backendUrl);
  const isDemoMode = useTransitStore((s) => s.isDemoMode);

  useEffect(() => {
    let timer: number | undefined;

    // Stops the timer that fetches vehicles every 30s.
    const stop = () => {
      window.clearInterval(timer);
      timer = undefined;
    };
    // Starts the timer to fetch vehicles every 30s, and fetches immediately.
    const start = () => {
      stop();
      void fetchVehicles();
      timer = window.setInterval(() => void fetchVehicles(), VEHICLE_POLL_INTERVAL_MS);
    };

    /**
     * Handles the visibility change event, stopping the timer when the tab is hidden and starting it when visible.
     */
    const onVisibilityChange = () => {
      if (document.hidden) stop();
      else start();
    };
    
    // Start the timer when the component mounts, and stop it when it unmounts. Also listen for visibility changes.
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchVehicles, backendUrl, isDemoMode]);
}
