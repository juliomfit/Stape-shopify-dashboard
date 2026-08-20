-- PURPOSE: Persist Shopify warehouse coverage in BigQuery so Vercel cron
--   checkpoints are visible to dashboard reads. Cookie durable-json is not
--   shared across cron and page requests.
-- TYPE OF CHANGE: CREATE TABLE IF NOT EXISTS
-- PROJECT: stape-analytics-487802
-- DATASET: analytics
-- OBJECTS AFFECTED: analytics.shopify_ingest_coverage
-- DESTRUCTIVE: NO
-- SAFE TO RE-RUN: YES
-- DEPENDENCIES: none
-- EXPECTED RESULT: Single-row checkpoint table exists. App also CREATE TABLE
--   IF NOT EXISTS at runtime, so Production does not crash if this file has
--   not been run.
-- ROLLBACK STRATEGY: Leave the table in place (additive).
-- VALIDATION QUERY:
--   SELECT checkpoint_id, min_date, max_date, populated_at
--   FROM `stape-analytics-487802.analytics.shopify_ingest_coverage`;

CREATE TABLE IF NOT EXISTS `stape-analytics-487802.analytics.shopify_ingest_coverage` (
  checkpoint_id STRING NOT NULL,
  min_date DATE,
  max_date DATE,
  populated_at TIMESTAMP
);
