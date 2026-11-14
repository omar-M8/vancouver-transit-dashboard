import { Button, Group, Text } from '@mantine/core';
import { IconMapPin } from '@tabler/icons-react';
import { useMapStore } from '../../stores/useMapStore';
import classes from './TransitMap.module.css';

/** "Selected stop: [name]" chip with a Clear button. Hidden when no stop is selected. */
export function SelectedStopChip() {
  const selectedStop = useMapStore((s) => s.selectedStop);
  const selectStop = useMapStore((s) => s.selectStop);

  if (!selectedStop) return null;

  return (
    <div className={`${classes.overlay} ${classes.stopChip}`} role="status">
      <Group gap={8} wrap="nowrap">
        <IconMapPin size={14} color="#22d3ee" aria-hidden />
        <Text size="xs" c="#f1f5f9" truncate>
          <Text span c="dimmed" inherit>
            Selected stop:{' '}
          </Text>
          <Text span fw={700} inherit>
            {selectedStop.name}
          </Text>
        </Text>
        <Button
          size="compact-xs"
          variant="subtle"
          color="cyan"
          onClick={() => selectStop(null)}
          aria-label={`Clear selected stop ${selectedStop.name}`}
        >
          Clear
        </Button>
      </Group>
    </div>
  );
}
