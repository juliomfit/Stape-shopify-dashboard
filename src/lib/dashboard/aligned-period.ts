import { formatDate } from "@/lib/format";
import {
  overviewPeriodLabel,
  type RangeDays,
} from "@/lib/period";
import { getSelectedRangeDays } from "@/lib/period-server";
import { getBigQueryClient } from "@/lib/stape/client";
import { getBigQueryConfig, tableId } from "@/lib/stape/config";

export type AlignedPeriod = {
  startMs: number;
  startIso: string;
  label: string;
  days: RangeDays;
};

const CACHE_MS = 30_000;
let cachedPeriod: {
  days: RangeDays;
  value: AlignedPeriod;
  expiresAt: number;
} | null = null;

function rangeStartMs(days: RangeDays) {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function periodFromStartMs(startMs: number, days: RangeDays): AlignedPeriod {
  const startIso = new Date(startMs).toISOString().slice(0, 10);
  const rangeStartIso = new Date(rangeStartMs(days)).toISOString().slice(0, 10);

  return {
    startMs,
    startIso,
    days,
    label:
      startIso <= rangeStartIso
        ? overviewPeriodLabel(days)
        : `Since ${formatDate(`${startIso}T12:00:00.000Z`)}`,
  };
}

export async function getAlignedPeriod(): Promise<AlignedPeriod> {
  const days = await getSelectedRangeDays();

  if (
    cachedPeriod &&
    cachedPeriod.days === days &&
    Date.now() < cachedPeriod.expiresAt
  ) {
    return cachedPeriod.value;
  }

  const fallback = periodFromStartMs(rangeStartMs(days), days);

  try {
    if (!getBigQueryConfig()) {
      cachedPeriod = { days, value: fallback, expiresAt: Date.now() + CACHE_MS };
      return fallback;
    }

    const { client, config } = getBigQueryClient();
    const [rows] = await client.query({
      query: `
        SELECT MIN(timestamp) AS firstEvent
        FROM ${tableId(config)}
        WHERE timestamp IS NOT NULL
      `,
      location: config.location,
    });

    const firstEvent = Number(rows[0]?.firstEvent ?? 0);
    const startMs =
      firstEvent > 0 ? Math.max(firstEvent, rangeStartMs(days)) : rangeStartMs(days);
    const value = periodFromStartMs(startMs, days);
    cachedPeriod = { days, value, expiresAt: Date.now() + CACHE_MS };
    return value;
  } catch {
    cachedPeriod = { days, value: fallback, expiresAt: Date.now() + CACHE_MS };
    return fallback;
  }
}

export function shopifyMetricsSince(
  orderPoints: { createdAt: string; amount: number }[],
  startIso: string,
) {
  const matched = orderPoints.filter(
    (order) => order.createdAt.slice(0, 10) >= startIso,
  );

  return {
    orders: matched.length,
    revenue: matched.reduce((total, order) => total + order.amount, 0),
  };
}
