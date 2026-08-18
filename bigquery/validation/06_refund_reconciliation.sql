-- 06 Refund reconciliation: Shopify money truth vs event value.
-- Event `value` is NOT authoritative. Use this only to flag mismatch size.

DECLARE start_ms INT64 DEFAULT UNIX_MILLIS(TIMESTAMP("2026-08-01", "America/Los_Angeles"));
DECLARE end_ms INT64 DEFAULT UNIX_MILLIS(TIMESTAMP("2026-08-19", "America/Los_Angeles"));

SELECT
  COUNT(*) AS purchase_events,
  COUNTIF(IFNULL(value, 0) = 0) AS zero_value_purchases,
  AVG(value) AS avg_event_value
FROM `stape-analytics-487802.stape_data.raw_events_full`
WHERE timestamp >= start_ms AND timestamp < end_ms
  AND LOWER(IFNULL(event_name, "")) = "purchase"
  AND IFNULL(transaction_id, "") != "";

-- Compare to Shopify currentTotalPriceSet (net after refund) exported or
-- dashboard truncation notice. Refunded orders should have lower Shopify net,
-- while the original journey/touches stay attached.
