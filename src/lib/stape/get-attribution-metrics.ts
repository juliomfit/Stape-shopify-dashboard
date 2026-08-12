import { getAlignedPeriod } from "@/lib/dashboard/aligned-period";
import { overviewPeriodLabel } from "@/lib/period";
import { getSelectedRangeDays } from "@/lib/period-server";
import { CHANNEL_SQL } from "@/lib/stape/channel-sql";
import { getBigQueryClient } from "@/lib/stape/client";
import { getBigQueryConfig, tableId } from "@/lib/stape/config";
import type {
  AttributionMetrics,
  TrackingField,
} from "@/lib/stape/attribution-types";
import type { TrafficSource } from "@/lib/stape/types";

const CHANNELS = [
  "Google Ads",
  "Facebook / Meta Ads",
  "Google Organic",
  "Meta Organic",
  "Direct",
  "Other",
] as const;

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function withAllChannels(rows: { source: string; sessions: number }[]): TrafficSource[] {
  const counts = new Map(rows.map((row) => [row.source, toNumber(row.sessions)]));
  return CHANNELS.map((source) => ({
    source,
    sessions: counts.get(source) ?? 0,
  }));
}

function emptyMetrics(days: number): AttributionMetrics {
  return {
    status: { state: "not_configured" },
    periodLabel: overviewPeriodLabel(days),
    firstTouch: [],
    lastTouch: [],
    tracking: [],
    hasPurchaseEvents: false,
  };
}

export async function getAttributionMetrics(): Promise<AttributionMetrics> {
  const days = await getSelectedRangeDays();

  try {
    if (!getBigQueryConfig()) {
      return emptyMetrics(days);
    }

    const period = await getAlignedPeriod();
    const { client, config } = getBigQueryClient();
    const table = tableId(config);
    const queryOptions = { location: config.location };
    const timeParams = { startMs: period.startMs };

    const hitsCte = `
      WITH hits AS (
        SELECT
          CONCAT(IFNULL(client_id, ''), '|', IFNULL(ga_session_id, '')) AS session_key,
          timestamp,
          LOWER(IFNULL(page_location, '')) AS page_location,
          LOWER(IFNULL(page_referrer, '')) AS page_referrer,
          IFNULL(gclid, '') AS gclid,
          IFNULL(fbclid, '') AS fbclid,
          IFNULL(fbc, '') AS fbc,
          ${CHANNEL_SQL} AS channel
        FROM ${table}
        WHERE timestamp >= @startMs
      )
    `;

    const [firstRows] = await client.query({
      ...queryOptions,
      params: timeParams,
      query: `
        ${hitsCte}
        SELECT channel AS source, COUNT(*) AS sessions
        FROM (
          SELECT * EXCEPT (rn)
          FROM (
            SELECT hits.*, ROW_NUMBER() OVER (PARTITION BY session_key ORDER BY timestamp) AS rn
            FROM hits
          )
          WHERE rn = 1
        )
        GROUP BY 1
      `,
    });

    const [lastRows] = await client.query({
      ...queryOptions,
      params: timeParams,
      query: `
        ${hitsCte}
        SELECT channel AS source, COUNT(*) AS sessions
        FROM (
          SELECT * EXCEPT (rn)
          FROM (
            SELECT hits.*, ROW_NUMBER() OVER (PARTITION BY session_key ORDER BY timestamp DESC) AS rn
            FROM hits
          )
          WHERE rn = 1
        )
        GROUP BY 1
      `,
    });

    const [trackingRows] = await client.query({
      ...queryOptions,
      params: timeParams,
      query: `
        SELECT
          COUNT(*) AS total,
          COUNTIF(client_id IS NOT NULL AND client_id != '') AS client_id,
          COUNTIF(ga_session_id IS NOT NULL AND ga_session_id != '') AS ga_session_id,
          COUNTIF(event_id IS NOT NULL AND event_id != '') AS event_id,
          COUNTIF(
            (gclid IS NOT NULL AND gclid != '')
            OR LOWER(IFNULL(page_location, '')) LIKE '%gclid=%'
          ) AS gclid,
          COUNTIF(
            (fbclid IS NOT NULL AND fbclid != '')
            OR (fbc IS NOT NULL AND fbc != '')
            OR LOWER(IFNULL(page_location, '')) LIKE '%fbclid=%'
            OR REGEXP_CONTAINS(LOWER(IFNULL(page_location, '')), r'[?&]utm_source=(facebook|fb|ig|instagram|meta)')
          ) AS facebook_ids,
          COUNTIF(fbp IS NOT NULL AND fbp != '') AS fbp,
          COUNTIF(transaction_id IS NOT NULL AND transaction_id != '') AS transaction_id,
          COUNTIF(LOWER(IFNULL(event_name, '')) IN ('purchase', 'order_completed')) AS purchase,
          COUNTIF(LOWER(IFNULL(event_name, '')) = 'begin_checkout') AS begin_checkout
        FROM ${table}
        WHERE timestamp >= @startMs
      `,
    });

    const tracking = trackingRows[0] as Record<string, unknown>;
    const total = toNumber(tracking.total);
    const fields: TrackingField[] = [
      { label: "client_id", filled: toNumber(tracking.client_id), total, needed: true },
      { label: "ga_session_id", filled: toNumber(tracking.ga_session_id), total, needed: true },
      { label: "event_id", filled: toNumber(tracking.event_id), total, needed: true },
      { label: "Google click IDs (gclid)", filled: toNumber(tracking.gclid), total, needed: true },
      { label: "Meta click IDs / UTMs", filled: toNumber(tracking.facebook_ids), total, needed: true },
      { label: "fbp cookie", filled: toNumber(tracking.fbp), total, needed: false },
      { label: "begin_checkout", filled: toNumber(tracking.begin_checkout), total, needed: true },
      { label: "purchase + transaction_id", filled: toNumber(tracking.purchase) + toNumber(tracking.transaction_id), total, needed: true },
    ];

    return {
      status: { state: "connected", projectId: config.projectId },
      periodLabel: period.label,
      firstTouch: withAllChannels(firstRows as { source: string; sessions: number }[]),
      lastTouch: withAllChannels(lastRows as { source: string; sessions: number }[]),
      tracking: fields,
      hasPurchaseEvents: toNumber(tracking.purchase) > 0,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load attribution data.";
    return {
      ...emptyMetrics(days),
      status: { state: "error", message },
    };
  }
}
