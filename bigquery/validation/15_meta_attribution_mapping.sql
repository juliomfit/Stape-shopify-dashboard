-- 15 Meta attribution mapping (channel vs ID). Status: VALIDATION REQUIRED.
-- Channel Meta credit comes from v_attribution_credit_v1 (do not change 005).
-- Campaign/adset/ad ID coverage is measured from landing URLs, not invented
-- from the credit-view campaign (utm_campaign) column.

DECLARE start_ts TIMESTAMP DEFAULT TIMESTAMP("2026-08-01", "America/Los_Angeles");
DECLARE end_ts TIMESTAMP DEFAULT TIMESTAMP("2026-08-26", "America/Los_Angeles");

WITH purchases AS (
  SELECT DISTINCT transaction_id
  FROM `stape-analytics-487802.stape_data.raw_events_full`
  WHERE timestamp >= UNIX_MILLIS(start_ts)
    AND timestamp < UNIX_MILLIS(end_ts)
    AND LOWER(IFNULL(event_name, "")) = "purchase"
    AND IFNULL(transaction_id, "") != ""
),
meta_orders AS (
  SELECT DISTINCT transaction_id
  FROM `stape-analytics-487802.analytics.v_attribution_credit_v1`
  WHERE model_name = "last_non_direct"
    AND channel = "Facebook / Meta Ads"
    AND transaction_id IN (SELECT transaction_id FROM purchases)
),
url_ids AS (
  SELECT
    COUNTIF(REGEXP_EXTRACT(page_location, r"[?&]gn_meta_campaign_id=([0-9]{1,32})") IS NOT NULL) AS events_with_campaign_id,
    COUNTIF(REGEXP_EXTRACT(page_location, r"[?&]gn_meta_adset_id=([0-9]{1,32})") IS NOT NULL) AS events_with_adset_id,
    COUNTIF(REGEXP_EXTRACT(page_location, r"[?&]gn_meta_ad_id=([0-9]{1,32})") IS NOT NULL) AS events_with_ad_id
  FROM `stape-analytics-487802.stape_data.raw_events_full`
  WHERE timestamp >= UNIX_MILLIS(start_ts)
    AND timestamp < UNIX_MILLIS(end_ts)
)
SELECT
  (SELECT COUNT(*) FROM purchases) AS tracked_orders,
  (SELECT COUNT(*) FROM meta_orders) AS meta_attributed_orders,
  events_with_campaign_id,
  events_with_adset_id,
  events_with_ad_id,
  SAFE_DIVIDE(events_with_campaign_id, (SELECT COUNT(*) FROM meta_orders)) AS campaign_id_events_per_meta_order,
  "VALIDATION REQUIRED" AS status,
  "Historical Meta touches without gn_meta_* stay unmapped. Do not fabricate IDs." AS note
FROM url_ids;
