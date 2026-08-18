import { coverageRatio } from "../metrics/formulas.ts";

export type CoverageSnapshot = {
  shopifyOrders: number;
  trackedPurchases: number;
  identityMatched: number;
  journeyMatched: number;
  attributedOrders: number;
  unattributedOrders: number;
  trackingCoverage: number | null;
  identityMatchRate: number | null;
  journeyMatchRate: number | null;
  attributionCoverage: number | null;
};

export function attributionCoverage(input: {
  shopifyOrders: number;
  trackedPurchases: number;
  identityMatched: number;
  journeyMatched: number;
  attributedOrders: number;
}): CoverageSnapshot {
  const unattributed = Math.max(input.shopifyOrders - input.attributedOrders, 0);
  return {
    shopifyOrders: input.shopifyOrders,
    trackedPurchases: input.trackedPurchases,
    identityMatched: input.identityMatched,
    journeyMatched: input.journeyMatched,
    attributedOrders: input.attributedOrders,
    unattributedOrders: unattributed,
    trackingCoverage: coverageRatio(input.trackedPurchases, input.shopifyOrders),
    identityMatchRate: coverageRatio(input.identityMatched, input.trackedPurchases),
    journeyMatchRate: coverageRatio(input.journeyMatched, input.trackedPurchases),
    attributionCoverage: coverageRatio(input.attributedOrders, input.shopifyOrders),
  };
}
