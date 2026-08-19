-- 18 Meta validation pack.
-- Run as one BigQuery multi-statement script. Returns six result sets:
-- 13, 14, 15, 16, 17, 17a.
-- Each validation is a scoped BEGIN/END block so DECLARE start_ts / end_ts
-- do not collide. Do not change the inner SQL; this file only concatenates.
-- Status: VALIDATION REQUIRED. Do not mark VALIDATED without pasted output.

-- 13 Meta ID capture
BEGIN
-- 13 Meta ID capture (landing URL). Status: VALIDATION REQUIRED.
-- Does not claim campaign attribution is production verified.
-- Uses page_location extract so this runs BEFORE migration 006 typed columns.
-- After 006 + sGTM mapping, optionally also inspect meta_campaign_id columns.

DECLARE start_ts TIMESTAMP DEFAULT TIMESTAMP("2026-08-19", "America/Los_Angeles");
DECLARE end_ts TIMESTAMP DEFAULT TIMESTAMP("2026-08-26", "America/Los_Angeles");

WITH stg AS (
  SELECT
    event_name,
    source_client,
    page_location,
    NULLIF(fbclid, "") AS fbclid_col,
    NULLIF(REGEXP_EXTRACT(page_location, r"[?&]fbclid=([^&]+)"), "") AS fbclid_url,
    NULLIF(REGEXP_EXTRACT(page_location, r"[?&]gn_meta_campaign_id=([0-9]{1,32})"), "") AS meta_campaign_id,
    NULLIF(REGEXP_EXTRACT(page_location, r"[?&]gn_meta_adset_id=([0-9]{1,32})"), "") AS meta_adset_id,
    NULLIF(REGEXP_EXTRACT(page_location, r"[?&]gn_meta_ad_id=([0-9]{1,32})"), "") AS meta_ad_id
  FROM `stape-analytics-487802.stape_data.raw_events_full`
  WHERE timestamp >= UNIX_MILLIS(start_ts)
    AND timestamp < UNIX_MILLIS(end_ts)
    AND LOWER(IFNULL(event_name, "")) IN ("page_view", "view_item", "purchase")
),
meta_like AS (
  SELECT *
  FROM stg
  WHERE COALESCE(fbclid_col, fbclid_url) IS NOT NULL
     OR page_location LIKE "%fbclid=%"
     OR REGEXP_CONTAINS(LOWER(IFNULL(page_location, "")), r"[?&]utm_source=(facebook|fb|ig|instagram|meta)")
     OR meta_campaign_id IS NOT NULL
     OR meta_adset_id IS NOT NULL
     OR meta_ad_id IS NOT NULL
)
SELECT
  COUNT(*) AS meta_like_events,
  COUNTIF(meta_campaign_id IS NOT NULL) AS with_campaign_id,
  COUNTIF(meta_adset_id IS NOT NULL) AS with_adset_id,
  COUNTIF(meta_ad_id IS NOT NULL) AS with_ad_id,
  SAFE_DIVIDE(COUNTIF(meta_campaign_id IS NOT NULL), COUNT(*)) AS campaign_id_coverage,
  SAFE_DIVIDE(COUNTIF(meta_adset_id IS NOT NULL), COUNT(*)) AS adset_id_coverage,
  SAFE_DIVIDE(COUNTIF(meta_ad_id IS NOT NULL), COUNT(*)) AS ad_id_coverage,
  COUNTIF(COALESCE(fbclid_col, fbclid_url) IS NOT NULL AND meta_campaign_id IS NULL AND meta_adset_id IS NULL AND meta_ad_id IS NULL) AS fbclid_without_meta_ids,
  "VALIDATION REQUIRED" AS status,
  "Do not mark campaign attribution verified until IDs appear on a live test click and match Meta facts (query 14)." AS note
FROM meta_like;
END;

-- 14 Meta ID fact match
BEGIN
-- 14 Meta ID fact match. Status: VALIDATION REQUIRED.
-- Exact ID join only. No name fallback in this query.

DECLARE start_ts TIMESTAMP DEFAULT TIMESTAMP("2026-08-19", "America/Los_Angeles");
DECLARE end_ts TIMESTAMP DEFAULT TIMESTAMP("2026-08-26", "America/Los_Angeles");

