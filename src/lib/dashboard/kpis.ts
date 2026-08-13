import type { FirstTouchRollup } from "@/lib/shopify/first-touch";

export function ratio(numerator: number, spend: number | null) {
  if (spend === null || spend <= 0) {
    return null;
  }

  return numerator / spend;
}

/** MER = blended ad spend ÷ total revenue. Inverse of blended ROAS. */
export function merRatio(spend: number | null, orderRevenue: number) {
  if (spend === null || spend <= 0 || orderRevenue <= 0) {
    return null;
  }

  return spend / orderRevenue;
}

/** Ad spend ÷ Shopify orders with total > $0. */
export function blendedCpa(spend: number | null, paidOrders: number) {
  if (spend === null || paidOrders <= 0) {
    return null;
  }

  return spend / paidOrders;
}

export function netAfterFees(
  totalRevenue: number,
  processingFees: number | null,
  refundFees: number | null,
) {
  return totalRevenue - (processingFees ?? 0) - (refundFees ?? 0);
}

export function netProfit(
  totalRevenue: number,
  processingFees: number | null,
  refundFees: number | null,
  adSpend: number | null,
) {
  if (adSpend === null) {
    return null;
  }

  return netAfterFees(totalRevenue, processingFees, refundFees) - adSpend;
}

export function percentChange(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) {
    return null;
  }

  return (current - previous) / previous;
}

export function unknownFirstTouch(orders: {
  firstTouchChannel: string;
  amount: number;
}[]) {
  const unknown = orders.filter(
    (order) => order.firstTouchChannel === "Unknown",
  );
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, order) => sum + order.amount, 0);

  return {
    orders: unknown.length,
    revenue: unknown.reduce((sum, order) => sum + order.amount, 0),
    orderShare: totalOrders > 0 ? unknown.length / totalOrders : null,
    revenueShare: totalRevenue > 0 ? unknown.reduce((sum, order) => sum + order.amount, 0) / totalRevenue : null,
  };
}

export type ShopifyStapeMismatch = {
  shopifyOrders: number;
  stapePurchases: number;
  shopifyRevenue: number;
  stapeRevenue: number;
};

export function shopifyStapeMismatch(input: {
  shopifyConnected: boolean;
  stapeConnected: boolean;
  shopifyOrders: number;
  shopifyRevenue: number;
  stapePurchases: number;
  stapeRevenue: number;
}): ShopifyStapeMismatch | null {
  if (!input.shopifyConnected || !input.stapeConnected) {
    return null;
  }

  const ordersDiffer = input.shopifyOrders !== input.stapePurchases;
  const revenueDiffer =
    Math.abs(input.shopifyRevenue - input.stapeRevenue) > 0.5;

  if (!ordersDiffer && !revenueDiffer) {
    return null;
  }

  return {
    shopifyOrders: input.shopifyOrders,
    stapePurchases: input.stapePurchases,
    shopifyRevenue: input.shopifyRevenue,
    stapeRevenue: input.stapeRevenue,
  };
}

export function findRollupShare(
  rows: FirstTouchRollup[],
  label: string,
): FirstTouchRollup | null {
  return rows.find((row) => row.label === label) ?? null;
}
