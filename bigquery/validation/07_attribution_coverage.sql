-- 07 Attribution coverage with identical date bounds.
-- Status: VALIDATION REQUIRED.
--
-- Two denominators, never mixed:
--   1. Warehouse coverage among tracked orders (BigQuery purchases).
--   2. Shopify-to-tracking coverage requires Shopify input. If
--      fct_shopify_orders is empty/missing, shopify_orders_in_mirror is 0 and
--      shopify_to_tracking_coverage is NULL — that is not 0% tracking.

DECLARE start_ts TIMESTAMP DEFAULT TIMESTAMP("2026-08-01", "America/Los_Angeles");
DECLARE end_ts TIMESTAMP DEFAULT TIMESTAMP("2026-08-19", "America/Los_Angeles");

WITH tracked AS (
  SELECT DISTINCT transaction_id
  FROM `stape-analytics-487802.stape_data.raw_events_full`
  WHERE timestamp >= UNIX_MILLIS(start_ts)
    AND timestamp < UNIX_MILLIS(end_ts)
    AND LOWER(IFNULL(event_name, "")) = "purchase"
    AND IFNULL(transaction_id, "") != ""
),
credited AS (
  SELECT DISTINCT transaction_id
  FROM `stape-analytics-487802.analytics.v_attribution_credit_v1`
  WHERE model_name = "last_non_direct"
    AND transaction_id IN (SELECT transaction_id FROM tracked)
),
identity_matched AS (
  SELECT DISTINCT transaction_id
  FROM `stape-analytics-487802.stape_data.raw_events_full`
  WHERE transaction_id IN (SELECT transaction_id FROM tracked)
    AND (
      IFNULL(shopify_customer_id, "") != ""
      OR IFNULL(user_id, "") != ""
      OR IFNULL(gn_uid, "") != ""
      OR IFNULL(stape_user_id, "") != ""
    )
),
mirror_exists AS (
  SELECT COUNT(*) AS table_present
  FROM `stape-analytics-487802.analytics.INFORMATION_SCHEMA.TABLES`
  WHERE table_name = "fct_shopify_orders"
)
SELECT
  UNIX_MILLIS(start_ts) AS start_ms,
  UNIX_MILLIS(end_ts) AS end_ms,
  (SELECT COUNT(*) FROM tracked) AS tracked_purchases,
  (SELECT COUNT(*) FROM identity_matched) AS identity_matched,
  (SELECT COUNT(*) FROM credited) AS journey_matched,
  (SELECT COUNT(*) FROM credited) AS credited_orders,
  (SELECT COUNT(*) FROM tracked) - (SELECT COUNT(*) FROM credited) AS unattributed_count,
  SAFE_DIVIDE((SELECT COUNT(*) FROM identity_matched), (SELECT COUNT(*) FROM tracked)) AS identity_match_rate,
  SAFE_DIVIDE((SELECT COUNT(*) FROM credited), (SELECT COUNT(*) FROM tracked)) AS journey_match_rate,
  SAFE_DIVIDE((SELECT COUNT(*) FROM credited), (SELECT COUNT(*) FROM tracked)) AS warehouse_attribution_coverage,
  (SELECT table_present FROM mirror_exists) AS shopify_mirror_table_present,
  CAST(NULL AS FLOAT64) AS shopify_to_tracking_coverage,
  "VALIDATION REQUIRED — warehouse rates use tracked BigQuery purchases as the denominator for the same start/end. Shopify-to-tracking coverage stays NULL until a Shopify order count for this window is supplied or fct_shopify_orders is populated. Do not mix denominators." AS status;