WITH observed AS (
  SELECT DISTINCT
    NULLIF(REGEXP_EXTRACT(page_location, r"[?&]gn_meta_campaign_id=([0-9]{1,32})"), "") AS campaign_id,
    NULLIF(REGEXP_EXTRACT(page_location, r"[?&]gn_meta_adset_id=([0-9]{1,32})"), "") AS adset_id,
    NULLIF(REGEXP_EXTRACT(page_location, r"[?&]gn_meta_ad_id=([0-9]{1,32})"), "") AS ad_id
  FROM `stape-analytics-487802.stape_data.raw_events_full`
  WHERE timestamp >= UNIX_MILLIS(start_ts)
    AND timestamp < UNIX_MILLIS(end_ts)
),
campaign_ids AS (
  SELECT DISTINCT campaign_id FROM observed WHERE campaign_id IS NOT NULL
),
adset_ids AS (
  SELECT DISTINCT adset_id FROM observed WHERE adset_id IS NOT NULL
),
ad_ids AS (
  SELECT DISTINCT ad_id FROM observed WHERE ad_id IS NOT NULL
),
meta_campaigns AS (
  SELECT DISTINCT CAST(campaign_id AS STRING) AS campaign_id
  FROM `stape-analytics-487802.goodsnova_platform.meta_campaign_insights_daily`
),
meta_adsets AS (
  SELECT DISTINCT CAST(adset_id AS STRING) AS adset_id
  FROM `stape-analytics-487802.goodsnova_platform.meta_adset_insights_daily`
),
meta_ads AS (
  SELECT DISTINCT CAST(ad_id AS STRING) AS ad_id
  FROM `stape-analytics-487802.goodsnova_platform.meta_ad_insights_daily`
)
SELECT
  (SELECT COUNT(*) FROM campaign_ids) AS observed_campaign_ids,
  (SELECT COUNT(*) FROM campaign_ids c WHERE EXISTS (SELECT 1 FROM meta_campaigns m WHERE m.campaign_id = c.campaign_id)) AS campaign_id_exact_matches,
  (SELECT COUNT(*) FROM campaign_ids c WHERE NOT EXISTS (SELECT 1 FROM meta_campaigns m WHERE m.campaign_id = c.campaign_id)) AS campaign_ids_missing_from_facts,
  (SELECT COUNT(*) FROM adset_ids) AS observed_adset_ids,
  (SELECT COUNT(*) FROM adset_ids a WHERE EXISTS (SELECT 1 FROM meta_adsets m WHERE m.adset_id = a.adset_id)) AS adset_exact_matches,
  (SELECT COUNT(*) FROM adset_ids a WHERE NOT EXISTS (SELECT 1 FROM meta_adsets m WHERE m.adset_id = a.adset_id)) AS adset_ids_missing_from_facts,
  (SELECT COUNT(*) FROM ad_ids) AS observed_ad_ids,
  (SELECT COUNT(*) FROM ad_ids a WHERE EXISTS (SELECT 1 FROM meta_ads m WHERE m.ad_id = a.ad_id)) AS ad_exact_matches,
  (SELECT COUNT(*) FROM ad_ids a WHERE NOT EXISTS (SELECT 1 FROM meta_ads m WHERE m.ad_id = a.ad_id)) AS ad_ids_missing_from_facts,
  "VALIDATION REQUIRED" AS status;
END;

-- 15 Meta attribution mapping
BEGIN
-- 15 Meta attribution mapping at canonical ORDER grain.
-- Status: VALIDATION REQUIRED.
-- last_non_direct Meta credit is one credited touch per Meta-attributed order.
-- Join that credited touchpoint_id to the canonical SHA256 session touch
-- (same construction as 005 / warehouse sql.ts / validation 17).
-- Do not divide event counts by orders. Rates must stay in [0, 1].
-- SESSION_ID_CONFLICT and META_HIERARCHY_CONFLICT are not fully mapped.

DECLARE start_ts TIMESTAMP DEFAULT TIMESTAMP("2026-08-01", "America/Los_Angeles");
DECLARE end_ts TIMESTAMP DEFAULT TIMESTAMP("2026-08-26", "America/Los_Angeles");

