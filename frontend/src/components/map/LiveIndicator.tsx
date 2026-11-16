import { Group, Text } from '@mantine/core';
import { useMapStore } from '../../stores/useMapStore';
import { formatAgo, useNow } from '../../hooks/useNow';
import classes from './TransitMap.module.css';

/** Top-left pill: "● Live · updated 2s ago" / "830 vehicles", plus loading and error states 
 * 
 * get the vehicle count and last updated time from the store, and the source (mock/live) and error state
 * 
 * show a green dot for live, yellow for loading, red for error, and gray for mock
 * 
 * show the vehicle count and last updated time in the text
 * 
 * update every second to show the "updated Xs ago" text
 * 
 * if the source is mock, show "Live demo" and "Mock data"
 * if the source is live and there is an error, show "Connection lost" and the error message
 * if the source is live and there is no error, show "Live" and the vehicle count
 * if the source is live and there is no updated time, show "Connecting..." and "Loading vehicles"
 * 
 * aria-live="off" so that screen readers don't read the changing text every second
 * role="status" so that screen readers know this is a status message
*/
export function LiveIndicator() {
  const count = useMapStore((s) => s.vehicles.features.length);
  const source = useMapStore((s) => s.vehicleSource);
  const updatedAt = useMapStore((s) => s.vehiclesUpdatedAt);
  const error = useMapStore((s) => s.vehiclesError);
  // Ticks every second; only this small component re-renders
  const now = useNow(1000);

  const vehicleCount = `${count} vehicle${count === 1 ? '' : 's'}`;
  const updated = updatedAt === null ? null : `updated ${formatAgo(now - updatedAt)}`; // difference in ms, formatAgo expects ms

  let dotClass = classes.liveDot;
  let title: string;
  let detail: string;

  if (source === 'mock') {
    title = `Live demo · ${updated ?? 'starting'}`;
    detail = `${vehicleCount} · Mock data`;
  } else if (error && updated) {
    // A refresh failed but the last good vehicles are still on the map
    dotClass = classes.liveDotWarning;
    title = `Connection lost · ${updated}`;
    detail = `${vehicleCount} · retrying every 30s`;
  } else if (error) {
    dotClass = classes.liveDotError;
    title = 'Offline';
    detail = `${error} · retrying every 30s`;
  } else if (!updated) {
    dotClass = classes.liveDotWarning;
    title = 'Connecting…';
    detail = 'Loading vehicles';
  } else {
    title = `Live · ${updated}`;
    detail = vehicleCount;
  }

  return (
    <div className={`${classes.overlay} ${classes.liveIndicator}`} role="status" aria-live="off">
      <Group gap={8} wrap="nowrap">
        <span className={dotClass} aria-hidden />
        <Text size="xs" fw={700} c="#f1f5f9">
          {title}
        </Text>
      </Group>
      <Text size="xs" c="dimmed" mt={2}>
        {detail}
      </Text>
    </div>
  );
}
