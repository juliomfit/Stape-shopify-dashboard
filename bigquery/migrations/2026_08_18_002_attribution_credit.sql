-- PURPOSE: Production-scale order credit view matching attribution_policy_v1
--   (TypeScript src/lib/attribution/engine.ts). App warehouse SQL is the same
--   math computed on the fly; this view is for validation and optional marts.
-- TYPE OF CHANGE: CREATE OR REPLACE VIEW
-- PROJECT: stape-analytics-487802
-- DATASET: analytics
-- OBJECTS AFFECTED: analytics.v_attribution_credit_v1
-- DESTRUCTIVE: NO
-- SAFE TO RE-RUN: YES
-- DEPENDENCIES: stape_data.raw_events_full; migration 001
-- EXPECTED RESULT: One row per (transaction_id, model_name, touchpoint_id) with
--   credit summing to 1.0 per attributed order/model. paid_only may have zero
--   rows for an order (unattributed under that model).
-- ROLLBACK STRATEGY: CREATE OR REPLACE VIEW with prior definition, or DROP VIEW
--   analytics.v_attribution_credit_v1 (app does not require this view at runtime).
-- VALIDATION QUERY: bigquery/validation/03_order_credit_integrity.sql
--
-- SCHEMA NOTE (2026-08-19): raw_events_full has fbclid (column + URL). It does
-- NOT have fbc / fbp cookie columns. Selecting `fbc` yields Unrecognized name.
-- Meta paid is detected from fbclid / URL fbclid only.
--
-- IDENTITY: Data Client purchases carry Shopify user_id; GA4 sessions use a
-- different client_id. Do not assign person_id independently on each row.
-- dim_person maps every client_id (including GA4) through the shared
-- transaction_id → Shopify customer, matching src/lib/warehouse/sql.ts.
-- Lookback on this mart is 60 days (max window the app exposes).
--
-- If query 11 returns 0 orders, the view is empty. Re-run this file, then
-- bigquery/validation/11a_credit_view_rowcount.sql, then 11 again.

