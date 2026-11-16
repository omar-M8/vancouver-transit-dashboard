import { Group, Text } from '@mantine/core';
import { DELAY_CATEGORIES, DELAY_LEGEND_ORDER } from './delayStatus';
import classes from './TransitMap.module.css';

/** Bottom-left legend; colors come from the same constants as the vehicle layer */
export function MapLegend() {
  return (
    <div className={`${classes.overlay} ${classes.legend}`} role="group" aria-label="Vehicle delay legend">
      <Group gap={14} component="ul" style={{ rowGap: 4, listStyle: 'none', margin: 0, padding: 0 }}>
        {DELAY_LEGEND_ORDER.map((category) => {
          const { label, color } = DELAY_CATEGORIES[category];
          return (
            <Group key={category} gap={6} wrap="nowrap" component="li">
              <span className={classes.legendDot} style={{ backgroundColor: color }} aria-hidden />
              <Text size="xs" fw={500} c="#e2e8f0" style={{ whiteSpace: 'nowrap' }}>
                {label}
              </Text>
            </Group>
          );
        })}
      </Group>
    </div>
  );
}
