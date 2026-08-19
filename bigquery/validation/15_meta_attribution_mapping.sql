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
    CAST(adset_id AS STRING) AS adset_id,
    ANY_VALUE(CAST(campaign_id AS STRING)) AS campaign_id
  FROM `stape-analytics-487802.goodsnova_platform.meta_adset_insights_daily`
  GROUP BY 1
  HAVING COUNT(DISTINCT CAST(campaign_id AS STRING)) = 1
),
fact_ad AS (
  SELECT
    CAST(ad_id AS STRING) AS ad_id,
    ANY_VALUE(CAST(adset_id AS STRING)) AS adset_id,
    ANY_VALUE(CAST(campaign_id AS STRING)) AS campaign_id
  FROM `stape-analytics-487802.goodsnova_platform.meta_ad_insights_daily`
  GROUP BY 1
  HAVING COUNT(DISTINCT CAST(adset_id AS STRING)) = 1
     AND COUNT(DISTINCT CAST(campaign_id AS STRING)) = 1
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