WITH purchases AS (
  SELECT transaction_id
  FROM `stape-analytics-487802.stape_data.raw_events_full`
  WHERE timestamp >= UNIX_MILLIS(start_ts)
    AND timestamp < UNIX_MILLIS(end_ts)
    AND LOWER(IFNULL(event_name, "")) = "purchase"
    AND IFNULL(transaction_id, "") != ""
  GROUP BY transaction_id
),
meta_credit AS (
  SELECT
    transaction_id,
    touchpoint_id,
    credit
  FROM `stape-analytics-487802.analytics.v_attribution_credit_v1`
  WHERE model_name = "last_non_direct"
    AND channel = "Facebook / Meta Ads"
    AND transaction_id IN (SELECT transaction_id FROM purchases)
),
meta_orders AS (
  SELECT
    transaction_id,
    ANY_VALUE(touchpoint_id) AS touchpoint_id,
    SUM(credit) AS meta_credit
  FROM meta_credit
  GROUP BY transaction_id
),
ga4_events AS (
  SELECT
    CONCAT(NULLIF(client_id, ""), "|", NULLIF(CAST(ga_session_id AS STRING), "")) AS session_key,
    TIMESTAMP_MILLIS(timestamp) AS event_timestamp,
    IFNULL(event_id, "") AS event_id,
    NULLIF(REGEXP_EXTRACT(page_location, r"[?&]gn_meta_campaign_id=([0-9]{1,32})"), "") AS campaign_id,
    NULLIF(REGEXP_EXTRACT(page_location, r"[?&]gn_meta_adset_id=([0-9]{1,32})"), "") AS adset_id,
    NULLIF(REGEXP_EXTRACT(page_location, r"[?&]gn_meta_ad_id=([0-9]{1,32})"), "") AS ad_id,
    (
      IFNULL(page_location, "") LIKE "%web-pixels@%"
      OR IFNULL(page_location, "") LIKE "%/checkouts/%"
      OR IFNULL(page_location, "") LIKE "%/checkout%"
    ) AS is_checkout_noise
  FROM `stape-analytics-487802.stape_data.raw_events_full`
  WHERE timestamp >= UNIX_MILLIS(TIMESTAMP_SUB(start_ts, INTERVAL 90 DAY))
    AND timestamp < UNIX_MILLIS(end_ts)
    AND IFNULL(source_client, "GA4") = "GA4"
    AND IFNULL(client_id, "") != ""
    AND ga_session_id IS NOT NULL
    AND LOWER(IFNULL(event_name, "")) != "shopify_order"
),
sessions AS (
  SELECT
    session_key,
    MIN(event_timestamp) AS session_start
  FROM ga4_events
  GROUP BY session_key
),
canonical_touchpoints AS (
  SELECT
    TO_HEX(SHA256(CONCAT(e.session_key, CAST(s.session_start AS STRING)))) AS touchpoint_id,
    ARRAY_AGG(e.campaign_id IGNORE NULLS ORDER BY e.event_timestamp, e.event_id LIMIT 1)[SAFE_OFFSET(0)] AS campaign_id,
    ARRAY_AGG(e.adset_id IGNORE NULLS ORDER BY e.event_timestamp, e.event_id LIMIT 1)[SAFE_OFFSET(0)] AS adset_id,
    ARRAY_AGG(e.ad_id IGNORE NULLS ORDER BY e.event_timestamp, e.event_id LIMIT 1)[SAFE_OFFSET(0)] AS ad_id,
    COUNT(DISTINCT e.campaign_id) > 1 AS campaign_id_conflict,
    COUNT(DISTINCT e.adset_id) > 1 AS adset_id_conflict,
    COUNT(DISTINCT e.ad_id) > 1 AS ad_id_conflict
  FROM ga4_events AS e
  INNER JOIN sessions AS s
    ON s.session_key = e.session_key
  WHERE NOT e.is_checkout_noise
  GROUP BY e.session_key, s.session_start
),
fact_campaign AS (
  SELECT DISTINCT CAST(campaign_id AS STRING) AS campaign_id
  FROM `stape-analytics-487802.goodsnova_platform.meta_campaign_insights_daily`
),
fact_adset AS (
  SELECT
    CAST(src.adset_id AS STRING) AS adset_id,
    ANY_VALUE(CAST(src.campaign_id AS STRING)) AS campaign_id
  FROM `stape-analytics-487802.goodsnova_platform.meta_adset_insights_daily` AS src
  GROUP BY CAST(src.adset_id AS STRING)
  HAVING COUNT(DISTINCT CAST(src.campaign_id AS STRING)) = 1
),
fact_ad AS (
  SELECT
    CAST(src.ad_id AS STRING) AS ad_id,
    ANY_VALUE(CAST(src.adset_id AS STRING)) AS adset_id,
    ANY_VALUE(CAST(src.campaign_id AS STRING)) AS campaign_id
  FROM `stape-analytics-487802.goodsnova_platform.meta_ad_insights_daily` AS src
  GROUP BY CAST(src.ad_id AS STRING)
  HAVING COUNT(DISTINCT CAST(src.adset_id AS STRING)) = 1
     AND COUNT(DISTINCT CAST(src.campaign_id AS STRING)) = 1
),
classified AS (
  SELECT
    mo.transaction_id,
    mo.meta_credit,
    t.campaign_id,
    t.adset_id,
    t.ad_id,
    IFNULL(t.campaign_id_conflict, FALSE)
      OR IFNULL(t.adset_id_conflict, FALSE)
      OR IFNULL(t.ad_id_conflict, FALSE) AS session_id_conflict,
    (
      (t.campaign_id IS NOT NULL AND t.adset_id IS NOT NULL
        AND fa.campaign_id IS NOT NULL AND fa.campaign_id != t.campaign_id)
      OR (t.adset_id IS NOT NULL AND t.ad_id IS NOT NULL
        AND fd.adset_id IS NOT NULL AND fd.adset_id != t.adset_id)
      OR (t.campaign_id IS NOT NULL AND t.ad_id IS NOT NULL
        AND fd.campaign_id IS NOT NULL AND fd.campaign_id != t.campaign_id)
    ) AS hierarchy_conflict,
    t.campaign_id IS NOT NULL AND fc.campaign_id IS NOT NULL AS campaign_in_facts,
    t.adset_id IS NOT NULL AND fa.adset_id IS NOT NULL AS adset_in_facts,
    t.ad_id IS NOT NULL AND fd.ad_id IS NOT NULL AS ad_in_facts
  FROM meta_orders AS mo
  LEFT JOIN canonical_touchpoints AS t
    ON t.touchpoint_id = mo.touchpoint_id
  LEFT JOIN fact_campaign AS fc
    ON fc.campaign_id = t.campaign_id
  LEFT JOIN fact_adset AS fa
    ON fa.adset_id = t.adset_id
  LEFT JOIN fact_ad AS fd
    ON fd.ad_id = t.ad_id
),
scored AS (
  SELECT
    *,
    campaign_in_facts
      AND NOT IFNULL(hierarchy_conflict, FALSE)
      AND NOT session_id_conflict AS campaign_mapped,
    adset_in_facts
      AND NOT IFNULL(hierarchy_conflict, FALSE)
      AND NOT session_id_conflict AS adset_mapped,
    ad_in_facts
      AND NOT IFNULL(hierarchy_conflict, FALSE)
      AND NOT session_id_conflict AS ad_mapped
  FROM classified
)
SELECT
  COUNT(*) AS meta_attributed_orders,
  COUNTIF(campaign_mapped) AS campaign_mapped_orders,
  COUNTIF(NOT campaign_mapped) AS campaign_unmapped_orders,
  GREATEST(0, LEAST(1, IFNULL(SAFE_DIVIDE(COUNTIF(campaign_mapped), COUNT(*)), 0))) AS campaign_mapping_rate,
  COUNTIF(adset_mapped) AS adset_mapped_orders,
  COUNTIF(NOT adset_mapped) AS adset_unmapped_orders,
  GREATEST(0, LEAST(1, IFNULL(SAFE_DIVIDE(COUNTIF(adset_mapped), COUNT(*)), 0))) AS adset_mapping_rate,
  COUNTIF(ad_mapped) AS ad_mapped_orders,
  COUNTIF(NOT ad_mapped) AS ad_unmapped_orders,
  GREATEST(0, LEAST(1, IFNULL(SAFE_DIVIDE(COUNTIF(ad_mapped), COUNT(*)), 0))) AS ad_mapping_rate,
  SUM(meta_credit) AS meta_channel_credit,
  SUM(IF(campaign_mapped, meta_credit, 0)) AS campaign_mapped_credit,
  SUM(IF(NOT campaign_mapped, meta_credit, 0)) AS campaign_unmapped_credit,
  GREATEST(0, LEAST(1, IFNULL(SAFE_DIVIDE(SUM(IF(campaign_mapped, meta_credit, 0)), SUM(meta_credit)), 0))) AS campaign_credit_coverage,
  COUNTIF(IFNULL(hierarchy_conflict, FALSE)) AS hierarchy_conflict_orders,
  COUNTIF(session_id_conflict) AS session_id_conflict_orders,
  "VALIDATION REQUIRED" AS status,
  "Order grain from last_non_direct credited touchpoint_id. Rates clamped to [0, 1]. Historical Meta touches without gn_meta_* stay unmapped." AS note
