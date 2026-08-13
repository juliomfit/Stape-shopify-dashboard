-- Optional views for attribution. Run in BigQuery after stape_events exists.
-- Project: stape-analytics-487802
-- Dataset: stape_shopify_dashboard

CREATE OR REPLACE VIEW `stape_shopify_dashboard.v_stape_events_enriched` AS
SELECT
  timestamp,
  TIMESTAMP_MILLIS(timestamp) AS event_time,
  event_name,
  event_id,
  client_id,
  ga_session_id,
  page_location,
  page_referrer,
  REGEXP_EXTRACT(page_location, r'[?&]utm_source=([^&]+)') AS utm_source,
  REGEXP_EXTRACT(page_location, r'[?&]utm_medium=([^&]+)') AS utm_medium,
  REGEXP_EXTRACT(page_location, r'[?&]utm_campaign=([^&]+)') AS utm_campaign,
  REGEXP_EXTRACT(page_location, r'[?&]gclid=([^&]+)') AS gclid_from_url,
  REGEXP_EXTRACT(page_location, r'[?&]fbclid=([^&]+)') AS fbclid_from_url,
  gclid,
  fbclid,
  fbp,
  fbc,
  transaction_id,
  value,
  currency,
  CONCAT(IFNULL(client_id, ''), '|', IFNULL(ga_session_id, '')) AS session_key
FROM `stape_shopify_dashboard.stape_events`;

CREATE OR REPLACE VIEW `stape_shopify_dashboard.v_sessions` AS
SELECT
  session_key,
  client_id,
  MIN(event_time) AS session_start,
  MAX(event_time) AS session_end,
  COUNT(*) AS events
FROM `stape_shopify_dashboard.v_stape_events_enriched`
GROUP BY session_key, client_id;

-- Add these columns when you can (safe to re-run):
ALTER TABLE `stape_shopify_dashboard.stape_events`
ADD COLUMN IF NOT EXISTS user_id STRING;

ALTER TABLE `stape_shopify_dashboard.stape_events`
ADD COLUMN IF NOT EXISTS gbraid STRING;

ALTER TABLE `stape_shopify_dashboard.stape_events`
ADD COLUMN IF NOT EXISTS wbraid STRING;
