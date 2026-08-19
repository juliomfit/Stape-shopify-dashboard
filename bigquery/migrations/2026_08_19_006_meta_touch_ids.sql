-- PURPOSE: Add nullable typed Meta identity columns on raw_events_full so
--   sGTM can persist first-party gn_meta_* cookies as structured fields.
--   Canonical attribution does NOT depend on these columns yet: warehouse SQL
--   extracts gn_meta_* from page_location until this migration is confirmed.
-- TYPE OF CHANGE: ALTER TABLE ADD COLUMN IF NOT EXISTS (additive STRING)
-- PROJECT: stape-analytics-487802
-- DATASET: stape_data
-- OBJECTS AFFECTED: stape_data.raw_events_full
-- DESTRUCTIVE: NO
-- SAFE TO RE-RUN: YES
-- DEPENDENCIES: stape_data.raw_events_full exists
-- EXPECTED RESULT: three new nullable STRING columns:
--   meta_campaign_id, meta_adset_id, meta_ad_id
-- ROLLBACK STRATEGY: BigQuery cannot cheaply DROP COLUMN in all environments.
--   Leave unused columns in place. Do not DROP.
-- VALIDATION QUERY: bigquery/validation/13_meta_id_capture.sql
-- STATUS: USER MUST RUN — not validated
--
-- Do not edit migrations 001–005 for this feature.

ALTER TABLE `stape-analytics-487802.stape_data.raw_events_full`
  ADD COLUMN IF NOT EXISTS meta_campaign_id STRING,
  ADD COLUMN IF NOT EXISTS meta_adset_id STRING,
  ADD COLUMN IF NOT EXISTS meta_ad_id STRING;