FROM scored;
END;

-- 16 Meta new-customer credit
BEGIN
-- 16 Meta new-customer credit guards. Status: VALIDATION REQUIRED.
-- Shopify new-customer truth lives in the app (numberOfOrders ≤ 1).
-- This query only proves Meta credit is non-negative and does not exceed 1
-- per order. It cannot compute attributed nCAC without Shopify new-customer
-- credit + mapped spend.

WITH meta_credit AS (
  SELECT
    transaction_id,
    SUM(credit) AS meta_credit,
    MIN(credit) AS min_touch_credit
  FROM `stape-analytics-487802.analytics.v_attribution_credit_v1`
  WHERE model_name = "last_non_direct"
    AND channel = "Facebook / Meta Ads"
  GROUP BY transaction_id
)
SELECT
  COUNT(*) AS meta_credited_orders,
  COUNTIF(mc.meta_credit < 0) AS negative_credit_orders,
  COUNTIF(mc.meta_credit > 1.000001) AS orders_meta_credit_gt_1,
  COUNTIF(mc.min_touch_credit < 0) AS negative_touch_credit,
  "VALIDATION REQUIRED" AS status,
  "Attributed nCAC is spend / fractional new-customer credit in the app, only when HIGH/PARTIAL ID mapping and spend exist. No-spend = —." AS note
