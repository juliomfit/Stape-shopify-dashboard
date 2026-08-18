-- 02 Identity coverage on canonical purchases.

DECLARE start_ms INT64 DEFAULT UNIX_MILLIS(TIMESTAMP("2026-08-01", "America/Los_Angeles"));
DECLARE end_ms INT64 DEFAULT UNIX_MILLIS(TIMESTAMP("2026-08-19", "America/Los_Angeles"));

WITH canonical AS (
  SELECT * EXCEPT (rn)
  FROM (
    SELECT
      transaction_id,
      NULLIF(gn_uid, "") AS gn_uid,
      NULLIF(stape_user_id, "") AS stape_user_id,
      COALESCE(NULLIF(shopify_customer_id, ""), NULLIF(user_id, "")) AS shopify_customer_id,
      NULLIF(hashed_email, "") AS hashed_email,
      NULLIF(client_id, "") AS client_id,
      ROW_NUMBER() OVER (
        PARTITION BY transaction_id
        ORDER BY CASE source_client WHEN "Data Client" THEN 0 WHEN "GA4" THEN 1 ELSE 2 END, timestamp
      ) AS rn
    FROM `stape-analytics-487802.stape_data.raw_events_full`
    WHERE timestamp >= start_ms
      AND timestamp < end_ms
      AND LOWER(IFNULL(event_name, "")) = "purchase"
      AND IFNULL(transaction_id, "") != ""
  )
  WHERE rn = 1
)
SELECT
  COUNT(*) AS purchases,
  COUNTIF(gn_uid IS NOT NULL) AS with_gn_uid,
  COUNTIF(stape_user_id IS NOT NULL) AS with_stape_user_id,
  COUNTIF(shopify_customer_id IS NOT NULL) AS with_shopify_customer_id,
  COUNTIF(hashed_email IS NOT NULL) AS with_hashed_email,
  COUNTIF(client_id IS NOT NULL) AS with_client_id,
  COUNTIF(gn_uid IS NOT NULL) / COUNT(*) AS gn_uid_rate,
  COUNTIF(stape_user_id IS NOT NULL) / COUNT(*) AS stape_rate,
  COUNTIF(shopify_customer_id IS NOT NULL) / COUNT(*) AS customer_rate
FROM canonical;
