-- LEGACY — DO NOT RUN IN PRODUCTION
-- Test-table bootstrap. Canonical events live in stape_data.raw_events_full.
-- Do not point attribution at stape_shopify_dashboard.stape_events.
-- New BigQuery dataset + table for this dashboard.
-- Run in Google Cloud Console → BigQuery → Compose a new query.
-- Replace YOUR_PROJECT_ID if needed, then click Run.

CREATE SCHEMA IF NOT EXISTS `stape_shopify_dashboard`
OPTIONS (location = 'US');

CREATE TABLE IF NOT EXISTS `stape_shopify_dashboard.stape_events` (
  timestamp INTEGER,
  event_name STRING,
  event_id STRING,
  client_id STRING,
  ga_session_id STRING,
  page_location STRING,
  page_referrer STRING,
  page_hostname STRING,
  page_path STRING,
  source STRING,
  medium STRING,
  campaign STRING,
  gclid STRING,
  fbclid STRING,
  fbp STRING,
  fbc STRING,
  transaction_id STRING,
  value FLOAT64,
  currency STRING,
  user_agent STRING
);