CREATE OR REPLACE VIEW `stape-analytics-487802.analytics.v_attribution_credit_v1` AS
WITH stg AS (
  SELECT
    TIMESTAMP_MILLIS(timestamp) AS event_timestamp,
    event_name,
    event_id,
    source_client,
    NULLIF(transaction_id, "") AS transaction_id,
    NULLIF(stape_user_id, "") AS stape_user_id,
    NULLIF(gn_uid, "") AS gn_uid,
    COALESCE(NULLIF(shopify_customer_id, ""), NULLIF(user_id, "")) AS shopify_customer_id,
    NULLIF(hashed_email, "") AS hashed_email,
    NULLIF(client_id, "") AS client_id,
    NULLIF(CAST(ga_session_id AS STRING), "") AS ga_session_id,
    page_location,
    page_referrer,
    NET.HOST(page_location) AS page_host,
    NET.HOST(page_referrer) AS referrer_host,
    COALESCE(NULLIF(gclid, ""), NULLIF(REGEXP_EXTRACT(page_location, r"[?&]gclid=([^&]+)"), "")) AS gclid,
    COALESCE(NULLIF(gbraid, ""), NULLIF(REGEXP_EXTRACT(page_location, r"[?&]gbraid=([^&]+)"), "")) AS gbraid,
    COALESCE(NULLIF(wbraid, ""), NULLIF(REGEXP_EXTRACT(page_location, r"[?&]wbraid=([^&]+)"), "")) AS wbraid,
    NULLIF(dclid, "") AS dclid,
    COALESCE(NULLIF(fbclid, ""), NULLIF(REGEXP_EXTRACT(page_location, r"[?&]fbclid=([^&]+)"), "")) AS fbclid,
    CAST(NULL AS STRING) AS fbc,
    NULLIF(REGEXP_EXTRACT(page_location, r"[?&]msclkid=([^&]+)"), "") AS msclkid,
    NULLIF(REGEXP_EXTRACT(page_location, r"[?&]ttclid=([^&]+)"), "") AS ttclid,
    NULLIF(REGEXP_EXTRACT(page_location, r"[?&]utm_campaign=([^&]+)"), "") AS campaign,
    value,
    LOWER(IFNULL(event_name, "")) = "purchase" AND IFNULL(transaction_id, "") != "" AS is_purchase
  FROM `stape-analytics-487802.stape_data.raw_events_full`
),
classified AS (
  SELECT
    stg.*,
    CASE
      WHEN IFNULL(gclid, "") != "" OR IFNULL(gbraid, "") != "" OR IFNULL(wbraid, "") != "" OR IFNULL(dclid, "") != ""
        OR page_location LIKE "%gclid=%" THEN "Google Ads"
      WHEN IFNULL(fbclid, "") != "" OR IFNULL(fbc, "") != "" OR page_location LIKE "%fbclid=%" THEN "Facebook / Meta Ads"
      WHEN IFNULL(ttclid, "") != "" OR page_location LIKE "%ttclid=%"
        OR REGEXP_CONTAINS(IFNULL(page_location, ""), r"[?&]utm_source=tiktok") THEN "TikTok"
      WHEN IFNULL(msclkid, "") != "" OR page_location LIKE "%msclkid=%" THEN "Microsoft Ads"
      WHEN REGEXP_CONTAINS(IFNULL(page_location, ""), r"[?&]utm_medium=(email|sms|mms|newsletter)") THEN "Email"
      WHEN REGEXP_CONTAINS(IFNULL(page_location, ""), r"[?&]utm_source=(facebook|fb|ig|instagram|meta)")
        OR IFNULL(page_referrer, "") LIKE "%facebook%" OR IFNULL(page_referrer, "") LIKE "%instagram%" THEN "Meta Organic"
      WHEN REGEXP_CONTAINS(IFNULL(page_location, ""), r"[?&]utm_source=google")
        OR IFNULL(page_referrer, "") LIKE "%google.%" THEN "Google Organic"
      WHEN IFNULL(page_location, "") LIKE "%web-pixels@%" OR IFNULL(page_location, "") LIKE "%/checkouts/%" THEN "Direct"
      WHEN IFNULL(page_referrer, "") = ""
        OR (IFNULL(page_location, "") != "" AND STRPOS(IFNULL(page_referrer, ""), IFNULL(page_host, "")) > 0) THEN "Direct"
      ELSE "Other"
    END AS channel
  FROM stg
),
enriched AS (
  SELECT
    classified.*,
    channel IN ("Google Ads", "Facebook / Meta Ads", "TikTok", "Microsoft Ads") AS is_paid,
    channel = "Direct" AS is_direct
  FROM classified
),
colliding AS (
  SELECT client_id
  FROM enriched
  WHERE client_id IS NOT NULL AND shopify_customer_id IS NOT NULL
  GROUP BY client_id
  HAVING COUNT(DISTINCT shopify_customer_id) > 1
),
txn_person AS (
  SELECT
    transaction_id,
    ARRAY_AGG(shopify_customer_id IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS shopify_customer_id
  FROM enriched
  WHERE is_purchase
  GROUP BY transaction_id
),
dim_person AS (
  SELECT
    m.client_id,
    CASE
      WHEN m.shopify_customer_id IS NOT NULL THEN CONCAT("cust:", m.shopify_customer_id)
      WHEN m.hashed_email IS NOT NULL THEN CONCAT("email:", m.hashed_email)
      WHEN m.gn_uid IS NOT NULL THEN CONCAT("gn:", m.gn_uid)
      WHEN m.stape_user_id IS NOT NULL THEN CONCAT("stape:", m.stape_user_id)
      ELSE CONCAT("cid:", m.client_id)
    END AS person_id
  FROM (
    SELECT
      s.client_id,
      ANY_VALUE(s.gn_uid) AS gn_uid,
      ANY_VALUE(s.stape_user_id) AS stape_user_id,
      ANY_VALUE(s.hashed_email) AS hashed_email,
      COALESCE(ANY_VALUE(s.shopify_customer_id), ANY_VALUE(t.shopify_customer_id)) AS shopify_customer_id
    FROM enriched AS s
    LEFT JOIN txn_person AS t
      ON s.transaction_id = t.transaction_id
    LEFT JOIN colliding AS c
      ON s.client_id = c.client_id
    WHERE s.client_id IS NOT NULL
      AND c.client_id IS NULL
    GROUP BY s.client_id
  ) AS m
),
orders AS (
  SELECT * EXCEPT (source_rank)
  FROM (
    SELECT
      e.transaction_id,
      e.event_timestamp AS order_timestamp,
      e.value AS net_revenue,
      p.person_id,
      ROW_NUMBER() OVER (
        PARTITION BY e.transaction_id
        ORDER BY CASE e.source_client WHEN "Data Client" THEN 0 WHEN "GA4" THEN 1 ELSE 2 END, e.event_timestamp
      ) AS source_rank
    FROM enriched AS e
    LEFT JOIN dim_person AS p
      ON p.client_id = e.client_id
    WHERE e.is_purchase
  )
  WHERE source_rank = 1
),
sessions AS (
  SELECT
    CONCAT(e.client_id, "|", e.ga_session_id) AS session_key,
    ANY_VALUE(p.person_id) AS person_id,
    MIN(e.event_timestamp) AS session_start,
    ARRAY_AGG(e.channel IGNORE NULLS ORDER BY e.event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS channel,
    ARRAY_AGG(e.campaign IGNORE NULLS ORDER BY e.event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS campaign,
    ARRAY_AGG(e.is_paid IGNORE NULLS ORDER BY e.event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS is_paid,
    ARRAY_AGG(e.is_direct IGNORE NULLS ORDER BY e.event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS is_direct
  FROM enriched AS e
  LEFT JOIN dim_person AS p
    ON p.client_id = e.client_id
  WHERE IFNULL(e.source_client, "GA4") = "GA4"
    AND e.client_id IS NOT NULL
    AND e.ga_session_id IS NOT NULL
    AND LOWER(IFNULL(e.event_name, "")) != "shopify_order"
  GROUP BY session_key
),
order_touches AS (
  SELECT
    o.transaction_id,
    o.net_revenue,
    o.order_timestamp,
    TO_HEX(SHA256(CONCAT(s.session_key, CAST(s.session_start AS STRING)))) AS touchpoint_id,
    s.session_start AS touchpoint_timestamp,
    s.channel,
    s.campaign,
    s.is_paid,
    s.is_direct,
    TIMESTAMP_DIFF(o.order_timestamp, s.session_start, HOUR) AS hours_to_conversion
  FROM orders AS o
  JOIN sessions AS s
    ON s.person_id = o.person_id
   AND s.person_id IS NOT NULL
   AND s.session_start <= o.order_timestamp
   AND s.session_start >= TIMESTAMP_SUB(o.order_timestamp, INTERVAL 60 DAY)
),
credited_raw AS (
  SELECT
    ot.*,
    model.model_name
  FROM order_touches AS ot
  CROSS JOIN UNNEST([
    STRUCT("first_touch" AS model_name),
    STRUCT("last_touch" AS model_name),
    STRUCT("last_non_direct" AS model_name),
    STRUCT("linear" AS model_name),
    STRUCT("position_based" AS model_name),
    STRUCT("paid_only" AS model_name),
    STRUCT("time_decay" AS model_name)
  ]) AS model
  QUALIFY
    (model.model_name = "first_touch"
      AND ot.touchpoint_timestamp = MIN(ot.touchpoint_timestamp) OVER (PARTITION BY ot.transaction_id))
    OR (model.model_name = "last_touch"
      AND ot.touchpoint_timestamp = MAX(ot.touchpoint_timestamp) OVER (PARTITION BY ot.transaction_id))
    OR (model.model_name = "last_non_direct"
      AND ot.touchpoint_timestamp = IFNULL(
        MAX(IF(NOT ot.is_direct, ot.touchpoint_timestamp, NULL)) OVER (PARTITION BY ot.transaction_id),
        MAX(ot.touchpoint_timestamp) OVER (PARTITION BY ot.transaction_id)
      ))
    OR (model.model_name = "paid_only" AND ot.is_paid)
    OR (model.model_name IN ("linear", "position_based", "time_decay"))
)
SELECT
  transaction_id,
  model_name,
  touchpoint_id,
  channel,
  campaign,
  is_paid,
  is_direct,
  net_revenue,
  hours_to_conversion,
  CASE model_name
    WHEN "linear" THEN 1.0 / COUNT(*) OVER (PARTITION BY transaction_id, model_name)
    WHEN "paid_only" THEN 1.0 / COUNT(*) OVER (PARTITION BY transaction_id, model_name)
    WHEN "position_based" THEN
      CASE
        WHEN COUNT(*) OVER (PARTITION BY transaction_id, model_name) = 1 THEN 1.0
        WHEN COUNT(*) OVER (PARTITION BY transaction_id, model_name) = 2 THEN 0.5
        WHEN ROW_NUMBER() OVER (PARTITION BY transaction_id, model_name ORDER BY touchpoint_timestamp ASC, touchpoint_id) = 1 THEN 0.4
        WHEN ROW_NUMBER() OVER (PARTITION BY transaction_id, model_name ORDER BY touchpoint_timestamp DESC, touchpoint_id) = 1 THEN 0.4
        ELSE 0.2 / GREATEST(COUNT(*) OVER (PARTITION BY transaction_id, model_name) - 2, 1)
      END
    WHEN "time_decay" THEN
      POW(2, -IFNULL(hours_to_conversion, 0) / 168)
      / SUM(POW(2, -IFNULL(hours_to_conversion, 0) / 168)) OVER (PARTITION BY transaction_id, model_name)
    ELSE 1.0
  END AS credit,
  net_revenue * CASE model_name
    WHEN "linear" THEN 1.0 / COUNT(*) OVER (PARTITION BY transaction_id, model_name)
    WHEN "paid_only" THEN 1.0 / COUNT(*) OVER (PARTITION BY transaction_id, model_name)
    WHEN "position_based" THEN
      CASE
        WHEN COUNT(*) OVER (PARTITION BY transaction_id, model_name) = 1 THEN 1.0
        WHEN COUNT(*) OVER (PARTITION BY transaction_id, model_name) = 2 THEN 0.5
        WHEN ROW_NUMBER() OVER (PARTITION BY transaction_id, model_name ORDER BY touchpoint_timestamp ASC, touchpoint_id) = 1 THEN 0.4
        WHEN ROW_NUMBER() OVER (PARTITION BY transaction_id, model_name ORDER BY touchpoint_timestamp DESC, touchpoint_id) = 1 THEN 0.4
        ELSE 0.2 / GREATEST(COUNT(*) OVER (PARTITION BY transaction_id, model_name) - 2, 1)
      END
    WHEN "time_decay" THEN
      POW(2, -IFNULL(hours_to_conversion, 0) / 168)
      / SUM(POW(2, -IFNULL(hours_to_conversion, 0) / 168)) OVER (PARTITION BY transaction_id, model_name)
    ELSE 1.0
  END AS attributed_revenue
FROM credited_raw;
