-- PURPOSE: Remove dashboard_events view expiration and extend raw_events_full
--   retention to 400 days. Canonical attribution does NOT use this view — it
--   reads raw_events_full. This view is for funnel / legacy dashboard_events
--   consumers only.
-- TYPE OF CHANGE: CREATE OR REPLACE VIEW; ALTER VIEW OPTIONS (clear expiration);
--   ALTER TABLE OPTIONS (retention up)
-- PROJECT: stape-analytics-487802
-- DATASET: stape_data
-- OBJECTS AFFECTED: stape_data.dashboard_events; stape_data.raw_events_full OPTIONS
-- DESTRUCTIVE: NO
-- SAFE TO RE-RUN: YES
-- DEPENDENCIES: stape_data.raw_events_full
-- EXPECTED RESULT: dashboard_events has no expiration_timestamp.
--   Identity columns are coalesced across GA4 + Data Client duplicates (Data
--   Client identity wins when present). Payload fields prefer GA4.
--   fbc / fbp are CAST NULL.
--   raw_events_full partition_expiration_days = 400.
-- ROLLBACK STRATEGY: Recreate the previous view definition if known. Reducing
--   partition_expiration_days is MANUAL REVIEW REQUIRED — not included here.
-- VALIDATION QUERY: bigquery/validation/08_event_retention.sql
--
-- Do not advertise this view as lossless identity passthrough for attribution.
-- Attribution stays on raw_events_full.

CREATE OR REPLACE VIEW `stape-analytics-487802.stape_data.dashboard_events` AS
WITH grouped AS (
  SELECT
    IFNULL(event_id, TO_HEX(SHA256(CONCAT(
      IFNULL(client_id, ""),
      CAST(timestamp AS STRING),
      IFNULL(event_name, "")
    )))) AS dedupe_key,
    MIN(TIMESTAMP_MILLIS(timestamp)) AS event_time,
    MIN(DATE(TIMESTAMP_MILLIS(timestamp), "America/Los_Angeles")) AS event_date,
    ANY_VALUE(event_name) AS event_name,
    ANY_VALUE(event_id) AS event_id,
    ARRAY_AGG(source_client IGNORE NULLS ORDER BY CASE source_client WHEN "GA4" THEN 0 ELSE 1 END LIMIT 1)[SAFE_OFFSET(0)] AS source_client,
    ARRAY_AGG(client_id IGNORE NULLS ORDER BY CASE source_client WHEN "GA4" THEN 0 ELSE 1 END LIMIT 1)[SAFE_OFFSET(0)] AS client_id,
    ARRAY_AGG(user_id IGNORE NULLS ORDER BY CASE source_client WHEN "Data Client" THEN 0 ELSE 1 END LIMIT 1)[SAFE_OFFSET(0)] AS user_id,
    ARRAY_AGG(ga_session_id IGNORE NULLS ORDER BY CASE source_client WHEN "GA4" THEN 0 ELSE 1 END LIMIT 1)[SAFE_OFFSET(0)] AS ga_session_id,
    ARRAY_AGG(page_location IGNORE NULLS ORDER BY CASE source_client WHEN "GA4" THEN 0 ELSE 1 END LIMIT 1)[SAFE_OFFSET(0)] AS page_location,
    ARRAY_AGG(page_referrer IGNORE NULLS ORDER BY CASE source_client WHEN "GA4" THEN 0 ELSE 1 END LIMIT 1)[SAFE_OFFSET(0)] AS page_referrer,
    ARRAY_AGG(gclid IGNORE NULLS LIMIT 1)[SAFE_OFFSET(0)] AS gclid,
    ARRAY_AGG(gbraid IGNORE NULLS LIMIT 1)[SAFE_OFFSET(0)] AS gbraid,
    ARRAY_AGG(wbraid IGNORE NULLS LIMIT 1)[SAFE_OFFSET(0)] AS wbraid,
    ARRAY_AGG(dclid IGNORE NULLS LIMIT 1)[SAFE_OFFSET(0)] AS dclid,
    ARRAY_AGG(
      COALESCE(NULLIF(fbclid, ""), NULLIF(REGEXP_EXTRACT(page_location, r"[?&]fbclid=([^&]+)"), ""))
      IGNORE NULLS LIMIT 1
    )[SAFE_OFFSET(0)] AS fbclid,
    ARRAY_AGG(transaction_id IGNORE NULLS LIMIT 1)[SAFE_OFFSET(0)] AS transaction_id,
    ARRAY_AGG(value IGNORE NULLS LIMIT 1)[SAFE_OFFSET(0)] AS value,
    ARRAY_AGG(currency IGNORE NULLS LIMIT 1)[SAFE_OFFSET(0)] AS currency,
    ARRAY_AGG(NULLIF(gn_uid, "") IGNORE NULLS ORDER BY CASE source_client WHEN "Data Client" THEN 0 ELSE 1 END LIMIT 1)[SAFE_OFFSET(0)] AS gn_uid,
    ARRAY_AGG(NULLIF(stape_user_id, "") IGNORE NULLS ORDER BY CASE source_client WHEN "Data Client" THEN 0 ELSE 1 END LIMIT 1)[SAFE_OFFSET(0)] AS stape_user_id,
    ARRAY_AGG(NULLIF(hashed_email, "") IGNORE NULLS ORDER BY CASE source_client WHEN "Data Client" THEN 0 ELSE 1 END LIMIT 1)[SAFE_OFFSET(0)] AS hashed_email,
    ARRAY_AGG(NULLIF(shopify_customer_id, "") IGNORE NULLS ORDER BY CASE source_client WHEN "Data Client" THEN 0 ELSE 1 END LIMIT 1)[SAFE_OFFSET(0)] AS shopify_customer_id
  FROM `stape-analytics-487802.stape_data.raw_events_full`
  WHERE event_name IS NOT NULL
    AND LOWER(IFNULL(event_name, "")) != "shopify_order"
  GROUP BY dedupe_key
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
  CAST(NULL AS STRING) AS fbc,
  CAST(NULL AS STRING) AS fbp,
  CAST(NULL AS STRING) AS ttclid,
  CAST(NULL AS STRING) AS msclkid,
  transaction_id,
  value,
  currency,
  gn_uid,
  stape_user_id,
  hashed_email,
  shopify_customer_id
FROM grouped;

ALTER VIEW `stape-analytics-487802.stape_data.dashboard_events`
SET OPTIONS (expiration_timestamp = NULL);

ALTER TABLE `stape-analytics-487802.stape_data.raw_events_full`
SET OPTIONS (partition_expiration_days = 400);
