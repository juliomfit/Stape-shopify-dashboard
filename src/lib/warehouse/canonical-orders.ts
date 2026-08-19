import { cache } from "react";
import { getAlignedPeriod } from "@/lib/dashboard/aligned-period";
import {
  ATTRIBUTION_MODELS,
  attribute,
  assistCredits,
  firstNonDirectTouch,
  lastNonDirectTouch,
  type AttributionModel,
  type OrderInput,
  type Touchpoint,
} from "@/lib/attribution/engine";
import { paidRoasCovered } from "@/lib/metrics/formulas";
import { isDirectChannel, isPaidChannel } from "@/lib/attribution/channel";
import {
  indexShopifyOrders,
  matchShopifyOrder,
  shopifyMoneyForOrder,
} from "@/lib/attribution/shopify-money";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";
import { getBigQueryClient } from "@/lib/stape/client";
import { getBigQueryConfig } from "@/lib/stape/config";
import type { AttributedOrder, JourneyTouch } from "@/lib/stape/attribution-types";
import { warehouseCtes } from "@/lib/warehouse/sql";
import type { WarehouseChannelRow, WarehouseCampaignRow, WarehouseJourneyRow } from "@/lib/warehouse/types";
import { DEFAULT_LOOKBACK } from "@/lib/warehouse/constants";

export type CanonicalTouchpoint = JourneyTouch & {
  touchpointId: string;
  isPaid: boolean;
  isDirect: boolean;
};

export type CanonicalAttributedOrder = Omit<AttributedOrder, "touches"> & {
  touches: CanonicalTouchpoint[];
  eventPurchaseValue: number | null;
  shopifyNetRevenue: number | null;
  moneySource: "shopify" | "unmatched";
  isNewCustomer: boolean | null;
  refunded: number | null;
};

