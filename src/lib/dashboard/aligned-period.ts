import { formatDate } from "@/lib/format";
import { OVERVIEW_DAYS, overviewPeriodLabel } from "@/lib/period";
import { getBigQueryClient } from "@/lib/stape/client";
import { getBigQueryConfig, tableId } from "@/lib/stape/config";

export type AlignedPeriod = {
  startMs: number;
  startIso: string;
  label: string;
};

const CACHE_MS = 30_000;
let cachedPeriod: { value: AlignedPeriod; expiresAt: number } | null = null;

function thirtyDaysAgoMs() {
  return Date.now() - OVERVIEW_DAYS * 24 * 60 * 60 * 1000;
}

function periodFromStartMs(startMs: number): AlignedPeriod {
  const startIso = new Date(startMs).toISOString().slice(0, 10);
  const thirtyDayStart = new Date(thirtyDaysAgoMs()).toISOString().slice(0, 10);

  return {
    startMs,
    startIso,
    label:
      startIso <= thirtyDayStart
        ? overviewPeriodLabel()
        : `Since ${formatDate(`${startIso}T12:00:00.000Z`)}`,
  };
}

export async function getAlignedPeriod(): Promise<AlignedPeriod> {
  if (cachedPeriod && Date.now() < cachedPeriod.expiresAt) {
    return cachedPeriod.value;
  }

  const fallback = periodFromStartMs(thirtyDaysAgoMs());

  try {
    if (!getBigQueryConfig()) {
      cachedPeriod = { value: fallback, expiresAt: Date.now() + CACHE_MS };
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
      firstEvent > 0 ? Math.max(firstEvent, thirtyDaysAgoMs()) : thirtyDaysAgoMs();
    const value = periodFromStartMs(startMs);
    cachedPeriod = { value, expiresAt: Date.now() + CACHE_MS };
    return value;
  } catch {
    cachedPeriod = { value: fallback, expiresAt: Date.now() + CACHE_MS };
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
