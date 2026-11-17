import type { ExpressionSpecification } from 'maplibre-gl';

/**
 * Single source of truth for delay colors and thresholds.
 * Used by the vehicle layer's paint expression, the legend, and the details panel.
 */

export type DelayCategory = 'onTime' | 'late' | 'veryLate' | 'early' | 'noData';

/** Seconds. Positive = behind schedule, negative = ahead of schedule. */
export const DELAY_THRESHOLDS = {
  /** Anything below this is early */
  earlyBelowSeconds: -60,
  /** Up to and including this is on time */
  onTimeMaxSeconds: 60,
  /** Up to and including this is "1–5 min late"; above it is "5+ min late" */
  lateMaxSeconds: 300,
} as const;

/**
 * The five delay categories, with the label and color to show in the legend.
 */
export const DELAY_CATEGORIES: Record<DelayCategory, { label: string; color: string }> = {
  onTime: { label: 'On time', color: '#34d399' },
  late: { label: '1–5 min late', color: '#fbbf24' },
  veryLate: { label: '5+ min late', color: '#f87171' },
  early: { label: 'Early', color: '#38bdf8' },
  // Vehicles whose trip has no realtime trip update (roughly 1 in 8)
  noData: { label: 'No data', color: '#94a3b8' },
};

/** Order shown in the legend (the mockup's four, then "No data") */
export const DELAY_LEGEND_ORDER: DelayCategory[] = ['onTime', 'late', 'veryLate', 'early', 'noData'];

/**
 * Determines the delay category for a vehicle based on its delay in seconds.
 * @param delaySeconds vehicle delay in seconds, or null if the vehicle's trip has no realtime trip update
 * @returns one of the five delay categories: "onTime", "late", "veryLate", "early", or "noData"
 */
export function getDelayCategory(delaySeconds: number | null): DelayCategory {
  if (delaySeconds === null) return 'noData';
  if (delaySeconds < DELAY_THRESHOLDS.earlyBelowSeconds) return 'early';
  if (delaySeconds <= DELAY_THRESHOLDS.onTimeMaxSeconds) return 'onTime';
  if (delaySeconds <= DELAY_THRESHOLDS.lateMaxSeconds) return 'late';
  return 'veryLate';
}

/** 
 * The expression used in the vehicle layer's paint to color vehicles by delay category.
 */
export const VEHICLE_COLOR_EXPRESSION: ExpressionSpecification = [
  'case',
  ['!=', ['typeof', ['get', 'delaySeconds']], 'number'],
  DELAY_CATEGORIES.noData.color,
  ['<', ['get', 'delaySeconds'], DELAY_THRESHOLDS.earlyBelowSeconds],
  DELAY_CATEGORIES.early.color,
  ['<=', ['get', 'delaySeconds'], DELAY_THRESHOLDS.onTimeMaxSeconds],
  DELAY_CATEGORIES.onTime.color,
  ['<=', ['get', 'delaySeconds'], DELAY_THRESHOLDS.lateMaxSeconds],
  DELAY_CATEGORIES.late.color,
  DELAY_CATEGORIES.veryLate.color,
];

/**
 * Formats a vehicle's delay in seconds for display.
 * @param delaySeconds vehicle delay in seconds, or null if the vehicle's trip has no realtime trip update
 * @returns a string describing the delay
 */
export function formatDelay(delaySeconds: number | null): string {
  if (delaySeconds === null) return 'No delay data';
  const category = getDelayCategory(delaySeconds);
  if (category === 'onTime') return 'On time';
  const minutes = Math.max(1, Math.round(Math.abs(delaySeconds) / 60));
  return category === 'early' ? `${minutes} min early` : `${minutes} min late`;
}
