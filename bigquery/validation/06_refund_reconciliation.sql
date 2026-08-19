-- 06 Refund reconciliation.
-- Event purchase value is NOT Shopify money truth.
-- BigQuery cannot complete Shopify-vs-event refund reconciliation until
-- analytics.fct_shopify_orders is populated (migration 004, currently unused).
--
-- Status: VALIDATION REQUIRED.
-- Application runtime already joins Admin API currentTotalPriceSet (net after
-- refund) onto canonical credit. Full refund → attributed revenue 0; journey
-- stays attached. See test/canonical-golden.test.ts.

DECLARE start_ts TIMESTAMP DEFAULT TIMESTAMP("2026-08-01", "America/Los_Angeles");
DECLARE end_ts TIMESTAMP DEFAULT TIMESTAMP("2026-08-19", "America/Los_Angeles");

WITH events AS (
  SELECT
    transaction_id,
    ANY_VALUE(value) AS event_purchase_value
  FROM `stape-analytics-487802.stape_data.raw_events_full`
  WHERE timestamp >= UNIX_MILLIS(start_ts)
    AND timestamp < UNIX_MILLIS(end_ts)
    AND LOWER(IFNULL(event_name, "")) = "purchase"
    AND IFNULL(transaction_id, "") != ""
  GROUP BY transaction_id
),
mirror_exists AS (
  SELECT COUNT(*) AS table_present
  FROM `stape-analytics-487802.analytics.INFORMATION_SCHEMA.TABLES`
  WHERE table_name = "fct_shopify_orders"
)
SELECT
  (SELECT COUNT(*) FROM events) AS tracked_orders,
  (SELECT COUNTIF(IFNULL(event_purchase_value, 0) = 0) FROM events) AS zero_event_value_orders,
  (SELECT table_present FROM mirror_exists) AS shopify_mirror_table_present,
  CAST(NULL AS INT64) AS shopify_mirror_rows,
  CAST(NULL AS INT64) AS joined_rows,
  CAST(NULL AS INT64) AS refunded_joined,
  "VALIDATION REQUIRED — BigQuery-only refund reconciliation cannot be completed until analytics.fct_shopify_orders is populated (migration 004). Do not treat event value as net_revenue. App runtime uses Shopify Admin currentTotalPriceSet." AS status;
