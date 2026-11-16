import { Button, Group, Loader, Text } from '@mantine/core';
import { IconAlertTriangle, IconMapPin } from '@tabler/icons-react';
import { useMapStore } from '../../stores/useMapStore';
import classes from './TransitMap.module.css';

/** "Selected stop: [name]" chip with a Clear button. Hidden when no stop is selected. */
export function SelectedStopChip() {
  const request = useMapStore((s) => s.stopRequest);
  const clearStop = useMapStore((s) => s.clearStop);

  if (!request) return null;

  const failed = request.status === 'error';

  return (
    <div className={`${classes.overlay} ${classes.stopChip}`} role="status">
      <Group gap={8} wrap="nowrap">
        {request.status === 'loading' ? (
          <Loader size={12} color="cyan" aria-hidden />
        ) : failed ? (
          <IconAlertTriangle size={14} color="#fbbf24" aria-hidden style={{ flexShrink: 0 }} />
        ) : (
          <IconMapPin size={14} color="#22d3ee" aria-hidden style={{ flexShrink: 0 }} />
        )}
        <Text size="xs" c="#f1f5f9" truncate style={{ minWidth: 0 }}>
          <Text span c="dimmed" inherit>
            {failed ? "Couldn't find on the map: " : 'Selected stop: '}
          </Text>
          <Text span fw={700} inherit>
            {request.label}
          </Text>
        </Text>
        <Button
          size="compact-xs"
          variant="subtle"
          color="cyan"
          onClick={clearStop}
          style={{ flexShrink: 0 }}
          aria-label={`Clear selected stop ${request.label}`}
        >
          Clear
        </Button>
      </Group>
    </div>
  );
}
