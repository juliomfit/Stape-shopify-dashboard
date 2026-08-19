/**
 * Canonical attribution windows. Every OUR-attribution page must use these.
 *
 * 90-day is intentionally omitted until raw_events_full partition retention is
 * extended (see bigquery/migrations/2026_08_18_003_dashboard_events_lifecycle.sql).
 * Do not display a window the warehouse cannot actually retain.
 *
 * Production default: 7 days. Validated 2026-08-19 on
 * v_attribution_credit_v1 (linear, non-direct, n=69):
 *   P50=0h P75=0h P90=0h P95=3h P99=69h
 * TIMESTAMP_DIFF HOUR truncates; 0h means same clock-hour / sub-hour.
 * 90-day stays hidden until raw_events_full retention covers it.
 */

export const ATTRIBUTION_WINDOW_DAYS = [1, 7, 14, 30, 60] as const;
export type AttributionWindowDays = (typeof ATTRIBUTION_WINDOW_DAYS)[number];

export const DEFAULT_ATTRIBUTION_WINDOW_DAYS: AttributionWindowDays = 7;

export const ATTRIBUTION_WINDOW_PRODUCTION_DEFAULT_STATUS = "7d validated" as const;

export const ATTRIBUTION_WINDOW_NOTE =
  "Default is 7 days. Production conversion lag 2026-08-19: P90=0h, P99=69h (n=69). 90-day is hidden until event retention covers it.";

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
