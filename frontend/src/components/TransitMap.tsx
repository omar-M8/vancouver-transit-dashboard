import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Card, Group, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconCrosshair } from '@tabler/icons-react';
import MapGL, {
  Layer,
  Marker,
  Popup,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
  type ViewStateChangeEvent,
} from 'react-map-gl/maplibre';
import type {
  CircleLayerSpecification,
  ExpressionSpecification,
  LineLayerSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './map/maplibreWorker';
import { findVehicle, useMapStore } from '../stores/useMapStore';
import { useTransitStore } from '../stores/useTransitStore';
import { VEHICLE_COLOR_EXPRESSION } from './map/delayStatus';
import {
  DEFAULT_ROUTE_LINE_COLOR,
  FADED_VEHICLE_OPACITY,
  INITIAL_VIEW_STATE,
  MAP_STYLE_URL,
  NETWORK_LINE_LAYER_ID,
  NETWORK_ROUTE_LINE_COLOR,
  NETWORK_SOURCE_ID,
  ROUTE_CASING_LAYER_ID,
  ROUTE_LINE_LAYER_ID,
  ROUTE_SOURCE_ID,
  STOPS_LAYER_ID,
  STOPS_MIN_ZOOM,
  STOPS_SOURCE_ID,
  VEHICLE_LAYER_ID,
  VEHICLE_SELECTED_LAYER_ID,
  VEHICLE_SOURCE_ID,
} from './map/mapConfig';
import { LayerHint } from './map/LayerHint';
import { LiveIndicator } from './map/LiveIndicator';
import { MapLayerToggles } from './map/MapLayerToggles';
import { MapLegend } from './map/MapLegend';
import { MapControls } from './map/MapControls';
import { SelectedStopChip } from './map/SelectedStopChip';
import { VehicleDetailsPanel } from './map/VehicleDetailsPanel';
import { destinationLabel, routeLabel } from './map/routeDisplay';
import { useVehiclePolling } from '../hooks/useVehiclePolling';
import type {
  CameraTarget,
  RouteShapeCollection,
  StopFeatureCollection,
} from '../types/transitMap';
import classes from './map/TransitMap.module.css';

interface HoveredVehicle {
  kind: 'vehicle';
  vehicleId: string;
  longitude: number;
  latitude: number;
}

interface HoveredStop {
  kind: 'stop';
  stopId: string;
  stopCode: string | null;
  name: string;
  longitude: number;
  latitude: number;
}

type Hovered = HoveredVehicle | HoveredStop;

/** Same thing under the cursor as before? Then the hover state doesn't need to change. */
function sameHover(a: Hovered | null, b: Hovered | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind === 'vehicle') return b.kind === 'vehicle' && a.vehicleId === b.vehicleId;
  return b.kind === 'stop' && a.stopId === b.stopId;
}

/** What is under the cursor, read from the features MapLibre hit-tested. Vehicles win over stops. */
function featureUnderPointer(e: MapLayerMouseEvent): Hovered | null {
  const vehicle = e.features?.find((f) => f.layer.id === VEHICLE_LAYER_ID);
  if (vehicle && vehicle.geometry.type === 'Point') {
    const vehicleId: unknown = vehicle.properties?.vehicleId;
    const [longitude, latitude] = vehicle.geometry.coordinates;
    if (typeof vehicleId === 'string') return { kind: 'vehicle', vehicleId, longitude, latitude };
  }

  const stop = e.features?.find((f) => f.layer.id === STOPS_LAYER_ID);
  if (stop && stop.geometry.type === 'Point') {
    const stopId: unknown = stop.properties?.stopId;
    const stopCode: unknown = stop.properties?.stopCode;
    const name: unknown = stop.properties?.name;
    const [longitude, latitude] = stop.geometry.coordinates;
    if (typeof stopId === 'string' && typeof name === 'string') {
      return {
        kind: 'stop',
        stopId,
        stopCode: typeof stopCode === 'string' ? stopCode : null,
        name,
        longitude,
        latitude,
      };
    }
  }
  return null;
}

/** A circle layer definition; react-map-gl fills in `source` from the parent <Source> */
type CircleLayer = Omit<CircleLayerSpecification, 'source'>;

/**
 * Paint for the vehicle dots. With a stop selected, vehicles on the routes serving it are drawn
 * larger at full opacity and the rest fade, all inside the paint expression (no refetch).
 */
