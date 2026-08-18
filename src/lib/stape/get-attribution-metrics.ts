import { getAlignedPeriod } from "@/lib/dashboard/aligned-period";
import { DEFAULT_ATTRIBUTION_WINDOW_DAYS } from "@/lib/attribution/windows";
import { CHANNEL_SQL, ATTRIBUTION_CHANNELS } from "@/lib/stape/channel-sql";
import { getBigQueryClient } from "@/lib/stape/client";
import { eventsFromSql, getBigQueryConfig, identityMapSql } from "@/lib/stape/config";
import type {
  AttributionMetrics,
  ChannelContribution,
  TrackingField,
} from "@/lib/stape/attribution-types";
import type { TrafficSource } from "@/lib/stape/types";

/** Default lookback for True Performance and callers that do not pass a window. */
export const ATTRIBUTION_LOOKBACK_DAYS = DEFAULT_ATTRIBUTION_WINDOW_DAYS;

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

function emptyMetrics(
  periodLabel: string,
  lookbackDays: number = ATTRIBUTION_LOOKBACK_DAYS,
): AttributionMetrics {
  return {
    status: { state: "not_configured" },
    periodLabel,
    lookbackDays,
    attributedOrders: 0,
    attributedRevenue: 0,
    firstTouch: [],
    lastTouch: [],
    firstNonDirect: [],
    lastNonDirect: [],
    lastClick: [],
    linear: [],
    orders: [],
    identity: {
      purchases: 0,
      purchasesWithPerson: 0,
      uniquePeople: 0,
      uniqueBrowsers: 0,
      crossDevicePeople: 0,
    },
    tracking: [],
    hasPurchaseEvents: false,
    gaps: [],
  };
}

