import { Group, Text } from '@mantine/core';
import { useMapStore } from '../../stores/useMapStore';
import { formatAgo, useNow } from '../../hooks/useNow';
import classes from './TransitMap.module.css';

/** Top-left pill: "● Live · updated 2s ago" / "10 vehicles" */
export function LiveIndicator() {
  const count = useMapStore((s) => s.vehicles.features.length);
  const source = useMapStore((s) => s.vehicleSource);
  const updatedAt = useMapStore((s) => s.vehiclesUpdatedAt);
  // Ticks every second; only this small component re-renders
  const now = useNow(1000);

  const isMock = source === 'mock';
  const updatedLabel = updatedAt === null ? 'waiting for data' : `updated ${formatAgo(now - updatedAt)}`;

  return (
    <div className={`${classes.overlay} ${classes.liveIndicator}`} role="status" aria-live="off">
      <Group gap={8} wrap="nowrap">
        <span className={classes.liveDot} aria-hidden />
        <Text size="xs" fw={700} c="#f1f5f9">
          {isMock ? 'Live demo' : 'Live'} · {updatedLabel}
        </Text>
      </Group>
      <Text size="xs" c="dimmed" mt={2} style={{ whiteSpace: 'nowrap' }}>
        {count} vehicle{count === 1 ? '' : 's'}
        {isMock ? ' · Mock data' : ''}
      </Text>
    </div>
  );
}