function toNumber(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function toEngineTouch(touch: CanonicalTouchpoint): Touchpoint {
  return {
    id: touch.touchpointId,
    timestamp: touch.ts,
    channel: touch.channel,
    source: touch.source ?? undefined,
    medium: touch.medium ?? undefined,
    campaign: touch.campaign ?? undefined,
    clickId: touch.fbclid ? "fbclid" : touch.gclid ? "gclid" : null,
    isPaid: touch.isPaid,
    isDirect: touch.isDirect,
  };
}

export function canonicalToEngineOrders(
  orders: CanonicalAttributedOrder[],
): OrderInput[] {
  return orders
    .filter((order) => order.moneySource === "shopify" && order.shopifyNetRevenue != null)
    .map((order) => ({
      id: order.transactionId,
      revenue: order.shopifyNetRevenue ?? 0,
      purchaseTs: order.purchaseTs,
      touchpoints: (order.touches as CanonicalTouchpoint[]).map(toEngineTouch),
    }));
}

export function engineOrdersIncludingUnmatched(
  orders: CanonicalAttributedOrder[],
): OrderInput[] {
  return orders.map((order) => ({
    id: order.transactionId,
    revenue: order.shopifyNetRevenue ?? 0,
    purchaseTs: order.purchaseTs,
    touchpoints: (order.touches as CanonicalTouchpoint[]).map(toEngineTouch),
  }));
}

function firstNonDirectChannel(touches: CanonicalTouchpoint[]) {
  return firstNonDirectTouch(touches.map(toEngineTouch))?.channel ?? "Unknown";
}

function lastNonDirectChannel(touches: CanonicalTouchpoint[]) {
  return lastNonDirectTouch(touches.map(toEngineTouch))?.channel ?? "Unknown";
}

function lastClick(touches: CanonicalTouchpoint[]) {
  const found = [...touches].reverse().find((touch) => touch.fbclid || touch.gclid);
  return found?.channel ?? "Unknown";
}

async function loadCanonicalAttributedOrdersUnguarded(options?: {
  lookbackDays?: number;
}): Promise<CanonicalAttributedOrder[]> {
  const period = await getAlignedPeriod();
  const lookbackDays =
    options?.lookbackDays && options.lookbackDays > 0
      ? options.lookbackDays
      : DEFAULT_LOOKBACK;

  if (!getBigQueryConfig()) {
    return [];
  }

  const { client, config } = getBigQueryClient();
  const rawTable = `\`${config.projectId}.stape_data.raw_events_full\``;
  const ctes = warehouseCtes(rawTable);
  const shopify = await getShopifyOverviewMetrics();
  if (shopify.status.state === "error") {
    throw new Error(`Shopify orders unavailable: ${shopify.status.message}`);
  }
  const shopifyById = indexShopifyOrders(shopify.orderPoints);

  const [rows] = await client.query({
    location: config.location,
    params: {
      startMs: period.startMs,
      endMs: period.endMs,
      lookbackDays,
    },
    query: `
      ${ctes}
      SELECT
        o.transaction_id AS transactionId,
        UNIX_MILLIS(o.order_timestamp) AS purchaseTs,
        o.person_id AS personKey,
        o.event_purchase_value AS eventPurchaseValue,
        o.shopify_customer_id AS shopifyCustomerId,
        o.gn_uid AS gnUid,
        o.stape_user_id AS stapeUserId,
        o.hashed_email IS NOT NULL AS hashedEmailPresent,
        o.client_id AS clientId,
        ARRAY_AGG(
          IF(ot.touchpoint_id IS NULL, NULL, STRUCT(
            ot.touchpoint_id AS touchpointId,
            UNIX_MILLIS(ot.touchpoint_timestamp) AS ts,
            ot.channel AS channel,
            ot.source AS source,
            ot.medium AS medium,
            ot.campaign AS campaign,
            ot.landing_page AS landingPage,
            ot.session_key AS sessionKey,
            ot.click_id_type = "fbclid" AS fbclid,
            ot.click_id_type IN ("gclid", "gbraid", "wbraid") AS gclid,
            ot.is_paid AS isPaid,
            ot.is_direct AS isDirect
          ))
          IGNORE NULLS
          ORDER BY ot.touchpoint_timestamp, ot.touchpoint_id
        ) AS touches
      FROM orders AS o
      LEFT JOIN order_touches AS ot
        ON ot.transaction_id = o.transaction_id
       AND ot.touchpoint_id IS NOT NULL
      WHERE UNIX_MILLIS(o.order_timestamp) >= @startMs
        AND UNIX_MILLIS(o.order_timestamp) < @endMs
      GROUP BY
        o.transaction_id,
        o.order_timestamp,
        o.person_id,
        o.event_purchase_value,
        o.shopify_customer_id,
        o.gn_uid,
        o.stape_user_id,
        o.hashed_email,
        o.client_id
      ORDER BY o.order_timestamp DESC
      LIMIT 5000
    `,
  });

  return (rows as Record<string, unknown>[]).map((row) => {
    const transactionId = String(row.transactionId ?? "");
    const rawTouches = Array.isArray(row.touches) ? row.touches : [];
    const touches: CanonicalTouchpoint[] = rawTouches.map((touch: Record<string, unknown>) => {
      const channel = String(touch.channel ?? "Unknown");
      return {
        touchpointId: String(touch.touchpointId ?? touch.sessionKey ?? ""),
        ts: toNumber(touch.ts),
        channel,
        source: (touch.source as string | null) ?? null,
        medium: (touch.medium as string | null) ?? null,
        campaign: (touch.campaign as string | null) ?? null,
        landingPage: (touch.landingPage as string | null) ?? null,
        sessionKey: (touch.sessionKey as string | null) ?? null,
        fbclid: Boolean(touch.fbclid),
        gclid: Boolean(touch.gclid),
        isPaid: Boolean(touch.isPaid) || isPaidChannel(channel),
        isDirect: Boolean(touch.isDirect) || isDirectChannel(channel),
      };
    });
    touches.sort(
      (a, b) => a.ts - b.ts || a.touchpointId.localeCompare(b.touchpointId),
    );
    const money = shopifyMoneyForOrder({
      transactionId,
      eventPurchaseValue: row.eventPurchaseValue == null ? null : toNumber(row.eventPurchaseValue),
      shopifyOrder: matchShopifyOrder(transactionId, shopifyById),
    });
    const first = touches[0];
    const last = touches[touches.length - 1];
    return {
      transactionId,
      revenue: money.shopifyNetRevenue ?? 0,
      firstNonDirect: first ? firstNonDirectChannel(touches) : "Unknown",
      lastNonDirect: last ? lastNonDirectChannel(touches) : "Unknown",
      lastClick: lastClick(touches),
      personKey: String(row.personKey ?? ""),
      purchaseTs: toNumber(row.purchaseTs),
      touches,
      gnUid: (row.gnUid as string | null) ?? null,
      stapeUserId: (row.stapeUserId as string | null) ?? null,
      shopifyCustomerId: (row.shopifyCustomerId as string | null) ?? null,
      hashedEmailPresent: row.hashedEmailPresent === true,
      clientId: (row.clientId as string | null) ?? null,
      eventPurchaseValue: money.eventPurchaseValue,
      shopifyNetRevenue: money.shopifyNetRevenue,
      moneySource: money.moneySource,
      isNewCustomer: money.isNewCustomer,
      refunded: money.refunded,
    };
  });
}

/**
 * Canonical order/journey service. Touchpoints are the same identity → session
 * → eligible acquisition grain as the warehouse engine. Shopify is money truth.
 */
export const getCanonicalAttributedOrders = cache(loadCanonicalAttributedOrdersUnguarded);

export function aggregateChannelsFromCanonical(
  orders: CanonicalAttributedOrder[],
  model: AttributionModel,
  lookbackDays: number,
): WarehouseChannelRow[] {
  const cells = new Map<string, WarehouseChannelRow>();
  for (const order of orders) {
    if (order.moneySource !== "shopify" || order.shopifyNetRevenue == null) {
      continue;
    }
    const credits = attribute(
      (order.touches as CanonicalTouchpoint[]).map(toEngineTouch),
      { model, purchaseTs: order.purchaseTs, windowDays: lookbackDays },
    );
    for (const credit of credits) {
      const cell = cells.get(credit.channel) ?? {
        channel: credit.channel,
        orders: 0,
        revenue: 0,
      };
      cell.orders += credit.weight;
      cell.revenue += credit.weight * order.shopifyNetRevenue;
      cells.set(credit.channel, cell);
    }
  }
  return [...cells.values()].sort((a, b) => b.revenue - a.revenue);
}

export function aggregateCampaignsFromCanonical(
  orders: CanonicalAttributedOrder[],
  model: AttributionModel,
  lookbackDays: number,
): WarehouseCampaignRow[] {
  const cells = new Map<string, WarehouseCampaignRow>();
  for (const order of orders) {
    if (order.moneySource !== "shopify" || order.shopifyNetRevenue == null) {
      continue;
    }
    const credits = attribute(
      (order.touches as CanonicalTouchpoint[]).map(toEngineTouch),
      { model, purchaseTs: order.purchaseTs, windowDays: lookbackDays },
    );
    const touches = order.touches as CanonicalTouchpoint[];
    for (const credit of credits) {
      const touch = touches.find((item) => item.touchpointId === credit.touchpointId);
      const campaign = touch?.campaign?.trim() ? touch.campaign : "(unmapped)";
      const key = `${campaign}||${credit.channel}`;
      const cell = cells.get(key) ?? {
        campaign,
        channel: credit.channel,
        orders: 0,
        revenue: 0,
      };
      cell.orders += credit.weight;
      cell.revenue += credit.weight * order.shopifyNetRevenue;
      cells.set(key, cell);
    }
  }
  return [...cells.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 200);
}

export function aggregateJourneyPaths(
  orders: CanonicalAttributedOrder[],
): WarehouseJourneyRow[] {
  const cells = new Map<string, WarehouseJourneyRow>();
  for (const order of orders) {
    const path =
      order.touches.length === 0
        ? "Unknown"
        : (order.touches as CanonicalTouchpoint[])
            .map((touch) => touch.channel)
            .join(" → ");
    const cell = cells.get(path) ?? { path, orders: 0, revenue: 0 };
    cell.orders += 1;
    cell.revenue += order.shopifyNetRevenue ?? 0;
    cells.set(path, cell);
  }
  return [...cells.values()].sort((a, b) => b.orders - a.orders).slice(0, 12);
}

export function paidAttributedRevenue(
  orders: CanonicalAttributedOrder[],
  model: AttributionModel,
  lookbackDays: number,
  spendByChannel: Record<string, number | null | undefined>,
) {
  return paidRoasCovered({
    attributedByChannel: aggregateChannelsFromCanonical(orders, model, lookbackDays),
    spendByChannel,
  }).revenue;
}

export function paidRoasSpendByChannel(input: {
  metaSpend: number | null;
  googleSpend: number | null;
}): Record<string, number | null> {
  return {
    "Facebook / Meta Ads": input.metaSpend,
    "Google Ads": input.googleSpend,
    TikTok: null,
    "Microsoft Ads": null,
  };
}

export function metaAttributedRevenue(
  orders: CanonicalAttributedOrder[],
  model: AttributionModel,
  lookbackDays: number,
) {
  return (
    aggregateChannelsFromCanonical(orders, model, lookbackDays).find(
      (row) => row.channel === "Facebook / Meta Ads",
    )?.revenue ?? 0
  );
}

export function newCustomerCreditByCampaign(
  orders: CanonicalAttributedOrder[],
  model: AttributionModel,
  lookbackDays: number,
) {
  const byCampaign: Record<string, number> = {};
  for (const order of orders) {
    if (order.isNewCustomer !== true) {
      continue;
    }
    const credits = attribute(
      (order.touches as CanonicalTouchpoint[]).map(toEngineTouch),
      { model, purchaseTs: order.purchaseTs, windowDays: lookbackDays },
    );
    const touches = order.touches as CanonicalTouchpoint[];
    for (const credit of credits) {
      const touch = touches.find((item) => item.touchpointId === credit.touchpointId);
      const campaign = touch?.campaign?.trim() ? touch.campaign : "(unmapped)";
      byCampaign[campaign] = (byCampaign[campaign] ?? 0) + credit.weight;
    }
  }
  return byCampaign;
}

export function newCustomerCreditByChannel(
  orders: CanonicalAttributedOrder[],
  model: AttributionModel,
  lookbackDays: number,
) {
  const byChannel: Record<string, number> = {};
  for (const order of orders) {
    if (order.isNewCustomer !== true) {
      continue;
    }
    const credits = attribute(
      (order.touches as CanonicalTouchpoint[]).map(toEngineTouch),
      { model, purchaseTs: order.purchaseTs, windowDays: lookbackDays },
    );
    for (const credit of credits) {
      byChannel[credit.channel] = (byChannel[credit.channel] ?? 0) + credit.weight;
    }
  }
  return byChannel;
}

export function aggregateAssistsFromCanonical(
  orders: CanonicalAttributedOrder[],
  lookbackDays: number,
): WarehouseChannelRow[] {
  const cells = new Map<string, WarehouseChannelRow>();
  for (const order of orders) {
    if (order.moneySource !== "shopify" || order.shopifyNetRevenue == null) {
      continue;
    }
    const credits = assistCredits(
      order.touches.map(toEngineTouch),
      order.purchaseTs,
      lookbackDays,
    );
    for (const credit of credits) {
      const cell = cells.get(credit.channel) ?? {
        channel: credit.channel,
        orders: 0,
        revenue: 0,
      };
      cell.orders += credit.weight;
      cell.revenue += credit.weight * order.shopifyNetRevenue;
      cells.set(credit.channel, cell);
    }
  }
  return [...cells.values()].sort((a, b) => b.revenue - a.revenue);
}

export { ATTRIBUTION_MODELS };

export function attributionResultsAvailable(input: {
  warehouseState: string;
  shopifyState: string;
}): boolean {
  return input.warehouseState === "connected" && input.shopifyState === "connected";
}
