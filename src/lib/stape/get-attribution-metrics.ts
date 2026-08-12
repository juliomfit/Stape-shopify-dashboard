import { getAlignedPeriod } from "@/lib/dashboard/aligned-period";
import { CHANNEL_SQL, ATTRIBUTION_CHANNELS } from "@/lib/stape/channel-sql";
import { getBigQueryClient } from "@/lib/stape/client";
import { eventsFromSql, getBigQueryConfig } from "@/lib/stape/config";
import type {
  AttributionMetrics,
  ChannelContribution,
  TrackingField,
} from "@/lib/stape/attribution-types";
import type { TrafficSource } from "@/lib/stape/types";

export const ATTRIBUTION_LOOKBACK_DAYS = 7;

function toNumber(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function withSessions(rows: { source: string; sessions: number }[]): TrafficSource[] {
  const counts = new Map(rows.map((row) => [row.source, toNumber(row.sessions)]));
  return ATTRIBUTION_CHANNELS.map((source) => ({
    source,
    sessions: counts.get(source) ?? 0,
  }));
}

function withContribution(
  rows: { source: string; orders?: number; revenue?: number }[],
): ChannelContribution[] {
  const bySource = new Map(
    rows.map((row) => [
      row.source,
      { orders: toNumber(row.orders), revenue: toNumber(row.revenue) },
    ]),
  );

  return ATTRIBUTION_CHANNELS.map((source) => ({
    source,
    orders: bySource.get(source)?.orders ?? 0,
    revenue: bySource.get(source)?.revenue ?? 0,
  }));
}

function emptyMetrics(periodLabel: string): AttributionMetrics {
  return {
    status: { state: "not_configured" },
    periodLabel,
    lookbackDays: ATTRIBUTION_LOOKBACK_DAYS,
    attributedOrders: 0,
    attributedRevenue: 0,
    firstTouch: [],
    lastTouch: [],
    firstNonDirect: [],
    lastNonDirect: [],
    lastClick: [],
    linear: [],
    tracking: [],
    hasPurchaseEvents: false,
    gaps: [],
  };
}

export async function getAttributionMetrics(): Promise<AttributionMetrics> {
  const period = await getAlignedPeriod();

  try {
    if (!getBigQueryConfig()) {
      return emptyMetrics(period.label);
    }

    const { client, config } = getBigQueryClient();
    const table = eventsFromSql(config);
    const queryOptions = { location: config.location };
    const timeParams = {
      startMs: period.startMs,
      endMs: period.endMs,
      lookbackMs: ATTRIBUTION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
    };

    const eventsCte = `
      WITH events AS (
        SELECT
          CONCAT(IFNULL(client_id, ''), '|', IFNULL(ga_session_id, '')) AS session_key,
          client_id,
          timestamp,
          LOWER(IFNULL(event_name, '')) AS event_name,
          LOWER(IFNULL(page_location, '')) AS page_location,
          LOWER(IFNULL(page_referrer, '')) AS page_referrer,
          IFNULL(gclid, '') AS gclid,
          IFNULL(fbclid, '') AS fbclid,
          IFNULL(fbc, '') AS fbc,
          transaction_id,
          value,
          ${CHANNEL_SQL} AS channel
        FROM ${table}
      )
    `;

    const [firstRows] = await client.query({
      ...queryOptions,
      params: { startMs: period.startMs, endMs: period.endMs },
      query: `
        ${eventsCte}
        SELECT channel AS source, COUNT(*) AS sessions
        FROM (
          SELECT * EXCEPT (rn)
          FROM (
            SELECT
              events.*,
              ROW_NUMBER() OVER (PARTITION BY session_key ORDER BY timestamp) AS rn
            FROM events
            WHERE timestamp >= @startMs AND timestamp < @endMs
          )
          WHERE rn = 1
        )
        GROUP BY 1
      `,
    });

    const [lastRows] = await client.query({
      ...queryOptions,
      params: { startMs: period.startMs, endMs: period.endMs },
      query: `
        ${eventsCte}
        SELECT channel AS source, COUNT(*) AS sessions
        FROM (
          SELECT * EXCEPT (rn)
          FROM (
            SELECT
              events.*,
              ROW_NUMBER() OVER (PARTITION BY session_key ORDER BY timestamp DESC) AS rn
            FROM events
            WHERE timestamp >= @startMs AND timestamp < @endMs
          )
          WHERE rn = 1
        )
        GROUP BY 1
      `,
    });

    const [modelRows] = await client.query({
      ...queryOptions,
      params: timeParams,
      query: `
        ${eventsCte},
        purchases AS (
          SELECT
            transaction_id,
            ANY_VALUE(client_id) AS client_id,
            MIN(timestamp) AS purchase_ts,
            MAX(value) AS revenue
          FROM events
          WHERE event_name = 'purchase'
            AND IFNULL(transaction_id, '') != ''
            AND timestamp >= @startMs
            AND timestamp < @endMs
          GROUP BY transaction_id
        ),
        paths AS (
          SELECT
            p.transaction_id,
            p.revenue,
            e.timestamp,
            e.channel
          FROM purchases p
          JOIN events e
            ON e.client_id = p.client_id
           AND IFNULL(e.client_id, '') != ''
           AND e.timestamp <= p.purchase_ts
           AND e.timestamp >= p.purchase_ts - @lookbackMs
        ),
        order_attr AS (
          SELECT
            transaction_id,
            ANY_VALUE(revenue) AS revenue,
            ARRAY_AGG(channel ORDER BY timestamp LIMIT 1)[OFFSET(0)] AS first_touch,
            IFNULL(
              ARRAY_AGG(IF(channel = 'Direct', NULL, channel) IGNORE NULLS ORDER BY timestamp LIMIT 1)[SAFE_OFFSET(0)],
              'Direct'
            ) AS first_non_direct,
            ARRAY_AGG(channel ORDER BY timestamp DESC LIMIT 1)[OFFSET(0)] AS last_touch,
            IFNULL(
              ARRAY_AGG(IF(channel = 'Direct', NULL, channel) IGNORE NULLS ORDER BY timestamp DESC LIMIT 1)[SAFE_OFFSET(0)],
              'Direct'
            ) AS last_non_direct
          FROM paths
          GROUP BY transaction_id
        ),
        non_direct AS (
          SELECT DISTINCT transaction_id, revenue, channel
          FROM paths
          WHERE channel != 'Direct'
        ),
        linear_base AS (
          SELECT
            channel,
            revenue / COUNT(*) OVER (PARTITION BY transaction_id) AS revenue_share,
            transaction_id
          FROM non_direct
        ),
        direct_only AS (
          SELECT transaction_id, ANY_VALUE(revenue) AS revenue
          FROM order_attr
          WHERE transaction_id NOT IN (SELECT transaction_id FROM non_direct)
          GROUP BY transaction_id
        )
        SELECT 'first_non_direct' AS model, first_non_direct AS source, COUNT(*) AS orders, SUM(revenue) AS revenue
        FROM order_attr
        GROUP BY 2
        UNION ALL
        SELECT 'last_non_direct', last_non_direct, COUNT(*), SUM(revenue)
        FROM order_attr
        GROUP BY 2
        UNION ALL
        SELECT 'last_click', last_touch, COUNT(*), SUM(revenue)
        FROM order_attr
        GROUP BY 2
        UNION ALL
        SELECT 'linear', channel, COUNT(DISTINCT transaction_id), SUM(revenue_share)
        FROM linear_base
        GROUP BY 2
        UNION ALL
        SELECT 'linear', 'Direct', COUNT(*), SUM(revenue)
        FROM direct_only
        UNION ALL
        SELECT 'totals', 'all', COUNT(*), SUM(revenue)
        FROM order_attr
      `,
    });

    const [trackingRows] = await client.query({
      ...queryOptions,
      params: { startMs: period.startMs, endMs: period.endMs },
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
          AND timestamp < @endMs
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

    const models = modelRows as {
      model: string;
      source: string;
      orders: number;
      revenue: number;
    }[];
    const totals = models.find((row) => row.model === "totals");
    const gaps: string[] = [];

    if (toNumber(tracking.gclid) === 0) {
      gaps.push("No Google click IDs yet. Google Ads will only show up from UTMs in the URL.");
    }
    if (toNumber(tracking.fbp) === 0) {
      gaps.push("fbp / fbc cookies are not stored as columns. Facebook is detected from UTMs in page URLs.");
    }
    gaps.push("user_id is empty, so we stitch journeys with client_id only (same browser).");
    gaps.push("Ad spend is not in BigQuery, so MER / blended ROAS cannot be calculated yet.");
    gaps.push("Meta and Google Ads Manager numbers are not connected, so this page does not show platform-claimed conversions.");

    return {
      status: { state: "connected", projectId: config.projectId },
      periodLabel: period.label,
      lookbackDays: ATTRIBUTION_LOOKBACK_DAYS,
      attributedOrders: toNumber(totals?.orders),
      attributedRevenue: toNumber(totals?.revenue),
      firstTouch: withSessions(firstRows as { source: string; sessions: number }[]),
      lastTouch: withSessions(lastRows as { source: string; sessions: number }[]),
      firstNonDirect: withContribution(
        models.filter((row) => row.model === "first_non_direct"),
      ),
      lastNonDirect: withContribution(
        models.filter((row) => row.model === "last_non_direct"),
      ),
      lastClick: withContribution(models.filter((row) => row.model === "last_click")),
      linear: withContribution(models.filter((row) => row.model === "linear")),
      tracking: fields,
      hasPurchaseEvents: toNumber(tracking.purchase) > 0,
      gaps,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load attribution data.";
    return {
      ...emptyMetrics(period.label),
      status: { state: "error", message },
    };
  }
}
