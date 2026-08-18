/**
 * attribution_policy_v1 — single canonical attribution contract.
 *
 * TypeScript (`engine.ts`) is the reference implementation used by the order
 * debugger, fixtures, and unit tests. BigQuery warehouse SQL in
 * `src/lib/warehouse/get-warehouse-metrics.ts` and
 * `bigquery/migrations/2026_08_18_002_attribution_credit.sql` must implement
 * the same rules. If they disagree, the test suite fails.
 *
 * This file is documentation-as-code. Do not re-state these rules in React
 * pages. Import constants from here or from `engine.ts` / `windows.ts`.
 */

export const ATTRIBUTION_POLICY_ID = "attribution_policy_v1";
export const ATTRIBUTION_POLICY_VERSION = 1;

/** Shopify `currentTotalPriceSet` is money truth (net after refunds/discounts). */
export const REVENUE_DEFINITION = "net_after_refund" as const;

export const POSITION_WEIGHTS = {
  first: 0.4,
  last: 0.4,
  middle: 0.2,
} as const;

/** Time-decay: weight = 2^(-hours_to_purchase / half_life_hours). */
export const TIME_DECAY_HALF_LIFE_HOURS = 168;

/**
 * Channel names that actually exist in this product. Do not rename them to
 * Triple Whale-style labels (e.g. "Meta Paid") — that would split historical
 * reporting. Mapping for humans:
 *
 *   Facebook / Meta Ads  → Meta Paid
 *   Google Ads           → Google Paid Search / Shopping / PMax (undifferentiated)
 *   TikTok               → TikTok Paid
 *   Microsoft Ads        → Other Paid
 *   Google Organic       → Organic Search
 *   Meta Organic         → Organic Social
 *   Email                → Email (SMS mediums currently classify here)
 *   Direct               → Direct
 *   Other                → leftover classified traffic (has a source, not Unknown)
 *   Unknown              → no eligible touch / missing identity — NEVER coerced to Direct
 */
export const POLICY_CHANNELS = [
  "Google Ads",
  "Facebook / Meta Ads",
  "TikTok",
  "Microsoft Ads",
  "Google Organic",
  "Meta Organic",
  "Email",
  "Direct",
  "Other",
  "Unknown",
] as const;

export const PAID_POLICY_CHANNELS = [
  "Google Ads",
  "Facebook / Meta Ads",
  "TikTok",
  "Microsoft Ads",
] as const;

export const DIRECT_CHANNEL = "Direct";
export const UNKNOWN_CHANNEL = "Unknown";

export const POLICY_RULES = {
  unknownIsNotDirect:
    "Missing attribution information stays Unknown or Unattributed. Never convert missing tracking into Direct.",
  lastNonDirect:
    "Skip actual Direct when a prior eligible non-direct touch exists. If every eligible touch is Direct, the last Direct wins.",
  lastTouch: "Actual Direct may receive 100% credit.",
  firstTouch: "Earliest eligible touch in the window, including Direct.",
  linearIncludesDirect:
    "Linear / position / time-decay credit every eligible windowed touch, including Direct. Direct is a real touch, not noise.",
  paidOnly:
    "Split only among paid eligible touches. If none exist, the order is unattributed under this model (empty credit, not Direct).",
  selfReferral:
    "Referrer host matching the landing host is Direct, not Referral.",
  checkoutExclusion:
    "Shopify checkout / web-pixels@ paths classify as Direct (payment-domain noise), not a marketing touch.",
  duplicateTouches:
    "De-duplicate by touchpoint id (earliest timestamp wins). Dual GA4 + Data Client purchase copies are collapsed to one canonical order, not two conversions.",
  sessionTouches:
    "Warehouse sessions are GA4-client only (avoids duplicate sessions from Data Client copies). One touchpoint per session (landing channel).",
  refunds:
    "Financial credit uses Shopify net-after-refund (currentTotalPriceSet). Journeys are preserved; revenue on the order is what gets allocated.",
  newCustomers:
    "Shopify customer.numberOfOrders <= 1 on the order. Fractional new-customer credit is valid under MTA (weight * 1).",
  rounding:
    "Weights are IEEE floats. Invariant: |sum(credit) - 1| < 1e-9 when any eligible touch exists. Display may round to 2 decimals; stored credit is unrounded.",
  noViewThrough:
    "No view-through. Impressions are not person-level touches.",
  noProbabilisticIdentity:
    "Identity is deterministic only: shopify customer id, hashed email, gn_uid, stape_user_id, client_id, transaction_id.",
} as const;

export const CREDIT_TOLERANCE = 1e-9;

export function weightsSumToOne(weights: number[], tolerance = CREDIT_TOLERANCE) {
  if (weights.length === 0) {
    return true;
  }
  const total = weights.reduce((sum, value) => sum + value, 0);
  return Math.abs(total - 1) < tolerance;
}

export function attributedRevenueReconciles(
  credits: { weight: number }[],
  eligibleRevenue: number,
  tolerance = CREDIT_TOLERANCE,
) {
  if (credits.length === 0) {
    return eligibleRevenue === 0 || Math.abs(eligibleRevenue) < tolerance;
  }
  const attributed = credits.reduce(
    (sum, item) => sum + item.weight * eligibleRevenue,
    0,
  );
  return Math.abs(attributed - eligibleRevenue) < Math.max(tolerance, Math.abs(eligibleRevenue) * 1e-9);
}
