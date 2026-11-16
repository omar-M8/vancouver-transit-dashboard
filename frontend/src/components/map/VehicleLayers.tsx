import { Layer, Source } from 'react-map-gl/maplibre';
import type { CircleLayerSpecification } from 'maplibre-gl';
import { useAnimatedVehicles } from '../../hooks/useAnimatedVehicles';
import { VEHICLE_SOURCE_ID } from './mapConfig';
import type { VehicleFeatureCollection } from '../../types/transitMap';

type CircleLayer = Omit<CircleLayerSpecification, 'source'>;

interface VehicleLayersProps {
  vehicles: VehicleFeatureCollection;
  circleLayer: CircleLayer;
  selectedRingLayer: CircleLayer;
  visible: boolean;
}

/**
 * The whole fleet as ONE GeoJSON source with a circle layer (no per-vehicle markers).
 * Kept as its own component because the positions animate: only this re-renders
 * on each animation frame, not the whole map.
 * 
 * @param vehicles The vehicle features to show
 * @param circleLayer The circle layer to draw the vehicles
 * @param selectedRingLayer The circle layer to draw a ring around the selected vehicle
 * @param visible Whether the vehicle layers are visible (the map's Vehicles toggle)
 * @returns A component that renders the vehicle layers
 */
export function VehicleLayers({ vehicles, circleLayer, selectedRingLayer, visible }: VehicleLayersProps) {
  // Updating `data` calls setData() on the source under the hood
  const animated = useAnimatedVehicles(vehicles);
  const visibility = visible ? 'visible' : 'none';

  return (
    <Source id={VEHICLE_SOURCE_ID} type="geojson" data={animated} promoteId="vehicleId">
      <Layer {...circleLayer} layout={{ visibility }} />
      <Layer {...selectedRingLayer} layout={{ visibility }} />
    </Source>
  );
}
