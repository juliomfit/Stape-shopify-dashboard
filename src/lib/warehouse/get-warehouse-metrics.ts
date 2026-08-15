import { getPlatformReported } from "@/lib/ads/get-platform-reported";
import { blendedAdSpendSource } from "@/lib/metrics/source-lines";
import { getAlignedPeriod, shopifyMetricsSince } from "@/lib/dashboard/aligned-period";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";
import { getBigQueryClient } from "@/lib/stape/client";
import { getBigQueryConfig } from "@/lib/stape/config";
import {
  DEFAULT_LOOKBACK,
  DEFAULT_MODEL,
  LOGIC_VERSION,
  TIME_DECAY_HALF_LIFE_HOURS,
  type WarehouseModel,
} from "@/lib/warehouse/constants";
import { warehouseCtes } from "@/lib/warehouse/sql";
import type {
  WarehouseChannelRow,
  WarehouseJourneyRow,
  WarehouseMetrics,
  WarehouseQuality,
} from "@/lib/warehouse/types";

function toNumber(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function emptyQuality(): WarehouseQuality {
  return {
    totalOrders: 0,
    ordersWithTransactionId: 0,
    ordersWithPersonId: 0,
    ordersWithHashedEmail: 0,
    ordersWithGnUid: 0,
    ordersWithStapeUserId: 0,
    ordersWithShopifyCustomerId: 0,
    ordersWithClickId: 0,
    ordersWithPrepurchasesSession: 0,
    highConfidenceOrders: 0,
    mediumConfidenceOrders: 0,
    lowConfidenceOrders: 0,
    directOrders: 0,
    unknownOrders: 0,
    attributedOrders: 0,
    paidSessions: 0,
    paidSessionsWithClickId: 0,
    metaSessions: 0,
    metaSessionsWithFbclid: 0,
    googleSessions: 0,
    googleSessionsWithGoogleClickId: 0,
    purchaseEventCopies: 0,
    canonicalOrders: 0,
    identityCollisions: 0,
    lateEvents: 0,
    orphanTouchpoints: 0,
    shopifyGnUidOrders: 0,
  };
}

function emptyMetrics(
  periodLabel: string,
  model: WarehouseModel,
  lookbackDays: number,
): WarehouseMetrics {
  return {
    status: { state: "not_configured" },
    periodLabel,
    model,
    lookbackDays,
    logicVersion: LOGIC_VERSION,
    orders: 0,
    revenue: 0,
    aov: 0,
    newCustomerOrders: null,
    returningCustomerOrders: null,
    attributedOrders: 0,
    attributedRevenue: 0,
    coverageRate: null,
    highConfidenceRate: null,
    directRate: null,
    unknownRate: null,
    byChannel: [],
    acquiring: [],
    closing: [],
    assisting: [],
    journeys: [],
    avgDaysToPurchase: null,
    avgTouchesToPurchase: null,
    avgSessionsToPurchase: null,
    quality: emptyQuality(),
    gaps: [],
    metaSpend: null,
    googleSpend: null,
    totalSpend: null,
    spendSource: "No ad spend for this range",
  };
}

const ATTRIBUTION_SQL = `
credited_raw AS (
  SELECT
    ot.transaction_id,
    ot.person_id,
    ot.net_revenue,
    ot.order_timestamp,
    ot.touchpoint_timestamp,
    ot.channel,
    ot.source,
    ot.medium,
    ot.campaign,
    ot.click_id,
    ot.is_paid,
    ot.is_direct,
    ot.touchpoint_id,
    ot.hours_to_conversion,
    ot.days_to_conversion,
    ot.identity_method,
    ot.identity_confidence,
    model.model_name
  FROM order_touches AS ot
  CROSS JOIN UNNEST([
    STRUCT("first_touch" AS model_name),
    STRUCT("last_touch" AS model_name),
    STRUCT("last_non_direct" AS model_name),
    STRUCT("last_paid" AS model_name),
    STRUCT("first_paid" AS model_name),
    STRUCT("linear" AS model_name),
    STRUCT("position_based" AS model_name),
    STRUCT("time_decay" AS model_name)
  ]) AS model
  WHERE ot.touchpoint_id IS NOT NULL
  QUALIFY
    (model.model_name = "first_touch"
      AND ot.touchpoint_timestamp = MIN(ot.touchpoint_timestamp) OVER (PARTITION BY ot.transaction_id))
    OR (model.model_name = "last_touch"
      AND ot.touchpoint_timestamp = MAX(ot.touchpoint_timestamp) OVER (PARTITION BY ot.transaction_id))
    OR (model.model_name = "last_non_direct"
      AND ot.touchpoint_timestamp = IFNULL(
        MAX(IF(NOT ot.is_direct, ot.touchpoint_timestamp, NULL)) OVER (PARTITION BY ot.transaction_id),
        MAX(ot.touchpoint_timestamp) OVER (PARTITION BY ot.transaction_id)
      ))
    OR (model.model_name = "last_paid"
      AND ot.is_paid
      AND ot.touchpoint_timestamp = MAX(IF(ot.is_paid, ot.touchpoint_timestamp, NULL)) OVER (PARTITION BY ot.transaction_id))
    OR (model.model_name = "first_paid"
      AND ot.is_paid
      AND ot.touchpoint_timestamp = MIN(IF(ot.is_paid, ot.touchpoint_timestamp, NULL)) OVER (PARTITION BY ot.transaction_id))
    OR (model.model_name IN ("linear", "position_based", "time_decay")
      AND (
        COUNTIF(NOT ot.is_direct) OVER (PARTITION BY ot.transaction_id) = 0
        OR NOT ot.is_direct
      ))
),
credited AS (
  SELECT
    * EXCEPT (touchpoint_timestamp),
    CASE model_name
      WHEN "linear" THEN 1.0 / COUNT(*) OVER (PARTITION BY transaction_id, model_name)
      WHEN "position_based" THEN
        CASE
          WHEN COUNT(*) OVER (PARTITION BY transaction_id, model_name) = 1 THEN 1.0
          WHEN COUNT(*) OVER (PARTITION BY transaction_id, model_name) = 2 THEN 0.5
          WHEN hours_to_conversion = MAX(hours_to_conversion) OVER (PARTITION BY transaction_id, model_name)
            AND hours_to_conversion = MIN(hours_to_conversion) OVER (PARTITION BY transaction_id, model_name)
            THEN 1.0
          WHEN hours_to_conversion = MAX(hours_to_conversion) OVER (PARTITION BY transaction_id, model_name) THEN 0.4
          WHEN hours_to_conversion = MIN(hours_to_conversion) OVER (PARTITION BY transaction_id, model_name) THEN 0.4
          ELSE 0.2 / GREATEST(COUNT(*) OVER (PARTITION BY transaction_id, model_name) - 2, 1)
        END
      WHEN "time_decay" THEN
        POW(2, -IFNULL(hours_to_conversion, 0) / ${TIME_DECAY_HALF_LIFE_HOURS})
        / SUM(POW(2, -IFNULL(hours_to_conversion, 0) / ${TIME_DECAY_HALF_LIFE_HOURS})) OVER (PARTITION BY transaction_id, model_name)
      ELSE 1.0
    END AS credit
  FROM credited_raw
)
`;

export async function getWarehouseMetrics(options: {
  model?: WarehouseModel;
  lookbackDays?: number;
} = {}): Promise<WarehouseMetrics> {
  const period = await getAlignedPeriod();
  const model = options.model ?? DEFAULT_MODEL;
  const lookbackDays = options.lookbackDays ?? DEFAULT_LOOKBACK;
  const base = emptyMetrics(period.label, model, lookbackDays);

  try {
    if (!getBigQueryConfig()) {
      return base;
    }

    const { client, config } = getBigQueryClient();
    const rawTable = `\`${config.projectId}.stape_data.raw_events_full\``;
    const ctes = warehouseCtes(rawTable);
    const params = {
      startMs: period.startMs,
      endMs: period.endMs,
      lookbackDays,
    };
    const queryOptions = { location: config.location, params };

    const [shopify, platform] = await Promise.all([
      getShopifyOverviewMetrics(),
      getPlatformReported(period),
    ]);
    const aligned = shopifyMetricsSince(
      shopify.orderPoints,
      period.startMs,
      period.endMs,
    );
    const shopifyGnUidOrders = shopify.orderPoints.filter((order) => {
      const created = new Date(order.createdAt).getTime();
      return (
        created >= period.startMs &&
        created < period.endMs &&
        Boolean(order.firstTouch.uid)
      );
    }).length;

    const [orderRows] = await client.query({
      ...queryOptions,
      query: `
        ${ctes}
        SELECT
          COUNT(*) AS orders,
          IFNULL(SUM(net_revenue), 0) AS revenue,
          COUNTIF(person_id IS NOT NULL) AS with_person,
          COUNTIF(shopify_customer_id IS NOT NULL) AS with_customer,
          COUNTIF(hashed_email IS NOT NULL) AS with_email,
          COUNTIF(gn_uid IS NOT NULL) AS with_gn,
          COUNTIF(stape_user_id IS NOT NULL) AS with_stape,
          COUNTIF(transaction_id IS NOT NULL) AS with_txn
        FROM orders
        WHERE UNIX_MILLIS(order_timestamp) >= @startMs
          AND UNIX_MILLIS(order_timestamp) < @endMs
      `,
    });

    const [copyRows] = await client.query({
      ...queryOptions,
      query: `
        ${ctes}
        SELECT
          (SELECT COUNT(*) FROM enriched WHERE is_purchase
            AND UNIX_MILLIS(event_timestamp) >= @startMs
            AND UNIX_MILLIS(event_timestamp) < @endMs) AS purchase_event_copies,
          (SELECT COUNT(*) FROM colliding) AS identity_collisions,
          (SELECT COUNT(*) FROM enriched WHERE is_late_event
            AND UNIX_MILLIS(event_timestamp) >= @startMs
            AND UNIX_MILLIS(event_timestamp) < @endMs) AS late_events
      `,
    });

    const [sessionRows] = await client.query({
      ...queryOptions,
      query: `
        ${ctes}
        SELECT
          COUNTIF(is_paid) AS paid_sessions,
          COUNTIF(is_paid AND (gclid IS NOT NULL OR gbraid IS NOT NULL OR wbraid IS NOT NULL OR fbclid IS NOT NULL)) AS paid_with_click,
          COUNTIF(channel = "Facebook / Meta Ads") AS meta_sessions,
          COUNTIF(channel = "Facebook / Meta Ads" AND fbclid IS NOT NULL) AS meta_with_fbclid,
          COUNTIF(channel = "Google Ads") AS google_sessions,
          COUNTIF(channel = "Google Ads" AND (gclid IS NOT NULL OR gbraid IS NOT NULL OR wbraid IS NOT NULL)) AS google_with_click,
          (SELECT COUNT(*) FROM touchpoints t
            WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.person_id = t.person_id)
          ) AS orphan_touchpoints
        FROM sessions
        WHERE UNIX_MILLIS(session_start) >= @startMs
          AND UNIX_MILLIS(session_start) < @endMs
      `,
    });

    const [attrRows] = await client.query({
      ...queryOptions,
      query: `
        ${ctes},
        ${ATTRIBUTION_SQL}
        SELECT
          model_name,
          IFNULL(channel, "Unknown") AS channel,
          SUM(credit) AS orders,
          SUM(net_revenue * credit) AS revenue
        FROM credited
        WHERE UNIX_MILLIS(order_timestamp) >= @startMs
          AND UNIX_MILLIS(order_timestamp) < @endMs
        GROUP BY 1, 2
      `,
    });

    const [confRows] = await client.query({
      ...queryOptions,
      query: `
        ${ctes},
        ${ATTRIBUTION_SQL}
        SELECT
          COUNT(DISTINCT o.transaction_id) AS period_orders,
          COUNT(DISTINCT c.transaction_id) AS attributed_orders,
          COUNT(DISTINCT IF(c.click_id IS NOT NULL, c.transaction_id, NULL)) AS with_click,
          COUNT(DISTINCT IF(c.identity_confidence IN ("VERY HIGH", "HIGH"), c.transaction_id, NULL)) AS high_conf,
          COUNT(DISTINCT IF(c.identity_confidence = "MEDIUM", c.transaction_id, NULL)) AS med_conf,
          COUNT(DISTINCT IF(IFNULL(c.channel, "Unknown") = "Direct", c.transaction_id, NULL)) AS direct_orders,
          COUNT(DISTINCT IF(o.transaction_id NOT IN (
            SELECT transaction_id FROM credited WHERE model_name = @model
          ), o.transaction_id, NULL)) AS unknown_orders,
          AVG(c.days_to_conversion) AS avg_days,
          AVG(touch_n) AS avg_touches,
          SUM(c.net_revenue * c.credit) AS attributed_revenue,
          SUM(c.credit) AS attributed_order_credit
        FROM orders AS o
        LEFT JOIN credited AS c
          ON c.transaction_id = o.transaction_id
         AND c.model_name = @model
        LEFT JOIN (
          SELECT transaction_id, COUNT(DISTINCT touchpoint_id) AS touch_n
          FROM order_touches
          WHERE touchpoint_id IS NOT NULL
          GROUP BY 1
        ) AS tn
          ON tn.transaction_id = o.transaction_id
        WHERE UNIX_MILLIS(o.order_timestamp) >= @startMs
          AND UNIX_MILLIS(o.order_timestamp) < @endMs
      `,
      params: { ...params, model },
    });

    const [prepRows] = await client.query({
      ...queryOptions,
      query: `
        ${ctes}
        SELECT COUNT(DISTINCT o.transaction_id) AS with_session
        FROM orders AS o
        JOIN sessions AS s
          ON s.person_id = o.person_id
         AND s.session_start <= o.order_timestamp
         AND s.session_start >= TIMESTAMP_SUB(o.order_timestamp, INTERVAL @lookbackDays DAY)
        WHERE UNIX_MILLIS(o.order_timestamp) >= @startMs
          AND UNIX_MILLIS(o.order_timestamp) < @endMs
      `,
    });

    const [journeyRows] = await client.query({
      ...queryOptions,
      query: `
        ${ctes}
        SELECT
          IFNULL(NULLIF(path, ""), "Unknown") AS path,
          COUNT(*) AS orders,
          SUM(net_revenue) AS revenue
        FROM (
          SELECT
            o.transaction_id,
            ANY_VALUE(o.net_revenue) AS net_revenue,
            STRING_AGG(ot.channel, " → " ORDER BY ot.touchpoint_timestamp) AS path
          FROM orders AS o
          LEFT JOIN order_touches AS ot
            ON ot.transaction_id = o.transaction_id
           AND ot.touchpoint_id IS NOT NULL
           AND NOT IFNULL(ot.is_direct, FALSE)
          WHERE UNIX_MILLIS(o.order_timestamp) >= @startMs
            AND UNIX_MILLIS(o.order_timestamp) < @endMs
          GROUP BY o.transaction_id
        )
        GROUP BY 1
        ORDER BY orders DESC
        LIMIT 12
      `,
    });

    const [timingRows] = await client.query({
      ...queryOptions,
      query: `
        ${ctes}
        SELECT
          AVG(TIMESTAMP_DIFF(o.order_timestamp, first_touch, DAY)) AS avg_days,
          AVG(touch_n) AS avg_touches,
          AVG(session_n) AS avg_sessions
        FROM orders AS o
        LEFT JOIN (
          SELECT transaction_id, MIN(touchpoint_timestamp) AS first_touch, COUNT(DISTINCT touchpoint_id) AS touch_n
          FROM order_touches
          WHERE touchpoint_id IS NOT NULL
          GROUP BY 1
        ) t USING (transaction_id)
        LEFT JOIN (
          SELECT o2.transaction_id, COUNT(DISTINCT s.session_key) AS session_n
          FROM orders AS o2
          JOIN sessions AS s
            ON s.person_id = o2.person_id
           AND s.session_start <= o2.order_timestamp
           AND s.session_start >= TIMESTAMP_SUB(o2.order_timestamp, INTERVAL @lookbackDays DAY)
          GROUP BY 1
        ) s USING (transaction_id)
        WHERE UNIX_MILLIS(o.order_timestamp) >= @startMs
          AND UNIX_MILLIS(o.order_timestamp) < @endMs
      `,
    });

    const order = (orderRows[0] ?? {}) as Record<string, unknown>;
    const copies = (copyRows[0] ?? {}) as Record<string, unknown>;
    const sess = (sessionRows[0] ?? {}) as Record<string, unknown>;
    const conf = (confRows[0] ?? {}) as Record<string, unknown>;
    const prep = (prepRows[0] ?? {}) as Record<string, unknown>;
    const timing = (timingRows[0] ?? {}) as Record<string, unknown>;

    const orders = toNumber(order.orders);
    const revenue = toNumber(order.revenue);
    const attributedOrders = toNumber(conf.attributed_order_credit);
    const attributedRevenue = toNumber(conf.attributed_revenue);
    const unknownOrders = Math.max(orders - toNumber(conf.attributed_orders), 0);

    const attr = attrRows as {
      model_name: string;
      channel: string;
      orders: number;
      revenue: number;
    }[];

    const toRows = (modelName: string): WarehouseChannelRow[] =>
      attr
        .filter((row) => row.model_name === modelName)
        .map((row) => ({
          channel: row.channel,
          orders: toNumber(row.orders),
          revenue: toNumber(row.revenue),
        }))
        .sort((a, b) => b.revenue - a.revenue);

    const quality: WarehouseQuality = {
      totalOrders: orders,
      ordersWithTransactionId: toNumber(order.with_txn),
      ordersWithPersonId: toNumber(order.with_person),
      ordersWithHashedEmail: toNumber(order.with_email),
      ordersWithGnUid: toNumber(order.with_gn),
      ordersWithStapeUserId: toNumber(order.with_stape),
      ordersWithShopifyCustomerId: toNumber(order.with_customer),
      ordersWithClickId: toNumber(conf.with_click),
      ordersWithPrepurchasesSession: toNumber(prep.with_session),
      highConfidenceOrders: toNumber(conf.high_conf),
      mediumConfidenceOrders: toNumber(conf.med_conf),
      lowConfidenceOrders: Math.max(
        toNumber(conf.attributed_orders) - toNumber(conf.high_conf) - toNumber(conf.med_conf),
        0,
      ),
      directOrders: toNumber(conf.direct_orders),
      unknownOrders,
      attributedOrders: toNumber(conf.attributed_orders),
      paidSessions: toNumber(sess.paid_sessions),
      paidSessionsWithClickId: toNumber(sess.paid_with_click),
      metaSessions: toNumber(sess.meta_sessions),
      metaSessionsWithFbclid: toNumber(sess.meta_with_fbclid),
      googleSessions: toNumber(sess.google_sessions),
      googleSessionsWithGoogleClickId: toNumber(sess.google_with_click),
      purchaseEventCopies: toNumber(copies.purchase_event_copies),
      canonicalOrders: orders,
      identityCollisions: toNumber(copies.identity_collisions),
      lateEvents: toNumber(copies.late_events),
      orphanTouchpoints: toNumber(sess.orphan_touchpoints),
      shopifyGnUidOrders,
    };

    const gaps: string[] = [
      "Warehouse models are observed click/session paths in BigQuery. They are not Shopify gn_* first-touch and not Ads Manager view-through.",
      "gn_uid and stape_user_id now come from raw_events_full (Data Client). GA4 collect hits may still lack gn_uid until that tag also sends it.",
      "hashed_email and shopify_customer_id usually fill on purchase, not page_view.",
      "gclid/gbraid/wbraid columns are often empty; Meta is mostly URL UTMs plus fbclid when present.",
      "raw_events_full partitions expire after 60 days, so 90-day lookbacks will under-count until retention is extended.",
    ];
    if (platform.facebook.spend === null && platform.google.spend === null) {
      gaps.push(
        "Platform Meta/Google spend is — for this header range. Overview blended cards stay — until warehouse or paste fills.",
      );
    } else {
      gaps.push(blendedAdSpendSource(platform, period.label));
    }
    if (platform.facebook.claimKind === "warehouse" && platform.facebook.spend === 0) {
      gaps.push(
        "Meta warehouse spend is $0 for this day (Flyweel often lags Today). Click Yesterday or 7d. This is not gn_* True Performance.",
      );
    }

    return {
      status: { state: "connected", projectId: config.projectId },
      periodLabel: period.label,
      model,
      lookbackDays,
      logicVersion: LOGIC_VERSION,
      orders,
      revenue,
      aov: orders > 0 ? revenue / orders : 0,
      newCustomerOrders:
        shopify.status.state === "connected" ? aligned.newCustomerOrders : null,
      returningCustomerOrders:
        shopify.status.state === "connected" ? aligned.returningCustomerOrders : null,
      attributedOrders,
      attributedRevenue,
      coverageRate: orders > 0 ? quality.attributedOrders / orders : null,
      highConfidenceRate: orders > 0 ? quality.highConfidenceOrders / orders : null,
      directRate: orders > 0 ? quality.directOrders / orders : null,
      unknownRate: orders > 0 ? unknownOrders / orders : null,
      byChannel: toRows(model),
      acquiring: toRows("first_touch"),
      closing: toRows("last_non_direct"),
      assisting: toRows("linear"),
      journeys: (journeyRows as WarehouseJourneyRow[]).map((row) => ({
        path: String(row.path),
        orders: toNumber(row.orders),
        revenue: toNumber(row.revenue),
      })),
      avgDaysToPurchase: timing.avg_days == null ? null : toNumber(timing.avg_days),
      avgTouchesToPurchase: timing.avg_touches == null ? null : toNumber(timing.avg_touches),
      avgSessionsToPurchase: timing.avg_sessions == null ? null : toNumber(timing.avg_sessions),
      quality,
      gaps,
      metaSpend: platform.facebook.spend,
      googleSpend: platform.google.spend,
      totalSpend: platform.totalSpend,
      spendSource: blendedAdSpendSource(platform, period.label),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load warehouse attribution.";
    return { ...base, status: { state: "error", message } };
  }
}
