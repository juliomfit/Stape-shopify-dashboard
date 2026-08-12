export const DASHBOARD_TZ = "America/Los_Angeles";

export const RANGE_KEYS = ["today", "yesterday", "7d", "30d"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
];

export const DEFAULT_RANGE: RangeKey = "today";
export const RANGE_COOKIE = "dashboard_range";

export type DashboardPeriod = {
  key: RangeKey;
  label: string;
  timeZone: string;
  startMs: number;
  endMs: number;
  startDate: string;
  endDate: string;
  startIso: string;
  endIso: string;
};

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function zonedParts(date: Date, timeZone: string): DateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

function asUtcMs(parts: Omit<DateParts, never>) {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
}

/** UTC instant for a civil datetime in `timeZone`. */
export function zonedLocalToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
) {
  const wanted = Date.UTC(year, month - 1, day, hour, minute, second);
  let utc = wanted;
  const seen = zonedParts(new Date(utc), timeZone);
  utc -= asUtcMs(seen) - wanted;
  const check = zonedParts(new Date(utc), timeZone);
  utc -= asUtcMs(check) - wanted;
  return utc;
}

function addDays(year: number, month: number, day: number, days: number) {
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function ymd(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseRangeKey(value: string | undefined): RangeKey {
  if (value === "today" || value === "yesterday" || value === "7d" || value === "30d") {
    return value;
  }

  if (value === "7") {
    return "7d";
  }

  if (value === "30") {
    return "30d";
  }

  return DEFAULT_RANGE;
}

export function rangeLabel(key: RangeKey) {
  switch (key) {
    case "today":
      return "Today";
    case "yesterday":
      return "Yesterday";
    case "7d":
      return "Last 7 days";
    case "30d":
      return "Last 30 days";
  }
}

export function getDashboardPeriod(
  key: RangeKey,
  now: Date = new Date(),
): DashboardPeriod {
  const today = zonedParts(now, DASHBOARD_TZ);
  const todayStart = { year: today.year, month: today.month, day: today.day };

  let startDay = todayStart;
  let endDay = addDays(todayStart.year, todayStart.month, todayStart.day, 1);

  if (key === "yesterday") {
    startDay = addDays(todayStart.year, todayStart.month, todayStart.day, -1);
    endDay = todayStart;
  }

  if (key === "7d") {
    startDay = addDays(todayStart.year, todayStart.month, todayStart.day, -6);
  }

  if (key === "30d") {
    startDay = addDays(todayStart.year, todayStart.month, todayStart.day, -29);
  }

  const startMs = zonedLocalToUtcMs(
    startDay.year,
    startDay.month,
    startDay.day,
    0,
    0,
    0,
    DASHBOARD_TZ,
  );
  const endMs = zonedLocalToUtcMs(
    endDay.year,
    endDay.month,
    endDay.day,
    0,
    0,
    0,
    DASHBOARD_TZ,
  );
  const lastDay = addDays(endDay.year, endDay.month, endDay.day, -1);

  return {
    key,
    label: rangeLabel(key),
    timeZone: DASHBOARD_TZ,
    startMs,
    endMs,
    startDate: ymd(startDay.year, startDay.month, startDay.day),
    endDate: ymd(lastDay.year, lastDay.month, lastDay.day),
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
  };
}

export function shopifyOrdersQuery(period: DashboardPeriod) {
  return `created_at:>='${period.startIso}' AND created_at:<'${period.endIso}'`;
}

/** @deprecated Use rangeLabel / getDashboardPeriod */
export function overviewPeriodLabel(key: RangeKey | number = DEFAULT_RANGE) {
  if (typeof key === "number") {
    return key === 7 ? rangeLabel("7d") : rangeLabel("30d");
  }

  return rangeLabel(key);
}
