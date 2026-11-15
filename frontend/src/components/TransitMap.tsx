import { useCallback, useMemo, useRef, useState } from 'react';
import { Box, Card, Group, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconCrosshair } from '@tabler/icons-react';
import MapGL, {
  Layer,
  Popup,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from 'react-map-gl/maplibre';
import type { CircleLayerSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './map/maplibreWorker';
import { findVehicle, useMapStore } from '../stores/useMapStore';
import { VEHICLE_COLOR_EXPRESSION } from './map/delayStatus';
import {
  INITIAL_VIEW_STATE,
  MAP_STYLE_URL,
  VEHICLE_LAYER_ID,
  VEHICLE_SELECTED_LAYER_ID,
  VEHICLE_SOURCE_ID,
} from './map/mapConfig';
import { LiveIndicator } from './map/LiveIndicator';
import { MapLayerToggles } from './map/MapLayerToggles';
import { MapLegend } from './map/MapLegend';
import { MapControls } from './map/MapControls';
import { SelectedStopChip } from './map/SelectedStopChip';
import { VehicleDetailsPanel } from './map/VehicleDetailsPanel';
import classes from './map/TransitMap.module.css';

interface HoveredVehicle {
  vehicleId: string;
  longitude: number;
  latitude: number;
}

/** The first vehicle under the cursor, read from the features MapLibre hit-tested */
function vehicleUnderPointer(e: MapLayerMouseEvent): HoveredVehicle | null {
  const feature = e.features?.find((f) => f.layer.id === VEHICLE_LAYER_ID);
  const vehicleId: unknown = feature?.properties?.vehicleId;
  if (!feature || typeof vehicleId !== 'string' || feature.geometry.type !== 'Point') return null;
  const [longitude, latitude] = feature.geometry.coordinates;
  return { vehicleId, longitude, latitude };
}

/** A circle layer definition; react-map-gl fills in `source` from the parent <Source> */
type CircleLayer = Omit<CircleLayerSpecification, 'source'>;

const vehicleCircleLayer: CircleLayer = {
  id: VEHICLE_LAYER_ID,
  type: 'circle',
  paint: {
    'circle-color': VEHICLE_COLOR_EXPRESSION,
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 2.5, 12, 5, 15, 8],
    'circle-stroke-color': '#0b1118',
    'circle-stroke-width': 1.5,
    'circle-opacity': 0.95,
  },
};

const SELECTED_RING_PAINT: CircleLayer['paint'] = {
  'circle-color': 'rgba(0, 0, 0, 0)',
  'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 6, 12, 9, 15, 13],
  'circle-stroke-color': '#f1f5f9',
  'circle-stroke-width': 2.5,
};

export function TransitMap() {
  const mapRef = useRef<MapRef>(null);
  // Read synchronously on first render: MapLibre only reads attributionControl when the map is created
  const isMobile = useMediaQuery('(max-width: 48em)', false, { getInitialValueInEffect: false });

  const vehicles = useMapStore((s) => s.vehicles);
  const showVehicles = useMapStore((s) => s.layers.vehicles);
  const selectedVehicleId = useMapStore((s) => s.selectedVehicleId);
  const selectVehicle = useMapStore((s) => s.selectVehicle);

  // Hover is transient UI state, so it stays local instead of going in the store
  const [hovered, setHovered] = useState<HoveredVehicle | null>(null);
  const hoveredVehicle = showVehicles && hovered ? findVehicle(vehicles, hovered.vehicleId) : null;

  const handleMouseMove = useCallback((e: MapLayerMouseEvent) => {
    const next = vehicleUnderPointer(e);
    // Only re-render when the hovered vehicle actually changes
    setHovered((prev) => (prev?.vehicleId === next?.vehicleId ? prev : next));
  }, []);

  const handleClick = useCallback(
    (e: MapLayerMouseEvent) => {
      // Clicking empty map space clears the selection (closes the details panel)
      selectVehicle(vehicleUnderPointer(e)?.vehicleId ?? null);
    },
    [selectVehicle],
  );

  const selectedRingLayer = useMemo<CircleLayer>(
    () => ({
      id: VEHICLE_SELECTED_LAYER_ID,
      type: 'circle',
      filter: ['==', ['get', 'vehicleId'], selectedVehicleId ?? ''],
      paint: SELECTED_RING_PAINT,
    }),
    [selectedVehicleId],
  );

  const visibility = showVehicles ? 'visible' : 'none';

  return (
    <Card p="md" radius="md" style={{ backgroundColor: '#131e2b', border: '1px solid #1e2e3d' }}>
      <Group justify="space-between" mb="sm" gap={4} wrap="wrap">
        <Group gap={8} wrap="nowrap">
          <IconCrosshair size={16} color="#94a3b8" aria-hidden />
          <Text component="h2" size="xs" fw={700} c="#e2e8f0" tt="uppercase" m={0} style={{ letterSpacing: '0.14em' }}>
            Live transit map
          </Text>
        </Group>
        <Text size="xs" c="dimmed">
          Vancouver · Burnaby · Richmond
        </Text>
      </Group>

      <Box className={classes.mapFrame} h={{ base: 400, md: 560 }}>
        <MapGL
          ref={mapRef}
          initialViewState={INITIAL_VIEW_STATE}
          mapStyle={MAP_STYLE_URL}
          style={{ position: 'absolute', inset: 0 }}
          attributionControl={{ compact: isMobile }}
          interactiveLayerIds={showVehicles ? [VEHICLE_LAYER_ID] : []}
          cursor={hovered && showVehicles ? 'pointer' : undefined}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHovered(null)}
          onClick={handleClick}
        >
          {/* One GeoJSON source for the whole fleet; updating `data` calls setData() under the hood */}
          <Source id={VEHICLE_SOURCE_ID} type="geojson" data={vehicles} promoteId="vehicleId">
            <Layer {...vehicleCircleLayer} layout={{ visibility }} />
            <Layer {...selectedRingLayer} layout={{ visibility }} />
          </Source>

          {hovered && hoveredVehicle && (
            <Popup
              longitude={hovered.longitude}
              latitude={hovered.latitude}
              anchor="bottom"
              offset={12}
              closeButton={false}
              closeOnClick={false}
              className={classes.vehiclePopup}
              maxWidth="240px"
            >
              <Text size="xs" fw={700} c="#f1f5f9">
                {hoveredVehicle.properties.routeShortName}
                <Text span c="dimmed" fw={400} inherit>
                  {' '}→ {hoveredVehicle.properties.headsign}
                </Text>
              </Text>
            </Popup>
          )}
        </MapGL>

        <LiveIndicator />
        <MapLayerToggles compact={isMobile} />
        <SelectedStopChip />
        <MapLegend />
        <MapControls
          onZoomIn={() => mapRef.current?.zoomIn()}
          onZoomOut={() => mapRef.current?.zoomOut()}
          onRecenter={() =>
            mapRef.current?.flyTo({
              center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
              zoom: INITIAL_VIEW_STATE.zoom,
              bearing: 0,
              pitch: 0,
              duration: 800,
            })
          }
        />
        <VehicleDetailsPanel isMobile={isMobile} />
      </Box>
    </Card>
  );
}
