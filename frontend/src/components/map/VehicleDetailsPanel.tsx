import { useEffect } from 'react';
import { Badge, Box, Button, CloseButton, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconArrowRight, IconRoute } from '@tabler/icons-react';
import { findVehicle, useMapStore } from '../../stores/useMapStore';
import { formatAgo, useNow } from '../../hooks/useNow';
import { DELAY_CATEGORIES, formatDelay, getDelayCategory } from './delayStatus';
import { DEFAULT_ROUTE_COLOR, DEFAULT_ROUTE_TEXT_COLOR } from './mapConfig';
import { destinationLabel, routeLabel } from './routeDisplay';
import classes from './TransitMap.module.css';

/**
 * A panel that shows details about a selected vehicle, including its route, destination,
 * delay status, next stop, speed, and last updated time.
 * 
 *  It can render as a bottom sheet on mobile or a right-side panel on desktop.
 */
interface VehicleDetailsPanelProps {
  /** Render as a bottom sheet instead of a right-side panel */
  isMobile: boolean;
}

/**
 * A row in the details panel for displaying a label and value.
 * @param label the label to display
 * @param value the value to display 
 * @returns a JSX element representing the row
 */
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

/**
 * A panel that shows details about a selected vehicle, including its route, destination,
 * delay status, next stop, speed, and last updated time.
 * @param isMobile whether to render as a bottom sheet on mobile or a right-side panel on desktop
 * @returns a JSX element representing the vehicle details panel, or null if no vehicle is selected
 */
export function VehicleDetailsPanel({ isMobile }: VehicleDetailsPanelProps) {
  // Get the selected vehicle and its properties from the store
  const vehicles = useMapStore((s) => s.vehicles);
  const selectedVehicleId = useMapStore((s) => s.selectedVehicleId);
  const selectVehicle = useMapStore((s) => s.selectVehicle);
  const shownRoute = useMapStore((s) => s.shownRoute);
  const showRoute = useMapStore((s) => s.showRoute);
  const hideRoute = useMapStore((s) => s.hideRoute);
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

  // If no vehicle is selected, render nothing
  if (!vehicle) return null;

  // Extract properties from the vehicle feature and compute derived values
  const p = vehicle.properties;
  const [lon, lat] = vehicle.geometry.coordinates;
  const category = DELAY_CATEGORIES[getDelayCategory(p.delaySeconds)];
  const route = routeLabel(p);
  const destination = destinationLabel(p);
  const routeState = shownRoute?.routeId === p.routeId ? shownRoute.status : null;

  return (
    <section
      className={`${classes.overlay} ${isMobile ? classes.detailsSheet : classes.detailsPanel}`}
      aria-label={`Vehicle details: route ${route} to ${destination}`}
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
                backgroundColor: p.routeColor ?? DEFAULT_ROUTE_COLOR,
                color: p.routeTextColor ?? DEFAULT_ROUTE_TEXT_COLOR,
                fontWeight: 800,
                fontSize: 14,
              }}
            >
              {route}
            </Box>
            {p.routeLongName !== route && (
              <Text size="xs" c="dimmed" lineClamp={2}>
                {p.routeLongName}
              </Text>
            )}
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
            {destination}
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

        <Button
          size="xs"
          variant="light"
          color="cyan"
          leftSection={<IconRoute size={14} />}
          loading={routeState === 'loading'}
          aria-pressed={routeState === 'ready'}
          onClick={() => (routeState === 'ready' ? hideRoute() : void showRoute(p.routeId))}
        >
          {routeState === 'ready' ? 'Hide route' : 'Show route'}
        </Button>
        {routeState === 'error' && (
          <Text size="xs" c="#f87171" role="alert">
            Couldn't load this route. Try again.
          </Text>
        )}
      </Stack>
    </section>
  );
}
