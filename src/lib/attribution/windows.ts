export const ATTRIBUTION_WINDOW_DAYS = [7, 14, 30, 90] as const;
export type AttributionWindowDays = (typeof ATTRIBUTION_WINDOW_DAYS)[number];

/** Default Stape lookback. True Performance and other callers keep this unless they pass a window. */
export const DEFAULT_ATTRIBUTION_WINDOW_DAYS: AttributionWindowDays = 7;

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