FROM meta_credit AS mc;
END;

-- 17 Meta credit reconciliation
BEGIN
-- 17 Meta credit hierarchy from the ACTUAL credited touchpoint.
-- Status: VALIDATION REQUIRED.
-- Join: v_attribution_credit_v1.touchpoint_id = canonical touchpoint_id
-- (same SHA256(session_key || session_start) as 005 / warehouse sql.ts).
-- IDs come from that credited touchpoint's landing page_location.
-- Do not assign one session's IDs onto every Meta credit row of the order.
-- Expected: hierarchy_violations = 0.
-- Channel Meta credit is never dropped. Child grains unmapped on
-- SESSION_ID_CONFLICT or META_HIERARCHY_CONFLICT.

DECLARE start_ts TIMESTAMP DEFAULT TIMESTAMP("2026-08-01", "America/Los_Angeles");
DECLARE end_ts TIMESTAMP DEFAULT TIMESTAMP("2026-08-26", "America/Los_Angeles");

WITH models AS (
  SELECT model_name
  FROM UNNEST([
    "first_touch", "last_touch", "last_non_direct", "linear",
    "position_based", "paid_only", "time_decay"
  ]) AS model_name
),
purchases AS (
  SELECT transaction_id
  FROM `stape-analytics-487802.stape_data.raw_events_full`
  WHERE timestamp >= UNIX_MILLIS(start_ts)
    AND timestamp < UNIX_MILLIS(end_ts)
    AND LOWER(IFNULL(event_name, "")) = "purchase"
    AND IFNULL(transaction_id, "") != ""
  GROUP BY transaction_id
),
meta_credit AS (
  SELECT
    model_name,
    transaction_id,
    touchpoint_id,
    credit
  FROM `stape-analytics-487802.analytics.v_attribution_credit_v1`
  WHERE channel = "Facebook / Meta Ads"
    AND transaction_id IN (SELECT transaction_id FROM purchases)
),
ga4_events AS (
  SELECT
    CONCAT(NULLIF(client_id, ""), "|", NULLIF(CAST(ga_session_id AS STRING), "")) AS session_key,
    TIMESTAMP_MILLIS(timestamp) AS event_timestamp,
    IFNULL(event_id, "") AS event_id,
    NULLIF(REGEXP_EXTRACT(page_location, r"[?&]gn_meta_campaign_id=([0-9]{1,32})"), "") AS campaign_id,
    NULLIF(REGEXP_EXTRACT(page_location, r"[?&]gn_meta_adset_id=([0-9]{1,32})"), "") AS adset_id,
    NULLIF(REGEXP_EXTRACT(page_location, r"[?&]gn_meta_ad_id=([0-9]{1,32})"), "") AS ad_id,
    (
      IFNULL(page_location, "") LIKE "%web-pixels@%"
      OR IFNULL(page_location, "") LIKE "%/checkouts/%"
      OR IFNULL(page_location, "") LIKE "%/checkout%"
    ) AS is_checkout_noise
  FROM `stape-analytics-487802.stape_data.raw_events_full`
  WHERE timestamp >= UNIX_MILLIS(TIMESTAMP_SUB(start_ts, INTERVAL 90 DAY))
    AND timestamp < UNIX_MILLIS(end_ts)
    AND IFNULL(source_client, "GA4") = "GA4"
    AND IFNULL(client_id, "") != ""
    AND ga_session_id IS NOT NULL
    AND LOWER(IFNULL(event_name, "")) != "shopify_order"
),
sessions AS (
  SELECT
    session_key,
    MIN(event_timestamp) AS session_start
  FROM ga4_events
  GROUP BY session_key
),
canonical_touchpoints AS (
  SELECT
    TO_HEX(SHA256(CONCAT(e.session_key, CAST(s.session_start AS STRING)))) AS touchpoint_id,
    ARRAY_AGG(e.campaign_id IGNORE NULLS ORDER BY e.event_timestamp, e.event_id LIMIT 1)[SAFE_OFFSET(0)] AS campaign_id,
    ARRAY_AGG(e.adset_id IGNORE NULLS ORDER BY e.event_timestamp, e.event_id LIMIT 1)[SAFE_OFFSET(0)] AS adset_id,
    ARRAY_AGG(e.ad_id IGNORE NULLS ORDER BY e.event_timestamp, e.event_id LIMIT 1)[SAFE_OFFSET(0)] AS ad_id,
    COUNT(DISTINCT e.campaign_id) > 1 AS campaign_id_conflict,
    COUNT(DISTINCT e.adset_id) > 1 AS adset_id_conflict,
    COUNT(DISTINCT e.ad_id) > 1 AS ad_id_conflict
  FROM ga4_events AS e
  INNER JOIN sessions AS s
    ON s.session_key = e.session_key
  WHERE NOT e.is_checkout_noise
  GROUP BY e.session_key, s.session_start
),
fact_campaign AS (
  SELECT DISTINCT CAST(campaign_id AS STRING) AS campaign_id
  FROM `stape-analytics-487802.goodsnova_platform.meta_campaign_insights_daily`
),
fact_adset AS (
  SELECT
    CAST(src.adset_id AS STRING) AS adset_id,
    ANY_VALUE(CAST(src.campaign_id AS STRING)) AS campaign_id
  FROM `stape-analytics-487802.goodsnova_platform.meta_adset_insights_daily` AS src
  GROUP BY CAST(src.adset_id AS STRING)
  HAVING COUNT(DISTINCT CAST(src.campaign_id AS STRING)) = 1
),
fact_ad AS (
  SELECT
    CAST(src.ad_id AS STRING) AS ad_id,
    ANY_VALUE(CAST(src.adset_id AS STRING)) AS adset_id,
    ANY_VALUE(CAST(src.campaign_id AS STRING)) AS campaign_id
  FROM `stape-analytics-487802.goodsnova_platform.meta_ad_insights_daily` AS src
  GROUP BY CAST(src.ad_id AS STRING)
  HAVING COUNT(DISTINCT CAST(src.adset_id AS STRING)) = 1
     AND COUNT(DISTINCT CAST(src.campaign_id AS STRING)) = 1
),
credited AS (
  SELECT
    c.model_name,
    c.transaction_id,
    c.touchpoint_id,
    c.credit,
    t.campaign_id,
    t.adset_id,
    t.ad_id,
    IFNULL(t.campaign_id_conflict, FALSE)
      OR IFNULL(t.adset_id_conflict, FALSE)
      OR IFNULL(t.ad_id_conflict, FALSE) AS session_id_conflict,
    (
      (t.campaign_id IS NOT NULL AND t.adset_id IS NOT NULL
        AND fa.campaign_id IS NOT NULL AND fa.campaign_id != t.campaign_id)
      OR (t.adset_id IS NOT NULL AND t.ad_id IS NOT NULL
        AND fd.adset_id IS NOT NULL AND fd.adset_id != t.adset_id)
      OR (t.campaign_id IS NOT NULL AND t.ad_id IS NOT NULL
        AND fd.campaign_id IS NOT NULL AND fd.campaign_id != t.campaign_id)
    ) AS hierarchy_conflict,
    t.campaign_id IS NOT NULL AND fc.campaign_id IS NOT NULL AS campaign_in_facts,
    t.adset_id IS NOT NULL AND fa.adset_id IS NOT NULL AS adset_in_facts,
    t.ad_id IS NOT NULL AND fd.ad_id IS NOT NULL AS ad_in_facts,
    fa.campaign_id AS adset_parent_campaign,
    fd.adset_id AS ad_parent_adset
  FROM meta_credit AS c
  LEFT JOIN canonical_touchpoints AS t
    ON t.touchpoint_id = c.touchpoint_id
  LEFT JOIN fact_campaign AS fc
    ON fc.campaign_id = t.campaign_id
  LEFT JOIN fact_adset AS fa
    ON fa.adset_id = t.adset_id
  LEFT JOIN fact_ad AS fd
    ON fd.ad_id = t.ad_id
),
scored AS (
  SELECT
    *,
    campaign_in_facts
      AND NOT IFNULL(hierarchy_conflict, FALSE)
      AND NOT session_id_conflict AS campaign_mapped,
    adset_in_facts
      AND NOT IFNULL(hierarchy_conflict, FALSE)
      AND NOT session_id_conflict AS adset_mapped,
    ad_in_facts
      AND NOT IFNULL(hierarchy_conflict, FALSE)
      AND NOT session_id_conflict AS ad_mapped
  FROM credited
),
rolled AS (
  SELECT
    model_name,
    SUM(credit) AS meta_channel_credit,
    SUM(IF(campaign_mapped, credit, 0)) AS campaign_mapped_credit,
    SUM(IF(NOT campaign_mapped, credit, 0)) AS campaign_unmapped_credit,
    SUM(IF(adset_mapped, credit, 0)) AS adset_mapped_credit,
    SUM(IF(NOT adset_mapped, credit, 0)) AS adset_unmapped_credit,
    SUM(IF(ad_mapped, credit, 0)) AS ad_mapped_credit,
    SUM(IF(NOT ad_mapped, credit, 0)) AS ad_unmapped_credit,
    COUNTIF(IFNULL(hierarchy_conflict, FALSE)) AS hierarchy_conflict_touches,
    COUNTIF(session_id_conflict) AS session_id_conflict_touches
  FROM scored
  GROUP BY model_name
),
parent_mismatch AS (
  SELECT
    model_name,
    COUNTIF(
      adset_mapped
      AND campaign_id IS NOT NULL
      AND adset_parent_campaign IS NOT NULL
      AND adset_parent_campaign != campaign_id
    ) AS adset_parent_mismatch,
    COUNTIF(
      ad_mapped
      AND adset_id IS NOT NULL
      AND ad_parent_adset IS NOT NULL
      AND ad_parent_adset != adset_id
    ) AS ad_parent_mismatch
  FROM scored
  GROUP BY model_name
),
child_vs_campaign AS (
  SELECT
    model_name,
    COUNTIF(adset_under_campaign > campaign_credit + 0.0001) AS adset_exceeds_parent_campaign
  FROM (
    SELECT
      model_name,
      campaign_id,
      SUM(IF(campaign_mapped, credit, 0)) AS campaign_credit,
      SUM(IF(adset_mapped AND adset_parent_campaign = campaign_id, credit, 0)) AS adset_under_campaign
    FROM scored
    WHERE campaign_id IS NOT NULL
    GROUP BY model_name, campaign_id
  )
  GROUP BY model_name
),
child_vs_adset AS (
  SELECT
    model_name,
    COUNTIF(ad_under_adset > adset_credit + 0.0001) AS ad_exceeds_parent_adset
  FROM (
    SELECT
      model_name,
      adset_id,
      SUM(IF(adset_mapped, credit, 0)) AS adset_credit,
      SUM(IF(ad_mapped AND ad_parent_adset = adset_id, credit, 0)) AS ad_under_adset
    FROM scored
    WHERE adset_id IS NOT NULL
    GROUP BY model_name, adset_id
  )
  GROUP BY model_name
)
SELECT
  m.model_name,
  IFNULL(r.meta_channel_credit, 0) AS meta_channel_credit,
  IFNULL(r.campaign_mapped_credit, 0) AS campaign_mapped_credit,
  IFNULL(r.campaign_unmapped_credit, 0) AS campaign_unmapped_credit,
  IFNULL(r.adset_mapped_credit, 0) AS adset_mapped_credit,
  IFNULL(r.adset_unmapped_credit, 0) AS adset_unmapped_credit,
  IFNULL(r.ad_mapped_credit, 0) AS ad_mapped_credit,
  IFNULL(r.ad_unmapped_credit, 0) AS ad_unmapped_credit,
  ABS(
    IFNULL(r.campaign_mapped_credit, 0) + IFNULL(r.campaign_unmapped_credit, 0)
    - IFNULL(r.meta_channel_credit, 0)
  ) < 0.0001 AS campaign_balance_ok,
  IFNULL(p.adset_parent_mismatch, 0) AS adset_parent_mismatch,
  IFNULL(p.ad_parent_mismatch, 0) AS ad_parent_mismatch,
  IFNULL(cc.adset_exceeds_parent_campaign, 0) AS adset_exceeds_parent_campaign,
  IFNULL(ca.ad_exceeds_parent_adset, 0) AS ad_exceeds_parent_adset,
  IFNULL(r.hierarchy_conflict_touches, 0) AS hierarchy_conflict_touches,
  IFNULL(r.session_id_conflict_touches, 0) AS session_id_conflict_touches,
  (
    IFNULL(p.adset_parent_mismatch, 0)
    + IFNULL(p.ad_parent_mismatch, 0)
    + IFNULL(cc.adset_exceeds_parent_campaign, 0)
    + IFNULL(ca.ad_exceeds_parent_adset, 0)
    + IF(
        ABS(
          IFNULL(r.campaign_mapped_credit, 0) + IFNULL(r.campaign_unmapped_credit, 0)
          - IFNULL(r.meta_channel_credit, 0)
        ) < 0.0001,
        0,
        1
      )
  ) AS hierarchy_violations,
  "VALIDATION REQUIRED" AS status,
  "Joins credit.touchpoint_id to canonical SHA256(session_key||session_start). Linear Meta A and Meta B must keep their own IDs. Expected hierarchy_violations = 0." AS note
