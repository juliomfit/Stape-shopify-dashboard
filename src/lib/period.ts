export const DASHBOARD_TZ = "America/Los_Angeles";

export const RANGE_KEYS = [
  "today",
  "yesterday",
  "7d",
  "14d",
  "30d",
  "this_month",
  "last_month",
  "custom",
] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

export const RANGE_OPTIONS: { key: Exclude<RangeKey, "custom">; label: string }[] =
  [
    { key: "today", label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "7d", label: "7d" },
    { key: "14d", label: "14d" },
    { key: "30d", label: "30d" },
    { key: "this_month", label: "This month" },
    { key: "last_month", label: "Last month" },
  ];

export const DEFAULT_RANGE: RangeKey = "today";
export const RANGE_COOKIE = "dashboard_range";
export const CUSTOM_RANGE_COOKIE = "dashboard_custom_range";
export const MAX_CUSTOM_DAYS = 366;

export type CustomRange = {
  startDate: string;
  endDate: string;
};

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
  dayCount: number;
  displayRange: string;
  todayDate: string;
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

export function ymd(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseYmd(value: string | undefined | null) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value || "").trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() + 1 !== month ||
    check.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function compareYmd(
  a: { year: number; month: number; day: number },
  b: { year: number; month: number; day: number },
) {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

export function inclusiveDayCount(startDate: string, endDate: string) {
  const start = parseYmd(startDate);
  const end = parseYmd(endDate);
  if (!start || !end) {
    return 0;
  }

  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const endUtc = Date.UTC(end.year, end.month - 1, end.day);
  return Math.floor((endUtc - startUtc) / 86_400_000) + 1;
}

export function formatDisplayRange(startDate: string, endDate: string) {
  const start = parseYmd(startDate);
  const end = parseYmd(endDate);
  if (!start || !end) {
    return startDate;
  }

  const startMs = Date.UTC(start.year, start.month - 1, start.day);
  const endMs = Date.UTC(end.year, end.month - 1, end.day);
  const sameDay = startDate === endDate;
  const sameYear = start.year === end.year;

  if (sameDay) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(startMs));
  }

  const startLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  }).format(new Date(startMs));
  const endLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(endMs));

  return `${startLabel} – ${endLabel}`;
}

export function parseRangeKey(value: string | undefined): RangeKey {
  if (RANGE_KEYS.includes(value as RangeKey)) {
    return value as RangeKey;
  }

  if (value === "7") {
    return "7d";
  }

  if (value === "30") {
    return "30d";
  }

  return DEFAULT_RANGE;
}

export function parseCustomRange(value: string | undefined | null): CustomRange | null {
  const [startDate, endDate] = (value || "").split(":");
  if (!parseYmd(startDate) || !parseYmd(endDate)) {
    return null;
  }

  return { startDate, endDate };
}

export function serializeCustomRange(range: CustomRange) {
  return `${range.startDate}:${range.endDate}`;
}

export function rangeLabel(key: RangeKey, displayRange?: string) {
  switch (key) {
    case "today":
      return "Today";
    case "yesterday":
      return "Yesterday";
    case "7d":
      return "Last 7 days";
    case "14d":
      return "Last 14 days";
    case "30d":
      return "Last 30 days";
    case "this_month":
      return "This month";
    case "last_month":
      return "Last month";
    case "custom":
      return displayRange || "Custom range";
  }
}

function normalizeCustomRange(
  custom: CustomRange,
  today: { year: number; month: number; day: number },
): { startDay: { year: number; month: number; day: number }; endInclusive: { year: number; month: number; day: number } } {
  let start = parseYmd(custom.startDate) || today;
  let end = parseYmd(custom.endDate) || today;

  if (compareYmd(start, end) > 0) {
    const swap = start;
    start = end;
    end = swap;
  }

  if (compareYmd(end, today) > 0) {
    end = today;
  }

  const days = inclusiveDayCount(ymd(start.year, start.month, start.day), ymd(end.year, end.month, end.day));
  if (days > MAX_CUSTOM_DAYS) {
    start = addDays(end.year, end.month, end.day, -(MAX_CUSTOM_DAYS - 1));
  }

  return { startDay: start, endInclusive: end };
}

export function getDashboardPeriod(
  key: RangeKey,
  now: Date = new Date(),
  custom?: CustomRange | null,
): DashboardPeriod {
  const today = zonedParts(now, DASHBOARD_TZ);
  const todayStart = { year: today.year, month: today.month, day: today.day };

  let startDay = todayStart;
  let endDay = addDays(todayStart.year, todayStart.month, todayStart.day, 1);
  let resolvedKey = key;

  if (key === "yesterday") {
    startDay = addDays(todayStart.year, todayStart.month, todayStart.day, -1);
    endDay = todayStart;
  } else if (key === "7d") {
    startDay = addDays(todayStart.year, todayStart.month, todayStart.day, -6);
  } else if (key === "14d") {
    startDay = addDays(todayStart.year, todayStart.month, todayStart.day, -13);
  } else if (key === "30d") {
    startDay = addDays(todayStart.year, todayStart.month, todayStart.day, -29);
  } else if (key === "this_month") {
    startDay = { year: todayStart.year, month: todayStart.month, day: 1 };
  } else if (key === "last_month") {
    const firstThisMonth = { year: todayStart.year, month: todayStart.month, day: 1 };
    const lastOfPrev = addDays(
      firstThisMonth.year,
      firstThisMonth.month,
      firstThisMonth.day,
      -1,
    );
    startDay = { year: lastOfPrev.year, month: lastOfPrev.month, day: 1 };
    endDay = firstThisMonth;
  } else if (key === "custom") {
    if (!custom) {
      resolvedKey = "7d";
      startDay = addDays(todayStart.year, todayStart.month, todayStart.day, -6);
    } else {
      const normalized = normalizeCustomRange(custom, todayStart);
      startDay = normalized.startDay;
      endDay = addDays(
        normalized.endInclusive.year,
        normalized.endInclusive.month,
        normalized.endInclusive.day,
        1,
      );
    }
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
  const startDate = ymd(startDay.year, startDay.month, startDay.day);
  const endDate = ymd(lastDay.year, lastDay.month, lastDay.day);
  const displayRange = formatDisplayRange(startDate, endDate);
  const dayCount = inclusiveDayCount(startDate, endDate);

  return {
    key: resolvedKey,
    label:
      resolvedKey === "custom"
        ? displayRange
        : `${rangeLabel(resolvedKey)} · ${displayRange}`,
    timeZone: DASHBOARD_TZ,
    startMs,
    endMs,
    startDate,
    endDate,
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
    dayCount,
    displayRange,
    todayDate: ymd(todayStart.year, todayStart.month, todayStart.day),
  };
}

export function shopifyOrdersQuery(period: DashboardPeriod) {
  // GraphQL orders default to open-only; include closed paid/archived orders.
  // Cancelled orders stay out unless we opt into status:any.
  return `created_at:>='${period.startIso}' AND created_at:<'${period.endIso}' AND (status:open OR status:closed)`;
}

/** @deprecated Use rangeLabel / getDashboardPeriod */
export function overviewPeriodLabel(key: RangeKey | number = DEFAULT_RANGE) {
  if (typeof key === "number") {
    return key === 7 ? rangeLabel("7d") : rangeLabel("30d");
  }

  return rangeLabel(key);
}
