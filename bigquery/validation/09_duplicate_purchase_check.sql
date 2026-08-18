-- 09 Duplicate purchase check.
-- Dual GA4 + Data Client copies of the same transaction_id are EXPECTED.
-- Flag copies beyond that, or missing transaction_id on purchase.

DECLARE start_ms INT64 DEFAULT UNIX_MILLIS(TIMESTAMP("2026-08-01", "America/Los_Angeles"));
DECLARE end_ms INT64 DEFAULT UNIX_MILLIS(TIMESTAMP("2026-08-19", "America/Los_Angeles"));

SELECT
  COUNTIF(LOWER(IFNULL(event_name, "")) = "purchase" AND IFNULL(transaction_id, "") = "") AS purchase_missing_txn,
  COUNTIF(LOWER(IFNULL(event_name, "")) IN ("purchase", "order_completed") AND IFNULL(transaction_id, "") != "") AS purchase_with_txn
FROM `stape-analytics-487802.stape_data.raw_events_full`
WHERE timestamp >= start_ms AND timestamp < end_ms;

SELECT
  transaction_id,
  COUNT(*) AS copies,
  COUNT(DISTINCT IFNULL(source_client, "GA4")) AS clients,
  STRING_AGG(DISTINCT IFNULL(source_client, "GA4")) AS source_clients
FROM `stape-analytics-487802.stape_data.raw_events_full`
WHERE timestamp >= start_ms AND timestamp < end_ms
  AND LOWER(IFNULL(event_name, "")) = "purchase"
  AND IFNULL(transaction_id, "") != ""
GROUP BY transaction_id
HAVING COUNT(*) > 2
ORDER BY copies DESC
LIMIT 50;
