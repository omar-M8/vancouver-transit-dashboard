import type { ExpressionSpecification } from 'maplibre-gl';

/**
 * Single source of truth for delay colors and thresholds.
 * Used by the vehicle layer's paint expression, the legend, and the details panel.
 */

export type DelayCategory = 'onTime' | 'late' | 'veryLate' | 'early';

/** Seconds. Positive = behind schedule, negative = ahead of schedule. */
export const DELAY_THRESHOLDS = {
  /** Anything below this is early */
  earlyBelowSeconds: -60,
  /** Up to and including this is on time */
  onTimeMaxSeconds: 60,
  /** Up to and including this is "1–5 min late"; above it is "5+ min late" */
  lateMaxSeconds: 300,
} as const;

export const DELAY_CATEGORIES: Record<DelayCategory, { label: string; color: string }> = {
  onTime: { label: 'On time', color: '#34d399' },
  late: { label: '1–5 min late', color: '#fbbf24' },
  veryLate: { label: '5+ min late', color: '#f87171' },
  early: { label: 'Early', color: '#38bdf8' },
};

/** Order shown in the legend (matches the mockup) */
export const DELAY_LEGEND_ORDER: DelayCategory[] = ['onTime', 'late', 'veryLate', 'early'];

export function getDelayCategory(delaySeconds: number): DelayCategory {
  if (delaySeconds < DELAY_THRESHOLDS.earlyBelowSeconds) return 'early';
  if (delaySeconds <= DELAY_THRESHOLDS.onTimeMaxSeconds) return 'onTime';
  if (delaySeconds <= DELAY_THRESHOLDS.lateMaxSeconds) return 'late';
  return 'veryLate';
}

/** MapLibre equivalent of getDelayCategory(), evaluated on the GPU per vehicle */
export const VEHICLE_COLOR_EXPRESSION: ExpressionSpecification = [
  'case',
  ['<', ['get', 'delaySeconds'], DELAY_THRESHOLDS.earlyBelowSeconds],
  DELAY_CATEGORIES.early.color,
  ['<=', ['get', 'delaySeconds'], DELAY_THRESHOLDS.onTimeMaxSeconds],
  DELAY_CATEGORIES.onTime.color,
  ['<=', ['get', 'delaySeconds'], DELAY_THRESHOLDS.lateMaxSeconds],
  DELAY_CATEGORIES.late.color,
  DELAY_CATEGORIES.veryLate.color,
];

/** "On time", "3 min late", "2 min early" */
export function formatDelay(delaySeconds: number): string {
  const category = getDelayCategory(delaySeconds);
  if (category === 'onTime') return 'On time';
  const minutes = Math.max(1, Math.round(Math.abs(delaySeconds) / 60));
  return category === 'early' ? `${minutes} min early` : `${minutes} min late`;
}
