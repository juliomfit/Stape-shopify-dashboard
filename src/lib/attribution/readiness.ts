/**
 * MMM / incrementality readiness. Do not render fake models.
 *
 * Current retained first-party event history is ~60 days of raw_events_full
 * partitions. That is not enough daily history for a statistically meaningful
 * marketing-mix model. Incrementality requires geo experiments, not model diffs.
 */

export const MMM_STATUS = "NOT READY" as const;
export const MMM_REASON =
  "Insufficient historical daily grain (need 12–24 months of date, channel spend, impressions, clicks, Shopify revenue, orders, new customers). raw_events_full currently retains ~60 days.";

export const INCREMENTALITY_STATUS = "NOT READY" as const;
export const INCREMENTALITY_REASON =
  "Attribution model differences are not incrementality. No GeoLift / causal experiment feed is connected.";