function vehiclePaint(emphasizedRouteIds: string[]): CircleLayer['paint'] {
  const emphasize = emphasizedRouteIds.length > 0;
  const onRoute: ExpressionSpecification = ['in', ['get', 'routeId'], ['literal', emphasizedRouteIds]];
  const radius = (normal: number, emphasized: number): number | ExpressionSpecification =>
    emphasize ? ['case', onRoute, emphasized, normal] : normal;
  const opacity: number | ExpressionSpecification = emphasize
    ? ['case', onRoute, 1, FADED_VEHICLE_OPACITY]
    : 0.95;

  return {
    'circle-color': VEHICLE_COLOR_EXPRESSION,
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, radius(2.5, 4), 12, radius(5, 7), 15, radius(8, 10.5)],
    'circle-stroke-color': '#0b1118',
    'circle-stroke-width': 1.5,
    'circle-opacity': opacity,
    'circle-stroke-opacity': opacity,
  };
}

/** Every stop as a small light dot; MapLibre skips the layer entirely below STOPS_MIN_ZOOM */
const stopsLayer: CircleLayer = {
  id: STOPS_LAYER_ID,
  type: 'circle',
  minzoom: STOPS_MIN_ZOOM,
  paint: {
    'circle-color': '#e2e8f0',
    'circle-radius': ['interpolate', ['linear'], ['zoom'], STOPS_MIN_ZOOM, 3, 17, 6],
    'circle-stroke-color': '#0b1118',
    'circle-stroke-width': 1.5,
  },
};

/**
 * A ring around the selected vehicle, drawn as a circle layer with no fill and a stroke.
 * The radius is zoom-dependent so it looks the same size on screen at any zoom level.
 */
const SELECTED_RING_PAINT: CircleLayer['paint'] = {
  'circle-color': 'rgba(0, 0, 0, 0)',
  'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 6, 12, 9, 15, 13],
  'circle-stroke-color': '#f1f5f9',
  'circle-stroke-width': 2.5,
};

/** A circle layer definition for the selected vehicle's ring; react-map-gl fills in `source` from the parent <Source> */
type LineLayer = Omit<LineLayerSpecification, 'source'>;

// The route line is drawn in two layers: a dark casing underneath and the colored line on top. This makes it readable against roads of a similar color.
const EMPTY_ROUTE: RouteShapeCollection = { type: 'FeatureCollection', features: [] };
const EMPTY_STOPS: StopFeatureCollection = { type: 'FeatureCollection', features: [] };
const ROUTE_LINE_LAYOUT: LineLayer['layout'] = { 'line-cap': 'round', 'line-join': 'round' };

/** Dark outline under the route line so it reads against roads of a similar color */
const routeCasingLayer: LineLayer = {
  id: ROUTE_CASING_LAYER_ID,
  type: 'line',
  layout: ROUTE_LINE_LAYOUT,
  paint: {
    'line-color': '#0b1118',
    'line-width': ['interpolate', ['linear'], ['zoom'], 9, 4, 12, 6, 15, 9],
    'line-opacity': 0.8,
  },
};

/** The whole network, thin and dim: a backdrop the highlighted routes are drawn over */
const networkLineLayer: LineLayer = {
  id: NETWORK_LINE_LAYER_ID,
  type: 'line',
  layout: ROUTE_LINE_LAYOUT,
  paint: {
    'line-color': ['coalesce', ['get', 'routeColor'], NETWORK_ROUTE_LINE_COLOR],
    'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.75, 12, 1.5, 15, 3],
    'line-opacity': 0.55,
  },
};

const routeLineLayer: LineLayer = {
  id: ROUTE_LINE_LAYER_ID,
  type: 'line',
  layout: ROUTE_LINE_LAYOUT,
  paint: {
    // The route's own color; most bus routes have none and use the cyan accent
    'line-color': ['coalesce', ['get', 'routeColor'], DEFAULT_ROUTE_LINE_COLOR],
    'line-width': ['interpolate', ['linear'], ['zoom'], 9, 2, 12, 3.5, 15, 5.5],
    'line-opacity': 0.9,
  },
};

/***
 * The main transit map component, showing the map, vehicles, route, and details panel.
 * It handles user interactions like hovering and clicking on vehicles, and manages the map state.
 * It uses MapLibre GL for rendering the map and layers, and Mantine for UI components.
 * The map is centered on Vancouver, with a dark style and live vehicle data from the backend.
 * 
 * @returns a JSX element representing the transit map
 */
