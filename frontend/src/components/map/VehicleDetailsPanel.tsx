import { useEffect } from 'react';
import { Badge, Box, Button, CloseButton, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconArrowRight, IconRoute } from '@tabler/icons-react';
import { findVehicle, useMapStore } from '../../stores/useMapStore';
import { formatAgo, useNow } from '../../hooks/useNow';
import { DELAY_CATEGORIES, formatDelay, getDelayCategory } from './delayStatus';
import classes from './TransitMap.module.css';

interface VehicleDetailsPanelProps {
  /** Render as a bottom sheet instead of a right-side panel */
  isMobile: boolean;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="xs" c="#f1f5f9" fw={500}>
        {value}
      </Text>
    </>
  );
}

export function VehicleDetailsPanel({ isMobile }: VehicleDetailsPanelProps) {
  const vehicles = useMapStore((s) => s.vehicles);
  const selectedVehicleId = useMapStore((s) => s.selectedVehicleId);
  const selectVehicle = useMapStore((s) => s.selectVehicle);
  const vehicle = findVehicle(vehicles, selectedVehicleId);
  const now = useNow(1000);

  // Escape closes the panel
  useEffect(() => {
    if (!selectedVehicleId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') selectVehicle(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedVehicleId, selectVehicle]);

  if (!vehicle) return null;

  const p = vehicle.properties;
  const [lon, lat] = vehicle.geometry.coordinates;
  const category = DELAY_CATEGORIES[getDelayCategory(p.delaySeconds)];

  return (
    <section
      className={`${classes.overlay} ${isMobile ? classes.detailsSheet : classes.detailsPanel}`}
      aria-label={`Vehicle details: route ${p.routeShortName} to ${p.headsign}`}
    >
      {isMobile && <div className={classes.sheetHandle} aria-hidden />}
      <Stack gap={10}>
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
          <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
            <Box
              px={8}
              py={2}
              style={{
                flexShrink: 0,
                borderRadius: 6,
                backgroundColor: p.routeColor,
                color: p.routeTextColor,
                fontWeight: 800,
                fontSize: 14,
              }}
            >
              {p.routeShortName}
            </Box>
            <Text size="xs" c="dimmed" lineClamp={2}>
              {p.routeLongName}
            </Text>
          </Group>
          <CloseButton
            size="sm"
            variant="subtle"
            aria-label="Close vehicle details"
            onClick={() => selectVehicle(null)}
          />
        </Group>

        <Group gap={6} wrap="nowrap">
          <IconArrowRight size={16} color="#94a3b8" aria-hidden style={{ flexShrink: 0 }} />
          <Text size="md" fw={700} c="#f1f5f9">
            {p.headsign}
          </Text>
        </Group>

        <Badge
          variant="light"
          color={category.color}
          size="md"
          radius="xl"
          w="fit-content"
          leftSection={<span className={classes.legendDot} style={{ backgroundColor: category.color }} />}
        >
          {formatDelay(p.delaySeconds)}
        </Badge>

        <SimpleGrid cols={2} spacing={8} verticalSpacing={6} style={{ gridTemplateColumns: 'auto 1fr' }}>
          <DetailRow label="Next stop" value={p.nextStopName ?? 'Unknown'} />
          <DetailRow label="Vehicle" value={p.label ? `#${p.label}` : p.vehicleId} />
          {p.speed !== null && <DetailRow label="Speed" value={`${Math.round(p.speed * 3.6)} km/h`} />}
          <DetailRow label="Updated" value={formatAgo(now - p.timestamp * 1000)} />
        </SimpleGrid>

        <Text size="10px" c="dimmed" ff="monospace">
          {lat.toFixed(5)}, {lon.toFixed(5)}
        </Text>

        {/* Route shapes come from GTFS static data (Phase 2) and get drawn in Phase 3 */}
        <Button size="xs" variant="light" color="cyan" leftSection={<IconRoute size={14} />} disabled>
          Show route
        </Button>
      </Stack>
    </section>
  );
}
