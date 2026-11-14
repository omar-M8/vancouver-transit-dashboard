import type {
  VehicleFeatureCollection,
  VehicleProperties,
  VehicleStatus,
} from '../../types/transitMap';

/**
 * Phase 1 only: ~10 fake vehicles that exercise every delay color.
 * Replaced by GET /vehicles in Phase 3.
 */

type MockVehicle = Omit<VehicleProperties, 'status' | 'timestamp'> & {
  lon: number;
  lat: number;
  /** How many seconds before page load the position was reported */
  ageSeconds: number;
};

const BUS_BLUE = '#0b5fad';
const WHITE = '#ffffff';

const MOCK_VEHICLES: MockVehicle[] = [
  {
    vehicleId: 'M-99-1', label: '19502', routeId: '6641', routeShortName: '99',
    routeLongName: 'Commercial-Broadway / UBC (B-Line)', routeColor: '#f58220', routeTextColor: WHITE,
    tripId: 'mock-trip-1', headsign: 'Commercial-Broadway Station', bearing: 90, speed: 9.2,
    delaySeconds: 30, nextStopId: 'mock-s1', nextStopName: 'Eastbound W Broadway @ Granville St',
    lon: -123.1386, lat: 49.2632, ageSeconds: 4,
  },
  {
    vehicleId: 'M-R4-1', label: '18341', routeId: '37807', routeShortName: 'R4',
    routeLongName: '41st Ave (RapidBus)', routeColor: '#2e9b47', routeTextColor: WHITE,
    tripId: 'mock-trip-2', headsign: 'UBC', bearing: 270, speed: 11.5,
    delaySeconds: 150, nextStopId: 'mock-s2', nextStopName: 'Westbound W 41 Ave @ Oak St',
    lon: -123.1278, lat: 49.2341, ageSeconds: 12,
  },
  {
    vehicleId: 'M-14-1', label: '2403', routeId: '6626', routeShortName: '14',
    routeLongName: 'Hastings / UBC', routeColor: BUS_BLUE, routeTextColor: WHITE,
    tripId: 'mock-trip-3', headsign: 'Downtown', bearing: 270, speed: 4.1,
    delaySeconds: 420, nextStopId: 'mock-s3', nextStopName: 'Westbound E Hastings St @ Nanaimo St',
    lon: -123.0561, lat: 49.2810, ageSeconds: 8,
  },
  {
    vehicleId: 'M-9-1', label: '2217', routeId: '6624', routeShortName: '9',
    routeLongName: 'Boundary / Granville / Alma / UBC', routeColor: BUS_BLUE, routeTextColor: WHITE,
    tripId: 'mock-trip-4', headsign: 'Alma', bearing: 270, speed: null,
    delaySeconds: -95, nextStopId: 'mock-s4', nextStopName: 'Westbound E Broadway @ Main St',
    lon: -123.1003, lat: 49.2627, ageSeconds: 21,
  },
  {
    vehicleId: 'M-20-1', label: '2512', routeId: '6633', routeShortName: '20',
    routeLongName: 'Victoria / Downtown', routeColor: BUS_BLUE, routeTextColor: WHITE,
    tripId: 'mock-trip-5', headsign: 'Downtown', bearing: 0, speed: 7.8,
    delaySeconds: 0, nextStopId: 'mock-s5', nextStopName: 'Northbound Commercial Dr @ E 12 Ave',
    lon: -123.0695, lat: 49.2600, ageSeconds: 3,
  },
  {
    vehicleId: 'M-3-1', label: '2109', routeId: '6612', routeShortName: '3',
    routeLongName: 'Main / Downtown', routeColor: BUS_BLUE, routeTextColor: WHITE,
    tripId: 'mock-trip-6', headsign: 'Downtown', bearing: 0, speed: 6.4,
    delaySeconds: 200, nextStopId: 'mock-s6', nextStopName: 'Northbound Main St @ E 16 Ave',
    lon: -123.1008, lat: 49.2570, ageSeconds: 15,
  },
  {
    vehicleId: 'M-CAN-1', label: '144', routeId: '13686', routeShortName: 'Canada Line',
    routeLongName: 'Waterfront / YVR-Airport / Richmond-Brighouse', routeColor: '#0098c9', routeTextColor: WHITE,
    tripId: 'mock-trip-7', headsign: 'Waterfront', bearing: 0, speed: 16.0,
    delaySeconds: 10, nextStopId: 'mock-s7', nextStopName: 'Olympic Village Station',
    lon: -123.1150, lat: 49.2640, ageSeconds: 2,
  },
  {
    vehicleId: 'M-EXPO-1', label: '316', routeId: '30052', routeShortName: 'Expo Line',
    routeLongName: 'Waterfront / King George / Production Way-University', routeColor: '#0055a5', routeTextColor: WHITE,
    tripId: 'mock-trip-8', headsign: 'King George', bearing: 120, speed: 18.3,
    delaySeconds: 75, nextStopId: 'mock-s8', nextStopName: 'Nanaimo Station',
    lon: -123.0660, lat: 49.2622, ageSeconds: 6,
  },
  {
    vehicleId: 'M-17-1', label: '3301', routeId: '6629', routeShortName: '17',
    routeLongName: 'Oak / Downtown', routeColor: BUS_BLUE, routeTextColor: WHITE,
    tripId: 'mock-trip-9', headsign: 'Downtown', bearing: 0, speed: 0,
    delaySeconds: 610, nextStopId: 'mock-s9', nextStopName: 'Northbound Oak St @ W King Edward Ave',
    lon: -123.1268, lat: 49.2490, ageSeconds: 27,
  },
  {
    vehicleId: 'M-5-1', label: '2150', routeId: '6616', routeShortName: '5',
    routeLongName: 'Robson / Downtown', routeColor: BUS_BLUE, routeTextColor: WHITE,
    tripId: 'mock-trip-10', headsign: 'Robson', bearing: 315, speed: 5.0,
    delaySeconds: -150, nextStopId: 'mock-s10', nextStopName: 'Westbound Robson St @ Burrard St',
    lon: -123.1245, lat: 49.2838, ageSeconds: 9,
  },
];

function statusFor(delaySeconds: number): VehicleStatus {
  if (delaySeconds > 60) return 'LATE';
  if (delaySeconds < -60) return 'EARLY';
  return 'ON_TIME';
}

export function buildMockVehicles(nowMs: number): VehicleFeatureCollection {
  const nowSeconds = Math.floor(nowMs / 1000);
  return {
    type: 'FeatureCollection',
    features: MOCK_VEHICLES.map(({ lon, lat, ageSeconds, ...props }) => ({
      type: 'Feature',
      id: props.vehicleId,
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        ...props,
        status: statusFor(props.delaySeconds),
        timestamp: nowSeconds - ageSeconds,
      },
    })),
  };
}
