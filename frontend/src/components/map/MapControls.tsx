import { ActionIcon, Divider, Stack, Tooltip } from '@mantine/core';
import { IconCurrentLocation, IconMinus, IconPlus } from '@tabler/icons-react';
import classes from './TransitMap.module.css';

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
}

/** Bottom-right vertical stack: zoom in, zoom out, recenter */
export function MapControls({ onZoomIn, onZoomOut, onRecenter }: MapControlsProps) {
  const buttons = [
    { label: 'Zoom in', icon: IconPlus, onClick: onZoomIn },
    { label: 'Zoom out', icon: IconMinus, onClick: onZoomOut },
    { label: 'Recenter on Vancouver', icon: IconCurrentLocation, onClick: onRecenter },
  ];

  return (
    <div className={`${classes.overlay} ${classes.controls}`} role="group" aria-label="Map controls">
      <Stack gap={2}>
        {buttons.map(({ label, icon: ButtonIcon, onClick }, i) => (
          <div key={label}>
            {i === 2 && <Divider color="rgba(51, 65, 85, 0.65)" mb={2} />}
            <Tooltip label={label} position="left" withArrow>
              <ActionIcon variant="subtle" color="gray" size="lg" aria-label={label} onClick={onClick}>
                <ButtonIcon size={18} color="#e2e8f0" />
              </ActionIcon>
            </Tooltip>
          </div>
        ))}
      </Stack>
    </div>
  );
}
