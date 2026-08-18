-- 07 Attribution coverage: canonical purchases vs credited orders.

SELECT
  (SELECT COUNT(DISTINCT transaction_id)
   FROM `stape-analytics-487802.stape_data.raw_events_full`
   WHERE LOWER(IFNULL(event_name, "")) = "purchase"
     AND IFNULL(transaction_id, "") != ""
     AND timestamp >= UNIX_MILLIS(TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY))
  ) AS tracked_purchases_7d,
  (SELECT COUNT(DISTINCT transaction_id)
   FROM `stape-analytics-487802.analytics.v_attribution_credit_v1`
   WHERE model_name = "last_non_direct"
  ) AS credited_last_non_direct,
  "VALIDATION REQUIRED" AS attribution_coverage;

-- Unattributed = tracked_purchases - credited. Do not force those into Direct.
