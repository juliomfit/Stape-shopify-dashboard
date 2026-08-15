import type { OrderPoint } from "@/lib/shopify/types";
import {
  coarseFromGnChannel,
  coarseFromShopifyLabel,
  gnHasClickId,
  type CompareCoarseKey,
  type JourneyMismatch,
} from "@/lib/shopify/journey";

export type AttributionCompareRow = {
  channel: CompareCoarseKey;
  shopifyOrders: number;
  shopifyRevenue: number;
  gnOrders: number;
  gnRevenue: number;
  orderGap: number;
  revenueGap: number;
};

export type AttributionCompareTotals = {
  orders: number;
  revenue: number;
  rows: AttributionCompareRow[];
  readyOrders: number;
  mismatchOrders: number;
  shopifyDirectWithGnClickId: number;
};

const KEY_ORDER: CompareCoarseKey[] = [
  "Meta paid",
  "Meta unknown",
  "Google paid",
  "Google organic",
  "Direct",
  "Email",
  "Unknown",
  "Not ready",
  "Other",
];

function emptyRow(channel: CompareCoarseKey): AttributionCompareRow {
  return {
    channel,
    shopifyOrders: 0,
    shopifyRevenue: 0,
    gnOrders: 0,
    gnRevenue: 0,
    orderGap: 0,
    revenueGap: 0,
  };
}

export function buildAttributionCompare(
  orders: OrderPoint[],
): AttributionCompareTotals {
  const byKey = new Map<CompareCoarseKey, AttributionCompareRow>();
  for (const key of KEY_ORDER) {
    byKey.set(key, emptyRow(key));
  }

  let readyOrders = 0;
  let mismatchOrders = 0;
  let shopifyDirectWithGnClickId = 0;
  let ordersCount = 0;
  let revenue = 0;

  for (const order of orders) {
    ordersCount += 1;
    revenue += order.amount;

    const gnKey = coarseFromGnChannel(order.firstTouchChannel);
    const gnRow = byKey.get(gnKey) ?? emptyRow(gnKey);
    gnRow.gnOrders += 1;
    gnRow.gnRevenue += order.amount;
    byKey.set(gnKey, gnRow);

    const journey = order.journey;
    const shopifyKey = !journey
      ? "Other"
      : !journey.ready
        ? "Not ready"
        : coarseFromShopifyLabel(journey.firstClick);
    const shopifyRow = byKey.get(shopifyKey) ?? emptyRow(shopifyKey);
    shopifyRow.shopifyOrders += 1;
    shopifyRow.shopifyRevenue += order.amount;
    byKey.set(shopifyKey, shopifyRow);

    if (journey?.ready) {
      readyOrders += 1;
    }
    if (order.journeyMismatch) {
      mismatchOrders += 1;
    }
    if (
      journey?.ready &&
      journey.firstClick.type.toLowerCase() === "direct" &&
      gnHasClickId(order.firstTouch)
    ) {
      shopifyDirectWithGnClickId += 1;
    }
  }

  const rows = KEY_ORDER.map((key) => {
    const row = byKey.get(key) ?? emptyRow(key);
    return {
      ...row,
      orderGap: row.shopifyOrders - row.gnOrders,
      revenueGap: row.shopifyRevenue - row.gnRevenue,
    };
  }).filter(
    (row) =>
      row.shopifyOrders > 0 ||
      row.gnOrders > 0 ||
      row.channel === "Meta paid" ||
      row.channel === "Direct" ||
      row.channel === "Unknown",
  );

  return {
    orders: ordersCount,
    revenue,
    rows,
    readyOrders,
    mismatchOrders,
    shopifyDirectWithGnClickId,
  };
}

export function journeyQuality(orders: OrderPoint[]) {
  const total = orders.length;
  const ready = orders.filter((order) => order.journey?.ready).length;
  const mismatch = orders.filter((order) => order.journeyMismatch).length;
  const directClick = orders.filter(
    (order) =>
      order.journey?.ready &&
      order.journey.firstClick.type.toLowerCase() === "direct" &&
      gnHasClickId(order.firstTouch),
  ).length;

  return {
    total,
    ready,
    readyRate: total === 0 ? null : ready / total,
    mismatch,
    mismatchRate: total === 0 ? null : mismatch / total,
    shopifyDirectWithGnClickId: directClick,
    shopifyDirectWithGnClickIdRate: total === 0 ? null : directClick / total,
  };
}

export function matchesJourneyFilter(
  mismatch: JourneyMismatch,
  filter: string,
) {
  if (!filter) {
    return true;
  }
  return mismatch === filter;
}
