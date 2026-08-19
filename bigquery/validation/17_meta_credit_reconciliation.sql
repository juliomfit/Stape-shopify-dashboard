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
