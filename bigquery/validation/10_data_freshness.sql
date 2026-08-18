-- 10 Data freshness.

SELECT
  "raw_events_full" AS source,
  MAX(TIMESTAMP_MILLIS(timestamp)) AS last_event_at,
  TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), MAX(TIMESTAMP_MILLIS(timestamp)), MINUTE) AS lag_minutes
FROM `stape-analytics-487802.stape_data.raw_events_full`;

SELECT
  "meta_campaign_insights_daily" AS source,
  MAX(date) AS last_date,
  MAX(synced_at) AS last_synced_at
FROM `stape-analytics-487802.goodsnova_platform.meta_campaign_insights_daily`;

-- Shopify freshness is the Admin API request time (not in BigQuery).
-- Dashboard Data health uses platform sync_runs for Meta/GA4 labels.
-- Never fabricate a freshness timestamp.
