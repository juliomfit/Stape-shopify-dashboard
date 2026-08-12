export const RANGE_OPTIONS = [7, 30] as const;
export type RangeDays = (typeof RANGE_OPTIONS)[number];
export const DEFAULT_RANGE_DAYS = 30;
export const RANGE_COOKIE = "dashboard_range";

export function overviewPeriodLabel(days: number = DEFAULT_RANGE_DAYS) {
  return `Last ${days} days`;
}

export function startDateIso(days: number = DEFAULT_RANGE_DAYS) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function parseRangeDays(value: string | undefined): RangeDays {
  if (value === "7") {
    return 7;
  }

  return 30;
}
