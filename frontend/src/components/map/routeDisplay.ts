import type { VehicleProperties } from '../../types/transitMap';

type RouteNames = Pick<VehicleProperties, 'routeShortName' | 'routeLongName' | 'routeId'>;

/** 
 * Formats a route's name for display: short name if available, else long name, else route ID.
 * @param route an object containing the route's short name, long name, and ID
 * @returns a string representing the route's name
 */
export function routeLabel(route: RouteNames): string {
  return route.routeShortName || route.routeLongName || route.routeId;
}

/**
 * Determines the destination label for a vehicle based on its properties.
 * @param vehicle an object containing the vehicle's properties
 * @returns a string representing the vehicle's destination
 */
/** Where the vehicle is going: its headsign, or the route name if the trip has none */
export function destinationLabel(vehicle: VehicleProperties): string {
  return vehicle.headsign || vehicle.routeLongName || routeLabel(vehicle);
}
