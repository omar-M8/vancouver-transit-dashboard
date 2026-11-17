import { Text } from '@mantine/core';
import { useMapStore } from '../../stores/useMapStore';
import classes from './TransitMap.module.css';

interface LayerHintProps {
  /** Whether the map is zoomed in far enough for the stops layer to draw */
  stopsInZoomRange: boolean;
}

/**
 * One line under the layer toggles explaining why a layer that is switched on
 * shows nothing yet (zoomed out too far, still loading, or the request failed).
 */
export function LayerHint({ stopsInZoomRange }: LayerHintProps) {
  const showStops = useMapStore((s) => s.layers.stops);
  const showRoutes = useMapStore((s) => s.layers.routes);
  const stopsStatus = useMapStore((s) => s.allStops.status);
  const networkStatus = useMapStore((s) => s.routeNetwork.status);

  let message: string | null = null;
  if (showRoutes && networkStatus === 'error') message = "Couldn't load routes";
  else if (showStops && stopsStatus === 'error') message = "Couldn't load stops";
  else if (showRoutes && networkStatus === 'loading') message = 'Loading routes…';
  else if (showStops && !stopsInZoomRange) message = 'Zoom in to see stops';
  else if (showStops && stopsStatus === 'loading') message = 'Loading stops…';

  if (!message) return null;

  return (
    <div className={`${classes.overlay} ${classes.layerHint}`} role="status">
      <Text size="xs" c="#cbd5e1">
        {message}
      </Text>
    </div>
  );
}
