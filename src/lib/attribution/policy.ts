/**
 * attribution_policy_v1 — single canonical attribution contract.
 *
 * TypeScript (`engine.ts` + `eligibility.ts`) is the reference implementation
 * used by the order debugger, fixtures, and unit tests. Warehouse SQL in
 * `src/lib/warehouse/sql.ts` and
 * `bigquery/migrations/2026_08_18_005_canonical_attribution_credit_fix.sql`
 * must implement the same rules. Migration 002 may already be live; 005 is the
 * forward CREATE OR REPLACE VIEW. If they disagree, the test suite fails.
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
 *   Direct               → Real Direct (eligible marketing touch)
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
  realDirect:
    "Real Direct is a genuine storefront session with no external referrer, no paid click id, and no attributable source. It is eligible for First Touch, Last Touch, Linear, Position Based, and Time Decay. Last Non-Direct skips Direct when a prior non-direct touch exists.",
  internalNoise:
    "Internal / checkout noise (Shopify checkout URLs, /checkout, /checkouts/, web-pixels@, payment-processor referrers, own-domain navigation that is not a new acquisition) is NOT Direct and is excluded from attribution touchpoints. Checkout must not overwrite a Meta/organic/direct acquisition session.",
  unknownIsNotDirect:
    "Missing attribution information stays Unknown or Unattributed. Never convert missing tracking into Direct. UNKNOWN MUST NEVER BECOME DIRECT.",
  lastNonDirect:
    "Skip actual Direct when a prior eligible non-direct touch exists. If every eligible touch is Direct, the last Direct wins.",
  lastTouch: "Actual Direct may receive 100% credit.",
  firstTouch: "Earliest eligible touch in the window, including Direct.",
  linearIncludesDirect:
    "Linear / position / time-decay credit every eligible windowed touch, including Direct. Direct is a real marketing touch, not checkout noise.",
  paidOnly:
    "Split only among paid eligible touches. If none exist, the order is unattributed under this model (empty credit, not Direct).",
  selfReferral:
    "Own-domain referrer without a new paid click id or UTM is internal noise, not Direct and not Referral.",
  checkoutExclusion:
    "Shopify checkout / web-pixels@ / payment-processor transitions are internal noise. They are not Direct and not marketing touches.",
  duplicateTouches:
    "De-duplicate by canonical session touchpoint id (earliest timestamp wins). Dual GA4 + Data Client purchase copies are collapsed to one canonical order. Multiple events inside one session collapse to one attribution touch.",
  sessionTouches:
    "Warehouse sessions are GA4-client only (avoids duplicate sessions from Data Client copies). One eligible acquisition touch per session. Touchpoint id is derived from the canonical session, not transactionId-index.",
  refunds:
    "Financial credit uses Shopify currentTotalPriceSet (net after refunds). Event purchase value is tracking evidence only and is never labeled net_revenue. Journeys stay attached when money changes after a refund.",
  eventValueIsNotRevenue:
    "raw_events_full.value is event_purchase_value / observed_purchase_value. It is not authoritative net_revenue. BigQuery credit views are credit-only until a Shopify order mirror exists.",
  newCustomers:
    "Shopify customer.numberOfOrders <= 1 on the order. Fractional new-customer credit is valid under MTA (weight * 1). Do not round fractional credit internally.",
  rounding:
    "Weights are IEEE floats. Invariant: |sum(credit) - 1| < 1e-9 when any eligible touch exists. Display may round to 2 decimals; stored credit is unrounded.",
  noViewThrough:
    "No view-through. Impressions are not person-level touches.",
  noProbabilisticIdentity:
    "Identity is deterministic only: shopify customer id, hashed email, gn_uid, stape_user_id, client_id, transaction_id.",
} as const;

export const ATTRIBUTION_GLOSSARY = {
  realDirect: POLICY_RULES.realDirect,
  internalNoise: POLICY_RULES.internalNoise,
  unknown: POLICY_RULES.unknownIsNotDirect,
  shopifyMoney:
    "Attributed revenue = Shopify currentTotalPriceSet × attribution credit. Event purchase value is QA evidence only.",
  mer: "Shopify MER = total Shopify revenue ÷ total paid spend.",
  ourPaidRoas:
    "Our Paid ROAS = attributed revenue credited to paid channels ÷ corresponding paid spend. Do not divide all-channel attributed revenue by paid spend and call it ROAS.",
  blendedNcac:
    "Blended nCAC = total ad spend ÷ Shopify new-customer orders. Store-wide, not campaign-attributed.",
  attributedNcac:
    "Attributed nCAC = grain spend ÷ fractional attributed new-customer credit. Null when mapping is unmapped/ambiguous.",
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