export async function getAttributionMetrics(options?: {
  lookbackDays?: number;
}): Promise<AttributionMetrics> {
  const period = await getAlignedPeriod();
  const lookbackDays =
    options?.lookbackDays && options.lookbackDays > 0
      ? options.lookbackDays
      : ATTRIBUTION_LOOKBACK_DAYS;

  try {
    if (!getBigQueryConfig()) {
      return emptyMetrics(period.label, lookbackDays);
    }

    const { client, config } = getBigQueryClient();
    const table = eventsFromSql(config);
    const identity = identityMapSql(config);
    const queryOptions = { location: config.location };
    const timeParams = {
      startMs: period.startMs,
      endMs: period.endMs,
      lookbackMs: lookbackDays * 24 * 60 * 60 * 1000,
    };

    const eventsCte = `
      WITH identity AS (
        SELECT client_id, user_id FROM ${identity}
      ),
      event_rows AS (
        SELECT
          CONCAT(IFNULL(e.client_id, ''), '|', IFNULL(e.ga_session_id, '')) AS session_key,
          e.client_id,
          COALESCE(
            NULLIF(identity.user_id, ''),
            NULLIF(e.user_id, ''),
            e.client_id
          ) AS person_key,
          e.timestamp,
          LOWER(IFNULL(e.event_name, '')) AS event_name,
          LOWER(IFNULL(e.page_location, '')) AS page_location,
          LOWER(IFNULL(e.page_referrer, '')) AS page_referrer,
          IFNULL(e.gclid, '') AS gclid,
          IFNULL(e.gbraid, '') AS gbraid,
          IFNULL(e.wbraid, '') AS wbraid,
          IFNULL(e.dclid, '') AS dclid,
          IFNULL(e.fbclid, '') AS fbclid,
          IFNULL(e.fbc, '') AS fbc,
          IFNULL(e.ttclid, '') AS ttclid,
          IFNULL(e.msclkid, '') AS msclkid,
          e.transaction_id,
          e.value
        FROM ${table} e
        LEFT JOIN identity
          ON identity.client_id = e.client_id
        WHERE e.timestamp >= @startMs - @lookbackMs
          AND e.timestamp < @endMs
      ),
      events AS (
        SELECT
          event_rows.*,
          ${CHANNEL_SQL} AS channel
        FROM event_rows
      )
    `;

    const [firstRows] = await client.query({
      ...queryOptions,
      params: timeParams,
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
              AND session_key != '|'
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
              AND session_key != '|'
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
            ANY_VALUE(person_key) AS person_key,
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
            ON e.person_key = p.person_key
           AND IFNULL(e.person_key, '') != ''
           AND e.timestamp <= p.purchase_ts
           AND e.timestamp >= p.purchase_ts - @lookbackMs
        ),
        order_attr AS (
          SELECT
            transaction_id,
            ANY_VALUE(revenue) AS revenue,
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

    const [orderRows] = await client.query({
      ...queryOptions,
      params: timeParams,
      query: `
        ${eventsCte},
        purchases AS (
          SELECT
            transaction_id,
            ANY_VALUE(person_key) AS person_key,
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
            p.person_key,
            p.revenue,
            p.purchase_ts,
            e.timestamp,
            e.channel
          FROM purchases p
          JOIN events e
            ON e.person_key = p.person_key
           AND IFNULL(e.person_key, '') != ''
           AND e.timestamp <= p.purchase_ts
           AND e.timestamp >= p.purchase_ts - @lookbackMs
        )
        SELECT
          transaction_id AS transactionId,
          ANY_VALUE(person_key) AS personKey,
          ANY_VALUE(revenue) AS revenue,
          ANY_VALUE(purchase_ts) AS purchaseTs,
          ARRAY_AGG(STRUCT(timestamp AS ts, channel AS channel) ORDER BY timestamp) AS touches,
          IFNULL(
            ARRAY_AGG(IF(channel = 'Direct', NULL, channel) IGNORE NULLS ORDER BY timestamp LIMIT 1)[SAFE_OFFSET(0)],
            'Direct'
          ) AS firstNonDirect,
          IFNULL(
            ARRAY_AGG(IF(channel = 'Direct', NULL, channel) IGNORE NULLS ORDER BY timestamp DESC LIMIT 1)[SAFE_OFFSET(0)],
            'Direct'
          ) AS lastNonDirect,
          ARRAY_AGG(channel ORDER BY timestamp DESC LIMIT 1)[OFFSET(0)] AS lastClick
        FROM paths
        GROUP BY transaction_id
      `,
    });

    const [identityRows] = await client.query({
      ...queryOptions,
      params: timeParams,
      query: `
        ${eventsCte}
        SELECT
          COUNT(DISTINCT IF(event_name = 'purchase' AND IFNULL(transaction_id, '') != '', transaction_id, NULL)) AS purchases,
          COUNT(DISTINCT IF(
            event_name = 'purchase' AND IFNULL(transaction_id, '') != '' AND person_key != client_id,
            transaction_id,
            NULL
          )) AS purchases_with_person,
          COUNT(DISTINCT person_key) AS unique_people,
          COUNT(DISTINCT client_id) AS unique_browsers
        FROM events
        WHERE timestamp >= @startMs AND timestamp < @endMs
      `,
    });

    const [crossDeviceRows] = await client.query({
      ...queryOptions,
      query: `
        SELECT COUNT(*) AS cross_device_people
        FROM (
          SELECT identity.user_id
          FROM ${identity} identity
          JOIN ${table} e
            ON e.client_id = identity.client_id
          WHERE LOWER(IFNULL(e.event_name, '')) = 'page_view'
          GROUP BY identity.user_id
          HAVING COUNT(DISTINCT e.client_id) > 1
        )
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
            OR (gbraid IS NOT NULL AND gbraid != '')
            OR (wbraid IS NOT NULL AND wbraid != '')
            OR LOWER(IFNULL(page_location, '')) LIKE '%gclid=%'
            OR LOWER(IFNULL(page_location, '')) LIKE '%gbraid=%'
            OR LOWER(IFNULL(page_location, '')) LIKE '%wbraid=%'
          ) AS gclid,
          COUNTIF(
            (fbclid IS NOT NULL AND fbclid != '')
            OR (fbc IS NOT NULL AND fbc != '')
            OR LOWER(IFNULL(page_location, '')) LIKE '%fbclid=%'
            OR REGEXP_CONTAINS(LOWER(IFNULL(page_location, '')), r'[?&]utm_source=(facebook|fb|ig|instagram|meta)')
          ) AS facebook_ids,
          COUNTIF(fbp IS NOT NULL AND fbp != '') AS fbp,
          COUNTIF(transaction_id IS NOT NULL AND transaction_id != '') AS transaction_id,
          COUNTIF(
            LOWER(IFNULL(event_name, '')) IN ('purchase', 'order_completed')
            AND IFNULL(transaction_id, '') != ''
          ) AS purchase,
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
      { label: "purchase + transaction_id", filled: toNumber(tracking.purchase), total, needed: true },
    ];

    const models = modelRows as {
      model: string;
      source: string;
      orders: number;
      revenue: number;
    }[];
    const totals = models.find((row) => row.model === "totals");
    const identityStats = (identityRows[0] ?? {}) as Record<string, unknown>;
    const orders = (orderRows as Record<string, unknown>[]).map((row) => {
      const touches = (
        Array.isArray(row.touches) ? row.touches : []
      ) as { ts?: unknown; channel?: unknown }[];
      return {
        transactionId: String(row.transactionId ?? ""),
        revenue: toNumber(row.revenue),
        firstNonDirect: String(row.firstNonDirect ?? "Direct"),
        lastNonDirect: String(row.lastNonDirect ?? "Direct"),
        lastClick: String(row.lastClick ?? "Direct"),
        personKey: String(row.personKey ?? ""),
        purchaseTs: toNumber(row.purchaseTs),
        touches: touches.map((touch) => ({
          ts: toNumber(touch.ts),
          channel: String(touch.channel ?? "Direct"),
        })),
      };
    });
    const gaps: string[] = [];

    if (toNumber(tracking.gclid) === 0) {
      gaps.push("No Google click IDs yet. Google Ads will only show up from UTMs in the URL.");
    }
    if (toNumber(tracking.fbp) === 0) {
      gaps.push("fbp / fbc cookies are not stored as columns. Facebook is detected from UTMs in page URLs.");
    }

    return {
      status: { state: "connected", projectId: config.projectId },
      periodLabel: period.label,
      lookbackDays,
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
      orders,
      identity: {
        purchases: toNumber(identityStats.purchases),
        purchasesWithPerson: toNumber(identityStats.purchases_with_person),
        uniquePeople: toNumber(identityStats.unique_people),
        uniqueBrowsers: toNumber(identityStats.unique_browsers),
        crossDevicePeople: toNumber(
          (crossDeviceRows[0] as { cross_device_people?: number } | undefined)
            ?.cross_device_people,
        ),
      },
      tracking: fields,
      hasPurchaseEvents: toNumber(tracking.purchase) > 0,
      gaps,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load attribution data.";
    return {
      ...emptyMetrics(period.label, lookbackDays),
      status: { state: "error", message },
    };
  }
}
