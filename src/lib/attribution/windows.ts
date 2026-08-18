/**
 * Canonical attribution windows. Every OUR-attribution page must use these.
 *
 * 90-day is intentionally omitted until raw_events_full partition retention is
 * extended (see bigquery/migrations/2026_08_18_003_dashboard_events_lifecycle.sql).
 * Do not display a window the warehouse cannot actually retain.
 *
 * Production default after conversion-lag validation:
 *   VALIDATION REQUIRED — run bigquery/validation/11_conversion_lag_distribution.sql
 * Temporary product default: 7 days (current Models / Journeys behavior).
 */

export const ATTRIBUTION_WINDOW_DAYS = [1, 7, 14, 30, 60] as const;
export type AttributionWindowDays = (typeof ATTRIBUTION_WINDOW_DAYS)[number];

export const DEFAULT_ATTRIBUTION_WINDOW_DAYS: AttributionWindowDays = 7;

export const ATTRIBUTION_WINDOW_PRODUCTION_DEFAULT_STATUS =
  "VALIDATION REQUIRED" as const;

export const ATTRIBUTION_WINDOW_NOTE =
  "Temporary default is 7 days (current product behavior). Promote a production default only after running bigquery/validation/11_conversion_lag_distribution.sql. 90-day is hidden until event retention covers it.";

export const NINETY_DAY_WINDOW_BLOCKED_REASON =
  "raw_events_full partitions currently expire around 60 days. Do not offer a 90-day attribution window until the lifecycle migration is applied and validated.";

export function isAttributionWindowDays(
  value: number,
): value is AttributionWindowDays {
  return (ATTRIBUTION_WINDOW_DAYS as readonly number[]).includes(value);
}

export function parseAttributionLookback(
  raw: string | undefined | null,
): AttributionWindowDays {
  const value = Number(raw);
  return isAttributionWindowDays(value)
    ? value
    : DEFAULT_ATTRIBUTION_WINDOW_DAYS;
}

export function parseAttributionModelParam(
  raw: string | undefined | null,
  allowed: readonly string[],
  fallback: string,
) {
  if (raw && allowed.includes(raw)) {
    return raw;
  }
  return fallback;
}
