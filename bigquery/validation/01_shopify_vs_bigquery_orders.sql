-- 01 Shopify orders vs BigQuery purchase events (canonical transaction_id).
-- Dual GA4 + Data Client copies are expected; count DISTINCT transaction_id.

DECLARE start_ms INT64 DEFAULT UNIX_MILLIS(TIMESTAMP("2026-08-01", "America/Los_Angeles"));
DECLARE end_ms INT64 DEFAULT UNIX_MILLIS(TIMESTAMP("2026-08-19", "America/Los_Angeles"));

WITH purchases AS (
  SELECT
    transaction_id,
    COUNT(*) AS event_copies,
    COUNTIF(IFNULL(source_client, "GA4") = "GA4") AS ga4_copies,
    COUNTIF(source_client = "Data Client") AS data_client_copies,
    MAX(value) AS event_value
  FROM `stape-analytics-487802.stape_data.raw_events_full`
  WHERE timestamp >= start_ms
    AND timestamp < end_ms
    AND LOWER(IFNULL(event_name, "")) = "purchase"
    AND IFNULL(transaction_id, "") != ""
  GROUP BY transaction_id
)
SELECT
  COUNT(*) AS tracked_orders,
  SUM(event_copies) AS purchase_event_rows,
  COUNTIF(event_copies > 2) AS orders_with_gt_2_copies,
  COUNTIF(ga4_copies > 0 AND data_client_copies > 0) AS dual_client_orders,
  SUM(event_value) AS sum_event_value
FROM purchases;

-- Compare COUNT(*) above to Shopify Admin orders in the same Pacific range.
-- Shopify remains money truth. Do not treat event_value as revenue.
