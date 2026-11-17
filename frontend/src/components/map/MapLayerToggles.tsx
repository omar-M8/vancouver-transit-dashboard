import { ActionIcon, Button, Group, Tooltip } from '@mantine/core';
import { IconBus, IconMapPin, IconRoute, type Icon } from '@tabler/icons-react';
import { useMapStore } from '../../stores/useMapStore';
import type { MapLayerKey } from '../../types/transitMap';
import classes from './TransitMap.module.css';

const LAYER_OPTIONS: { key: MapLayerKey; label: string; icon: Icon }[] = [
  { key: 'vehicles', label: 'Vehicles', icon: IconBus },
  { key: 'routes', label: 'Routes', icon: IconRoute },
  { key: 'stops', label: 'Stops', icon: IconMapPin },
];

interface MapLayerTogglesProps {
  /** Icon-only buttons, for narrow screens */
  compact: boolean;
}

/** Top-right grouped toggles. Active layers get the cyan accent. */
export function MapLayerToggles({ compact }: MapLayerTogglesProps) {
  const layers = useMapStore((s) => s.layers);
  const toggleLayer = useMapStore((s) => s.toggleLayer);

  return (
    <div className={`${classes.overlay} ${classes.layerToggles}`} role="group" aria-label="Map layers">
      <Group gap={4} wrap="nowrap">
        {LAYER_OPTIONS.map(({ key, label, icon: LayerIcon }) => {
          const active = layers[key];
          const common = {
            onClick: () => toggleLayer(key),
            'aria-pressed': active,
            color: active ? 'cyan' : 'gray',
            variant: active ? 'light' : 'subtle',
          } as const;

          return compact ? (
            <Tooltip key={key} label={label} withArrow>
              <ActionIcon {...common} size="md" aria-label={`${label} layer`}>
                <LayerIcon size={16} />
              </ActionIcon>
            </Tooltip>
          ) : (
            <Button
              key={key}
              {...common}
              size="compact-sm"
              leftSection={<LayerIcon size={15} />}
              styles={{ root: { fontWeight: 600, color: active ? undefined : '#94a3b8' } }}
            >
              {label}
            </Button>
          );
        })}
      </Group>
    </div>
  );
}
