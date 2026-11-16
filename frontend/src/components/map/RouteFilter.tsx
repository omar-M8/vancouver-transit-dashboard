import { useEffect, useMemo } from 'react';
import { MultiSelect } from '@mantine/core';
import { IconFilter } from '@tabler/icons-react';
import { useMapStore } from '../../stores/useMapStore';
import { useTransitStore } from '../../stores/useTransitStore';

/** Card-header control: pick routes to show only their vehicles (and lines, with Routes on). Empty = everything. */
export function RouteFilter() {
  // Get the list of routes from the store, and the current filter and setter
  const routes = useMapStore((s) => s.routes);
  const vehicles = useMapStore((s) => s.vehicles);
  const routeFilter = useMapStore((s) => s.routeFilter);
  const setRouteFilter = useMapStore((s) => s.setRouteFilter);
  const loadRoutes = useMapStore((s) => s.loadRoutes);
  const backendUrl = useTransitStore((s) => s.backendUrl);

  useEffect(() => {
    void loadRoutes();
  }, [loadRoutes, backendUrl]);

  // Build the list of options for the MultiSelect. If we have a route list from the backend, use that. Otherwise, offer the routes that have vehicles on the map.
  const options = useMemo(() => {
    if (routes.data) {
      return routes.data.map((route) => ({
        value: route.routeId,
        label: [route.shortName, route.longName].filter(Boolean).join(' · ') || route.routeId,
      }));
    }
    // No route list (demo mode, backend down): offer the routes that have vehicles on the map
    const seen = new Map<string, string>();
    for (const { properties: p } of vehicles.features) {
      if (!seen.has(p.routeId)) {
        seen.set(p.routeId, [p.routeShortName, p.routeLongName].filter(Boolean).join(' · ') || p.routeId);
      }
    }
    return [...seen]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  }, [routes.data, vehicles]);

  return (
    <MultiSelect
      aria-label="Show only these routes"
      placeholder={routeFilter.length === 0 ? 'Filter routes' : undefined}
      data={options}
      value={routeFilter}
      onChange={setRouteFilter}
      searchable
      clearable
      hidePickedOptions
      selectFirstOptionOnChange
      nothingFoundMessage="No route matches"
      maxDropdownHeight={260}
      size="xs"
      w={{ base: '100%', sm: 300 }}
      leftSection={<IconFilter size={14} aria-hidden />}
      comboboxProps={{ position: 'bottom-end', withinPortal: true }}
      styles={{
        input: { backgroundColor: '#0f172a', borderColor: '#243547', color: '#f1f5f9' },
        inputField: { color: '#f1f5f9' },
        pill: { backgroundColor: '#164e63', color: '#ecfeff' },
        dropdown: { backgroundColor: '#0f172a', borderColor: '#243547' },
        option: { color: '#f1f5f9' },
        empty: { color: '#94a3b8' },
      }}
    />
  );
}
