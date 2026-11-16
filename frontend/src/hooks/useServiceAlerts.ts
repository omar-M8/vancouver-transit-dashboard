import { useEffect } from 'react';
import { ALERTS_POLL_INTERVAL_MS } from '../components/map/mapConfig';
import { useMapStore } from '../stores/useMapStore';
import { useTransitStore } from '../stores/useTransitStore';

/** Loads service alerts when the map mounts and refreshes them every few minutes while the tab is visible. */
export function useServiceAlerts(): void {
  const loadAlerts = useMapStore((s) => s.loadAlerts);
  const backendUrl = useTransitStore((s) => s.backendUrl);
  const isDemoMode = useTransitStore((s) => s.isDemoMode);

  useEffect(() => {
    void loadAlerts();
    const timer = window.setInterval(() => {
      if (!document.hidden) void loadAlerts();
    }, ALERTS_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadAlerts, backendUrl, isDemoMode]);
}
