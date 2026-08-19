-- PURPOSE: Forward correction of analytics.v_attribution_credit_v1 after
--   migration 002 (USER REPORTED COMPLETE). Do NOT roll back 002.
-- TYPE OF CHANGE: CREATE OR REPLACE VIEW
-- PROJECT: stape-analytics-487802
-- DATASET: analytics
-- OBJECTS AFFECTED: analytics.v_attribution_credit_v1
-- DESTRUCTIVE: NO
-- SAFE TO RE-RUN: YES
-- DEPENDENCIES: stape_data.raw_events_full; migration 002 already applied
-- EXPECTED RESULT: Credit-only view. One row per
--   (transaction_id, model_name, touchpoint_id). credit sums to 1.0 per
--   attributed order/model. event_purchase_value is QA only — NOT net_revenue.
--   Internal/checkout noise is excluded. Real Direct is eligible.
--   UNKNOWN is never coerced to Direct.
-- ROLLBACK STRATEGY: CREATE OR REPLACE VIEW with 002 definition if needed.
--   App runtime does not require this view (on-the-fly warehouse SQL).
-- VALIDATION QUERY: bigquery/validation/04_attribution_model_parity.sql
--   then 03_order_credit_integrity.sql then 11a then 11 (re-run lag).
--
-- CREDIT-ONLY: this view must not be used as Shopify money truth. Join
--   Shopify currentTotalPriceSet in the app (or fct_shopify_orders once
--   populated) before reporting attributed revenue.
-- LOOKBACK: this stored view uses a 60-day max window (the longest window the
--   app exposes). App runtime applies 1/7/14/30/60 via @lookbackDays in
--   src/lib/warehouse/sql.ts. Channel CASE must stay in lockstep with
--   src/lib/stape/channel-sql.ts CHANNEL_SQL.
--
-- SCHEMA: fbc/fbp are NOT columns on raw_events_full. CAST NULL AS fbc.
-- IDENTITY: dim_person stitches GA4 sessions to Data Client purchases.

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
    NULLIF(REGEXP_EXTRACT(page_location, r"[?&]utm_source=([^&]+)"), "") AS raw_source,
    NULLIF(REGEXP_EXTRACT(page_location, r"[?&]utm_medium=([^&]+)"), "") AS raw_medium,
    NULLIF(REGEXP_EXTRACT(page_location, r"[?&]utm_campaign=([^&]+)"), "") AS campaign,
    value AS event_purchase_value,
    LOWER(IFNULL(event_name, "")) = "purchase" AND IFNULL(transaction_id, "") != "" AS is_purchase
  FROM `stape-analytics-487802.stape_data.raw_events_full`
),
classified AS (
  SELECT
    stg.*,
    (
      IFNULL(page_location, "") LIKE "%web-pixels@%"
      OR IFNULL(page_location, "") LIKE "%/checkouts/%"
      OR IFNULL(page_location, "") LIKE "%/checkout%"
      OR REGEXP_CONTAINS(IFNULL(page_referrer, ""), r"(?i)(checkout\.shopify|shopifycs\.com|pay\.shopify|shop\.app|paypal\.com|paypal\.me|stripe\.com|klarna\.com|afterpay\.com)")
      OR (
        IFNULL(NET.HOST(page_location), "") != ""
        AND IFNULL(NET.HOST(page_referrer), "") != ""
        AND (
          REGEXP_REPLACE(IFNULL(NET.HOST(page_location), ""), r"^www\.", "")
            = REGEXP_REPLACE(IFNULL(NET.HOST(page_referrer), ""), r"^www\.", "")
          OR ENDS_WITH(
            REGEXP_REPLACE(IFNULL(NET.HOST(page_location), ""), r"^www\.", ""),
            CONCAT(".", REGEXP_REPLACE(IFNULL(NET.HOST(page_referrer), ""), r"^www\.", ""))
          )
          OR ENDS_WITH(
            REGEXP_REPLACE(IFNULL(NET.HOST(page_referrer), ""), r"^www\.", ""),
            CONCAT(".", REGEXP_REPLACE(IFNULL(NET.HOST(page_location), ""), r"^www\.", ""))
          )
        )
        AND IFNULL(gclid, "") = ""
        AND IFNULL(gbraid, "") = ""
        AND IFNULL(wbraid, "") = ""
        AND IFNULL(dclid, "") = ""
        AND IFNULL(fbclid, "") = ""
        AND IFNULL(fbc, "") = ""
        AND IFNULL(ttclid, "") = ""
        AND IFNULL(msclkid, "") = ""
        AND NOT REGEXP_CONTAINS(IFNULL(page_location, ""), r"[?&]utm_source=[^&]+")
        AND NOT REGEXP_CONTAINS(IFNULL(page_location, ""), r"[?&](gclid|gbraid|wbraid|dclid|fbclid|ttclid|msclkid)=")
      )
    ) AS is_internal_noise,
    CASE
      WHEN IFNULL(gclid, "") != ""
        OR IFNULL(gbraid, "") != ""
        OR IFNULL(wbraid, "") != ""
        OR IFNULL(dclid, "") != ""
        OR page_location LIKE "%gclid=%"
        OR page_location LIKE "%wbraid=%"
        OR page_location LIKE "%gbraid=%"
        OR page_location LIKE "%dclid=%"
        OR (
          REGEXP_CONTAINS(IFNULL(page_location, ""), r"[?&]utm_source=google")
          AND REGEXP_CONTAINS(IFNULL(page_location, ""), r"[?&]utm_medium=(cpc|ppc|paid|paidsearch|paid_search)")
        )
        THEN "Google Ads"
      WHEN IFNULL(fbclid, "") != ""
        OR IFNULL(fbc, "") != ""
        OR page_location LIKE "%fbclid=%"
        OR (
          REGEXP_CONTAINS(IFNULL(page_location, ""), r"[?&]utm_source=(facebook|fb|ig|instagram|meta)")
          AND REGEXP_CONTAINS(IFNULL(page_location, ""), r"[?&]utm_medium=(cpc|ppc|paid|paidsocial|paid_social|paid-social)")
        )
        THEN "Facebook / Meta Ads"
      WHEN IFNULL(ttclid, "") != ""
        OR page_location LIKE "%ttclid=%"
        OR REGEXP_CONTAINS(IFNULL(page_location, ""), r"[?&]utm_source=tiktok")
        THEN "TikTok"
      WHEN IFNULL(msclkid, "") != ""
        OR page_location LIKE "%msclkid=%"
        OR REGEXP_CONTAINS(IFNULL(page_location, ""), r"[?&]utm_source=(bing|microsoft)")
        THEN "Microsoft Ads"
      WHEN REGEXP_CONTAINS(IFNULL(page_location, ""), r"[?&]utm_medium=(email|e-mail|sms|mms|edm|newsletter)")
        OR REGEXP_CONTAINS(IFNULL(page_location, ""), r"[?&]utm_source=(sendvio|klaviyo|omnisend|postscript|attentive|mailchimp|brevo|sendgrid|drip|listrak|yotpo|smsbump|judgeme|privy|email|sms)")
        THEN "Email"
      WHEN REGEXP_CONTAINS(IFNULL(page_location, ""), r"[?&]utm_source=(facebook|fb|ig|instagram|meta)")
        OR IFNULL(page_referrer, "") LIKE "%facebook%"
        OR IFNULL(page_referrer, "") LIKE "%instagram%"
        OR IFNULL(page_referrer, "") LIKE "%l.facebook%"
        THEN "Meta Organic"
      WHEN REGEXP_CONTAINS(IFNULL(page_location, ""), r"[?&]utm_source=google")
        OR IFNULL(page_referrer, "") LIKE "%google.%"
        OR IFNULL(page_referrer, "") LIKE "%google.com%"
        OR IFNULL(page_referrer, "") LIKE "%youtube.com%"
        THEN "Google Organic"
      WHEN REGEXP_CONTAINS(IFNULL(page_location, ""), r"[?&]utm_source=[^&]+")
        THEN "Other"
      WHEN IFNULL(page_location, "") != ""
        AND IFNULL(page_location, "") NOT LIKE "%web-pixels@%"
        AND IFNULL(page_location, "") NOT LIKE "%/checkouts/%"
        AND IFNULL(page_location, "") NOT LIKE "%/checkout%"
        AND IFNULL(page_referrer, "") = ""
        THEN "Direct"
      WHEN IFNULL(page_referrer, "") != ""
        AND (
          IFNULL(page_location, "") = ""
          OR STRPOS(IFNULL(page_referrer, ""), IFNULL(NET.HOST(page_location), "")) = 0
        )
        THEN "Other"
      ELSE "Unknown"
    END AS channel
  FROM stg
),
enriched AS (
  SELECT
    classified.*,
    channel IN ("Google Ads", "Facebook / Meta Ads", "TikTok", "Microsoft Ads") AS is_paid,
    channel = "Direct" AND NOT is_internal_noise AS is_direct,
    NOT is_internal_noise AND channel != "Unknown" AS is_touch_eligible
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
      e.event_purchase_value,
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
    MIN(e.event_timestamp) AS session_start
  FROM enriched AS e
  LEFT JOIN dim_person AS p
    ON p.client_id = e.client_id
  WHERE IFNULL(e.source_client, "GA4") = "GA4"
    AND e.client_id IS NOT NULL
    AND e.ga_session_id IS NOT NULL
    AND LOWER(IFNULL(e.event_name, "")) != "shopify_order"
  GROUP BY session_key
),
eligible_session_landing AS (
  SELECT
    CONCAT(e.client_id, "|", e.ga_session_id) AS session_key,
    ANY_VALUE(p.person_id) AS person_id,
    MIN(e.event_timestamp) AS first_eligible_ts,
    ARRAY_AGG(e.campaign IGNORE NULLS ORDER BY e.event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS campaign,
    ARRAY_AGG(e.channel IGNORE NULLS ORDER BY e.event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS channel,
    ARRAY_AGG(e.is_paid IGNORE NULLS ORDER BY e.event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS is_paid,
    ARRAY_AGG(e.is_direct IGNORE NULLS ORDER BY e.event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS is_direct
  FROM enriched AS e
  LEFT JOIN dim_person AS p
    ON p.client_id = e.client_id
  WHERE IFNULL(e.source_client, "GA4") = "GA4"
    AND e.client_id IS NOT NULL
    AND e.ga_session_id IS NOT NULL
    AND LOWER(IFNULL(e.event_name, "")) != "shopify_order"
    AND e.is_touch_eligible
  GROUP BY session_key
),
touchpoints AS (
  SELECT
    TO_HEX(SHA256(CONCAT(l.session_key, CAST(IFNULL(s.session_start, l.first_eligible_ts) AS STRING)))) AS touchpoint_id,
    l.person_id,
    l.session_key,
    l.first_eligible_ts AS touchpoint_timestamp,
    l.campaign,
    l.channel,
    l.is_paid,
    l.is_direct
  FROM eligible_session_landing AS l
  LEFT JOIN sessions AS s
    ON s.session_key = l.session_key
  WHERE l.channel IS NOT NULL
    AND l.channel != "Unknown"
),
order_touches AS (
  SELECT
    o.transaction_id,
    o.event_purchase_value,
    o.order_timestamp,
    t.touchpoint_id,
    t.touchpoint_timestamp,
    t.channel,
    t.campaign,
    t.is_paid,
    t.is_direct,
    TIMESTAMP_DIFF(o.order_timestamp, t.touchpoint_timestamp, HOUR) AS hours_to_conversion
  FROM orders AS o
  JOIN touchpoints AS t
    ON t.person_id = o.person_id
   AND t.person_id IS NOT NULL
   AND t.touchpoint_timestamp <= o.order_timestamp
   AND t.touchpoint_timestamp >= TIMESTAMP_SUB(o.order_timestamp, INTERVAL 60 DAY)
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
  QUALIFY CASE model.model_name
    -- Winner-take-all: exactly one touch at 100%. Same-timestamp ties break
    -- on touchpoint_id to match TypeScript eligibleTouches (timestamp, id).
    WHEN "first_touch" THEN ROW_NUMBER() OVER (
      PARTITION BY ot.transaction_id, model.model_name
      ORDER BY ot.touchpoint_timestamp ASC, ot.touchpoint_id ASC
    ) = 1
    WHEN "last_touch" THEN ROW_NUMBER() OVER (
      PARTITION BY ot.transaction_id, model.model_name
      ORDER BY ot.touchpoint_timestamp DESC, ot.touchpoint_id DESC
    ) = 1
    WHEN "last_non_direct" THEN ROW_NUMBER() OVER (
      PARTITION BY ot.transaction_id, model.model_name
      ORDER BY IF(NOT ot.is_direct, 0, 1), ot.touchpoint_timestamp DESC, ot.touchpoint_id DESC
    ) = 1
    WHEN "paid_only" THEN ot.is_paid
    ELSE TRUE
  END
)
SELECT
  transaction_id,
  model_name,
  touchpoint_id,
  channel,
  campaign,
  is_paid,
  is_direct,
  event_purchase_value,
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
  END AS credit
FROM credited_raw;
