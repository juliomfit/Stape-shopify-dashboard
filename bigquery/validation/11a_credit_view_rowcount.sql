-- 11a Why conversion-lag / credit validation returned 0 rows.
-- Run this BEFORE or AFTER recreating v_attribution_credit_v1.
-- Do not invent coverage % from these counts.

SELECT
  (SELECT COUNT(*)
   FROM `stape-analytics-487802.analytics.v_attribution_credit_v1`) AS credit_rows,
  (SELECT COUNT(DISTINCT transaction_id)
   FROM `stape-analytics-487802.analytics.v_attribution_credit_v1`) AS credited_orders,
  (SELECT COUNT(DISTINCT transaction_id)
   FROM `stape-analytics-487802.stape_data.raw_events_full`
   WHERE LOWER(IFNULL(event_name, "")) = "purchase"
     AND IFNULL(transaction_id, "") != "") AS purchase_transaction_ids,
  (SELECT COUNTIF(IFNULL(source_client, "") = "GA4")
   FROM `stape-analytics-487802.stape_data.raw_events_full`
   WHERE LOWER(IFNULL(event_name, "")) = "purchase"
     AND IFNULL(transaction_id, "") != "") AS ga4_purchase_rows,
  (SELECT COUNTIF(IFNULL(source_client, "") = "Data Client")
   FROM `stape-analytics-487802.stape_data.raw_events_full`
   WHERE LOWER(IFNULL(event_name, "")) = "purchase"
     AND IFNULL(transaction_id, "") != "") AS data_client_purchase_rows;

-- Interpretation:
-- credit_rows = 0 and purchase_transaction_ids > 0
--   → identity join missed (old view assigned cust: on Data Client orders
--     and cid: on GA4 sessions). Re-run migration 002, then this query,
--     then 11_conversion_lag_distribution.sql.
-- purchase_transaction_ids = 0
--   → no purchases in retained raw_events_full partitions. Check 08_event_retention.sql.
-- credit_rows > 0
--   → re-run 11; P50–P99 should populate.