export function TransitMap() {
  useVehiclePolling();
  const mapRef = useRef<MapRef>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  // Read synchronously on first render: MapLibre only reads attributionControl when the map is created
  const isMobile = useMediaQuery('(max-width: 48em)', false, { getInitialValueInEffect: false });

  const vehicles = useMapStore((s) => s.vehicles);
  const layers = useMapStore((s) => s.layers);
  const selectedVehicleId = useMapStore((s) => s.selectedVehicleId);
  const selectVehicle = useMapStore((s) => s.selectVehicle);
  const shownRouteShape = useMapStore((s) => s.shownRoute?.shape ?? null);
  const selectedStop = useMapStore((s) => s.selectedStop);
  const stopRoutes = useMapStore((s) => s.stopRoutes);
  const allStops = useMapStore((s) => s.allStops);
  const routeNetwork = useMapStore((s) => s.routeNetwork);
  const cameraTarget = useMapStore((s) => s.cameraTarget);
  const showStop = useMapStore((s) => s.showStop);
  const loadAllStops = useMapStore((s) => s.loadAllStops);
  const loadRouteNetwork = useMapStore((s) => s.loadRouteNetwork);

  // A stop picked anywhere in the dashboard (search, popular stations, a stop on this map).
  // The count is 0 until the user picks one, so the default stop doesn't move the map on load.
  const stopSelectionCount = useTransitStore((s) => s.stopSelectionCount);
  useEffect(() => {
    if (stopSelectionCount === 0) return;
    const { selectedStopId, selectedStopName } = useTransitStore.getState();
    void showStop(selectedStopId, selectedStopName);
  }, [stopSelectionCount, showStop]);

  // Stops only draw from STOPS_MIN_ZOOM, so the ~1.5 MB list isn't fetched until it can be seen
  const [stopsInZoomRange, setStopsInZoomRange] = useState(INITIAL_VIEW_STATE.zoom >= STOPS_MIN_ZOOM);
  const handleZoom = useCallback((e: ViewStateChangeEvent) => {
    setStopsInZoomRange(e.viewState.zoom >= STOPS_MIN_ZOOM);
  }, []);
  useEffect(() => {
    if (layers.stops && stopsInZoomRange && allStops.status === 'idle') void loadAllStops();
  }, [layers.stops, stopsInZoomRange, allStops.status, loadAllStops]);
  useEffect(() => {
    if (layers.routes && routeNetwork.status === 'idle') void loadRouteNetwork();
  }, [layers.routes, routeNetwork.status, loadRouteNetwork]);

  // Fly to wherever the store asks: a selected stop, or a vehicle picked on the departures board
  const applyCameraTarget = useCallback((target: CameraTarget) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: [target.longitude, target.latitude],
      zoom: Math.max(map.getZoom(), target.minZoom),
      duration: 1200,
    });
    if (target.scrollIntoView) frameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);
  useEffect(() => {
    if (cameraTarget) applyCameraTarget(cameraTarget);
  }, [cameraTarget, applyCameraTarget]);
  // A request made before the map finished loading is applied once it has
  const handleLoad = useCallback(() => {
    const pending = useMapStore.getState().cameraTarget;
    if (pending) applyCameraTarget(pending);
  }, [applyCameraTarget]);

  // Hover is transient UI state, so it stays local instead of going in the store
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const hoveredVehicle =
    layers.vehicles && hovered?.kind === 'vehicle' ? findVehicle(vehicles, hovered.vehicleId) : null;
  const hoveredStop = layers.stops && hovered?.kind === 'stop' ? hovered : null;

  const handleMouseMove = useCallback((e: MapLayerMouseEvent) => {
    const next = featureUnderPointer(e);
    // Only re-render when the hovered thing actually changes
    setHovered((prev) => (sameHover(prev, next) ? prev : next));
  }, []);

  const handleClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const target = featureUnderPointer(e);
      if (target?.kind === 'stop') {
        // Same path as picking the stop in the station board: departures reload and the map follows
        useTransitStore.getState().setSelectedStop(target.stopCode ?? target.stopId, target.name);
        return;
      }
      // Clicking a vehicle selects it; clicking empty map space closes the details panel
      selectVehicle(target?.vehicleId ?? null);
    },
    [selectVehicle],
  );

  const stopRouteIds = selectedStop?.routeIds;
  const vehicleCircleLayer = useMemo<CircleLayer>(
    () => ({ id: VEHICLE_LAYER_ID, type: 'circle', paint: vehiclePaint(stopRouteIds ?? []) }),
    [stopRouteIds],
  );

  // The selected vehicle is drawn as a ring around the vehicle circle. This layer is only visible when a vehicle is selected.
  const selectedRingLayer = useMemo<CircleLayer>(
    () => ({
      id: VEHICLE_SELECTED_LAYER_ID,
      type: 'circle',
      filter: ['==', ['get', 'vehicleId'], selectedVehicleId ?? ''],
      paint: SELECTED_RING_PAINT,
    }),
    [selectedVehicleId],
  );

  // Highlighted lines: every route serving the selected stop, plus the "Show route" line of the open vehicle panel
  const highlightedRoutes = useMemo<RouteShapeCollection>(() => {
    if (!stopRoutes) return shownRouteShape ?? EMPTY_ROUTE;
    if (!shownRouteShape) return stopRoutes;
    const drawn = new Set(stopRoutes.features.map((f) => f.properties.routeId));
    return {
      type: 'FeatureCollection',
      features: [
        ...stopRoutes.features,
        ...shownRouteShape.features.filter((f) => !drawn.has(f.properties.routeId)),
      ],
    };
  }, [stopRoutes, shownRouteShape]);

  const interactiveLayerIds = useMemo(
    () => [...(layers.vehicles ? [VEHICLE_LAYER_ID] : []), ...(layers.stops ? [STOPS_LAYER_ID] : [])],
    [layers.vehicles, layers.stops],
  );

  // Layers stay mounted and are hidden with `visibility`, which keeps their order on the map fixed
  const vehicleVisibility = layers.vehicles ? 'visible' : 'none';
  const stopsVisibility = layers.stops ? 'visible' : 'none';
  const networkVisibility = layers.routes ? 'visible' : 'none';

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

      <Box ref={frameRef} className={classes.mapFrame} h={{ base: 400, md: 560 }}>
        <MapGL
          ref={mapRef}
          initialViewState={INITIAL_VIEW_STATE}
          mapStyle={MAP_STYLE_URL}
          style={{ position: 'absolute', inset: 0 }}
          attributionControl={{ compact: isMobile }}
          interactiveLayerIds={interactiveLayerIds}
          cursor={hoveredVehicle || hoveredStop ? 'pointer' : undefined}
          onLoad={handleLoad}
          onZoom={handleZoom}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHovered(null)}
          onClick={handleClick}
        >
          {/* Sources are always mounted (empty until needed) so the draw order never changes:
              network, highlighted routes, stops, then vehicles on top */}
          <Source id={NETWORK_SOURCE_ID} type="geojson" data={routeNetwork.data ?? EMPTY_ROUTE}>
            <Layer {...networkLineLayer} layout={{ ...ROUTE_LINE_LAYOUT, visibility: networkVisibility }} />
          </Source>

          <Source id={ROUTE_SOURCE_ID} type="geojson" data={highlightedRoutes}>
            <Layer {...routeCasingLayer} />
            <Layer {...routeLineLayer} />
          </Source>

          <Source id={STOPS_SOURCE_ID} type="geojson" data={allStops.data ?? EMPTY_STOPS}>
            <Layer {...stopsLayer} layout={{ visibility: stopsVisibility }} />
          </Source>

          {/* One GeoJSON source for the whole fleet; updating `data` calls setData() under the hood */}
          <Source id={VEHICLE_SOURCE_ID} type="geojson" data={vehicles} promoteId="vehicleId">
            <Layer {...vehicleCircleLayer} layout={{ visibility: vehicleVisibility }} />
            <Layer {...selectedRingLayer} layout={{ visibility: vehicleVisibility }} />
          </Source>

          {/* Only ever one of these, so a regular Marker is fine */}
          {selectedStop && (
            <Marker longitude={selectedStop.lon} latitude={selectedStop.lat} anchor="center">
              <div className={classes.stopMarker} aria-hidden />
            </Marker>
          )}

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
                {routeLabel(hoveredVehicle.properties)}
                <Text span c="dimmed" fw={400} inherit>
                  {' '}→ {destinationLabel(hoveredVehicle.properties)}
                </Text>
              </Text>
            </Popup>
          )}

          {hoveredStop && (
            <Popup
              longitude={hoveredStop.longitude}
              latitude={hoveredStop.latitude}
              anchor="bottom"
              offset={10}
              closeButton={false}
              closeOnClick={false}
              className={classes.vehiclePopup}
              maxWidth="260px"
            >
              <Text size="xs" fw={700} c="#f1f5f9">
                {hoveredStop.name}
                {hoveredStop.stopCode && (
                  <Text span c="dimmed" fw={400} inherit>
                    {' '}#{hoveredStop.stopCode}
                  </Text>
                )}
              </Text>
            </Popup>
          )}
        </MapGL>

        <LiveIndicator />
        <MapLayerToggles compact={isMobile} />
        <LayerHint stopsInZoomRange={stopsInZoomRange} />
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
