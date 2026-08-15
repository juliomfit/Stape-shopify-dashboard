import type { FirstTouchRollup } from "@/lib/shopify/first-touch";
import { contributionProfit } from "@/lib/metrics/formulas";

export {
  aov,
  blendedCpa,
  contributionMargin,
  coverageRatio,
  cpc,
  cpm,
  ctr,
  merRatio,
  netAfterFees,
  newCustomerCpa,
  percentChange,
  platformCpa,
  platformRoas,
  ratio,
} from "@/lib/metrics/formulas";

export { contributionProfit };

/** @deprecated Use contributionProfit. Same formula without COGS. */
export function netProfit(
  totalRevenue: number,
  processingFees: number | null,
  refundFees: number | null,
  adSpend: number | null,
) {
  return contributionProfit({
    totalRevenue,
    processingFees,
    refundFees,
    adSpend,
  });
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
