-- 17 Meta credit hierarchy from canonical credit + fact parents.
-- Status: VALIDATION REQUIRED.
-- For each model: campaign_mapped + campaign_unmapped = Meta channel credit.
-- Adset credit must reconcile under its actual parent campaign.
-- Ad credit must reconcile under its actual parent adset.
-- Do not merely assert adset <= channel. Expected: 0 hierarchy violations.
-- Landing IDs from page_location. Conflicting hierarchy is not fully mapped.

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
  SELECT
    transaction_id,
    client_id,
    TIMESTAMP_MILLIS(timestamp) AS order_ts
  FROM `stape-analytics-487802.stape_data.raw_events_full`
  WHERE timestamp >= UNIX_MILLIS(start_ts)
    AND timestamp < UNIX_MILLIS(end_ts)
    AND LOWER(IFNULL(event_name, "")) = "purchase"
    AND IFNULL(transaction_id, "") != ""
    AND IFNULL(client_id, "") != ""
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY transaction_id
    ORDER BY
      CASE source_client WHEN "Data Client" THEN 0 WHEN "GA4" THEN 1 ELSE 2 END,
      timestamp,
      IFNULL(event_id, "")
  ) = 1
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
session_ids AS (
  SELECT
    CONCAT(client_id, "|", CAST(ga_session_id AS STRING)) AS session_key,
    client_id,
    MIN(TIMESTAMP_MILLIS(timestamp)) AS session_start,
    ARRAY_AGG(
      NULLIF(REGEXP_EXTRACT(page_location, r"[?&]gn_meta_campaign_id=([0-9]{1,32})"), "")
      IGNORE NULLS
      ORDER BY TIMESTAMP_MILLIS(timestamp), IFNULL(event_id, "")
      LIMIT 1
    )[SAFE_OFFSET(0)] AS campaign_id,
    ARRAY_AGG(
      NULLIF(REGEXP_EXTRACT(page_location, r"[?&]gn_meta_adset_id=([0-9]{1,32})"), "")
      IGNORE NULLS
      ORDER BY TIMESTAMP_MILLIS(timestamp), IFNULL(event_id, "")
      LIMIT 1
    )[SAFE_OFFSET(0)] AS adset_id,
    ARRAY_AGG(
      NULLIF(REGEXP_EXTRACT(page_location, r"[?&]gn_meta_ad_id=([0-9]{1,32})"), "")
      IGNORE NULLS
      ORDER BY TIMESTAMP_MILLIS(timestamp), IFNULL(event_id, "")
      LIMIT 1
    )[SAFE_OFFSET(0)] AS ad_id
  FROM `stape-analytics-487802.stape_data.raw_events_full`
  WHERE timestamp >= UNIX_MILLIS(TIMESTAMP_SUB(start_ts, INTERVAL 90 DAY))
    AND timestamp < UNIX_MILLIS(end_ts)
    AND IFNULL(source_client, "GA4") = "GA4"
    AND IFNULL(client_id, "") != ""
    AND ga_session_id IS NOT NULL
    AND LOWER(IFNULL(event_name, "")) != "shopify_order"
  GROUP BY session_key, client_id
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
order_session AS (
  SELECT
    p.transaction_id,
    s.campaign_id,
    s.adset_id,
    s.ad_id
  FROM purchases AS p
  LEFT JOIN session_ids AS s
    ON s.client_id = p.client_id
   AND s.session_start <= p.order_ts
   AND (
     s.campaign_id IS NOT NULL
     OR s.adset_id IS NOT NULL
     OR s.ad_id IS NOT NULL
   )
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY p.transaction_id
    ORDER BY s.session_start DESC, s.session_key DESC
  ) = 1
),
credited AS (
  SELECT
    c.model_name,
    c.transaction_id,
    c.touchpoint_id,
    c.credit,
    os.campaign_id,
    os.adset_id,
    os.ad_id,
    (
      (os.campaign_id IS NOT NULL AND os.adset_id IS NOT NULL
        AND fa.campaign_id IS NOT NULL AND fa.campaign_id != os.campaign_id)
      OR (os.adset_id IS NOT NULL AND os.ad_id IS NOT NULL
        AND fd.adset_id IS NOT NULL AND fd.adset_id != os.adset_id)
      OR (os.campaign_id IS NOT NULL AND os.ad_id IS NOT NULL
        AND fd.campaign_id IS NOT NULL AND fd.campaign_id != os.campaign_id)
    ) AS hierarchy_conflict,
    os.campaign_id IS NOT NULL AND fc.campaign_id IS NOT NULL AS campaign_in_facts,
    os.adset_id IS NOT NULL AND fa.adset_id IS NOT NULL AS adset_in_facts,
    os.ad_id IS NOT NULL AND fd.ad_id IS NOT NULL AS ad_in_facts,
    fa.campaign_id AS adset_parent_campaign,
    fd.adset_id AS ad_parent_adset
  FROM meta_credit AS c
  LEFT JOIN order_session AS os
    ON os.transaction_id = c.transaction_id
  LEFT JOIN fact_campaign AS fc
    ON fc.campaign_id = os.campaign_id
  LEFT JOIN fact_adset AS fa
    ON fa.adset_id = os.adset_id
  LEFT JOIN fact_ad AS fd
    ON fd.ad_id = os.ad_id
),
scored AS (
  SELECT
    *,
    campaign_in_facts AND NOT IFNULL(hierarchy_conflict, FALSE) AS campaign_mapped,
    adset_in_facts AND NOT IFNULL(hierarchy_conflict, FALSE) AS adset_mapped,
    ad_in_facts AND NOT IFNULL(hierarchy_conflict, FALSE) AS ad_mapped
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
    COUNTIF(IFNULL(hierarchy_conflict, FALSE)) AS hierarchy_conflict_touches
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
  "Expected hierarchy_violations = 0. App-side validateMetaCreditHierarchy is the same check on canonical credits." AS note
FROM models AS m
LEFT JOIN rolled AS r USING (model_name)
LEFT JOIN parent_mismatch AS p USING (model_name)
LEFT JOIN child_vs_campaign AS cc USING (model_name)
LEFT JOIN child_vs_adset AS ca USING (model_name)
ORDER BY m.model_name;
