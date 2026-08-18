-- PURPOSE: Remove dashboard_events view expiration (currently 2026-10-11) and
--   expose identity + click-id columns from raw_events_full. Optionally extend
--   raw_events_full partition retention so 60d+ attribution windows are real.
-- TYPE OF CHANGE: CREATE OR REPLACE VIEW; ALTER TABLE OPTIONS (retention up)
-- PROJECT: stape-analytics-487802
-- DATASET: stape_data
-- OBJECTS AFFECTED: stape_data.dashboard_events; stape_data.raw_events_full OPTIONS
-- DESTRUCTIVE: NO (retention is increased, not decreased; view replaced in place)
-- SAFE TO RE-RUN: YES
-- DEPENDENCIES: stape_data.raw_events_full
-- EXPECTED RESULT: dashboard_events has no expiration_timestamp. Identity columns
--   (gn_uid, stape_user_id, hashed_email, fbclid) are queryable on the view.
--   raw_events_full partition_expiration_days = 400 if the ALTER is run.
-- ROLLBACK STRATEGY: Recreate the previous view definition if known. Reducing
--   partition_expiration_days is MANUAL REVIEW REQUIRED — DESTRUCTIVE for old
--   partitions and is not included here.
-- VALIDATION QUERY: bigquery/validation/08_event_retention.sql
--
-- App rollout: dashboard_events path in src/lib/stape/config.ts still nulls some
-- click-id columns for backward compatibility with the old view. After this
-- migration, prefer BIGQUERY_TABLE=raw_events_full (warehouse already does) or
-- update eventsFromSql to select the new view columns.

CREATE OR REPLACE VIEW `stape-analytics-487802.stape_data.dashboard_events` AS
WITH ranked AS (
  SELECT
    TIMESTAMP_MILLIS(timestamp) AS event_time,
    DATE(TIMESTAMP_MILLIS(timestamp), "America/Los_Angeles") AS event_date,
    event_name,
    event_id,
    source_client,
    client_id,
    user_id,
    ga_session_id,
    page_location,
    page_referrer,
    gclid,
    gbraid,
    wbraid,
    dclid,
    fbclid,
    fbc,
    fbp,
    ttclid,
    msclkid,
    transaction_id,
    value,
    currency,
    gn_uid,
    stape_user_id,
    hashed_email,
    shopify_customer_id,
    ROW_NUMBER() OVER (
      PARTITION BY
        IFNULL(event_id, TO_HEX(SHA256(CONCAT(
          IFNULL(client_id, ""),
          CAST(timestamp AS STRING),
          IFNULL(event_name, "")
        ))))
      ORDER BY CASE source_client WHEN "GA4" THEN 0 WHEN "Data Client" THEN 1 ELSE 2 END
    ) AS rn
  FROM `stape-analytics-487802.stape_data.raw_events_full`
  WHERE event_name IS NOT NULL
    AND LOWER(IFNULL(event_name, "")) != "shopify_order"
)
SELECT
  event_time,
  event_date,
  event_name,
  event_id,
  source_client,
  client_id,
  user_id,
  ga_session_id,
  page_location,
  page_referrer,
  gclid,
  gbraid,
  wbraid,
  dclid,
  fbclid,
  fbc,
  fbp,
  ttclid,
  msclkid,
  transaction_id,
  value,
  currency,
  gn_uid,
  stape_user_id,
  hashed_email,
  shopify_customer_id
FROM ranked
WHERE rn = 1;

-- Extend partition retention so 60-day attribution windows are fully backed.
-- This does NOT delete data. Do not lower this value without a destructive review.
ALTER TABLE `stape-analytics-487802.stape_data.raw_events_full`
SET OPTIONS (partition_expiration_days = 400);