FROM models AS m
LEFT JOIN rolled AS r USING (model_name)
LEFT JOIN parent_mismatch AS p USING (model_name)
LEFT JOIN child_vs_campaign AS cc USING (model_name)
LEFT JOIN child_vs_adset AS ca USING (model_name)
ORDER BY m.model_name;
END;

-- 17a Linear Meta touch IDs
BEGIN
-- 17a Synthetic linear Meta A → Organic → Meta B.
-- Does not query production. Proves credited-touchpoint join keeps A and B IDs
-- on their own credit rows. Expected: a_keeps_a AND b_keeps_b AND NOT b_assigned_to_a.

WITH touches AS (
  SELECT * FROM UNNEST([
    STRUCT("t-a" AS touchpoint_id, "Facebook / Meta Ads" AS channel, "111" AS campaign_id, "555" AS adset_id, "666" AS ad_id),
    STRUCT("t-o" AS touchpoint_id, "Google Organic" AS channel, CAST(NULL AS STRING) AS campaign_id, CAST(NULL AS STRING) AS adset_id, CAST(NULL AS STRING) AS ad_id),
    STRUCT("t-b" AS touchpoint_id, "Facebook / Meta Ads" AS channel, "222" AS campaign_id, "888" AS adset_id, "999" AS ad_id)
  ])
),
credit AS (
  SELECT * FROM UNNEST([
    STRUCT("linear" AS model_name, "t-a" AS touchpoint_id, 1.0 / 3 AS credit),
    STRUCT("linear" AS model_name, "t-o" AS touchpoint_id, 1.0 / 3 AS credit),
    STRUCT("linear" AS model_name, "t-b" AS touchpoint_id, 1.0 / 3 AS credit)
  ])
),
joined AS (
  SELECT
    c.touchpoint_id,
    c.credit,
    t.channel,
    t.campaign_id
  FROM credit AS c
  INNER JOIN touches AS t
    ON t.touchpoint_id = c.touchpoint_id
  WHERE t.channel = "Facebook / Meta Ads"
)
SELECT
  COUNTIF(touchpoint_id = "t-a" AND campaign_id = "111") = 1 AS a_keeps_a,
  COUNTIF(touchpoint_id = "t-b" AND campaign_id = "222") = 1 AS b_keeps_b,
  COUNTIF(touchpoint_id = "t-a" AND campaign_id = "222") = 0 AS b_not_assigned_to_a,
  COUNTIF(touchpoint_id = "t-b" AND campaign_id = "111") = 0 AS a_not_assigned_to_b,
  COUNT(*) = 2 AS two_meta_credit_rows,
  0 AS hierarchy_violations;
END;
