-- 15 Meta attribution mapping at canonical ORDER grain.
-- Status: VALIDATION REQUIRED.
-- Do not divide event counts by orders.
-- Channel Meta credit comes from v_attribution_credit_v1 (do not change 005).
-- Campaign/adset/ad IDs come from landing page_location gn_meta_* extracts
-- on the purchaser's last Meta-ID session before purchase (deterministic
-- ORDER BY session_start DESC, session_key DESC). Hierarchy conflicts are
-- not counted as fully mapped. Rates must stay in [0, 1].

DECLARE start_ts TIMESTAMP DEFAULT TIMESTAMP("2026-08-01", "America/Los_Angeles");
DECLARE end_ts TIMESTAMP DEFAULT TIMESTAMP("2026-08-26", "America/Los_Angeles");

WITH purchases AS (
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
    SUM(credit) AS meta_credit
  FROM meta_credit
  GROUP BY transaction_id
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
  INNER JOIN meta_orders AS mo
    ON mo.transaction_id = p.transaction_id
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
classified AS (
  SELECT
    mo.transaction_id,
    mo.meta_credit,
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
    os.ad_id IS NOT NULL AND fd.ad_id IS NOT NULL AS ad_in_facts
  FROM meta_orders AS mo
  LEFT JOIN order_session AS os
    ON os.transaction_id = mo.transaction_id
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
  FROM classified
)
SELECT
  COUNT(*) AS meta_attributed_orders,
  COUNTIF(campaign_mapped) AS campaign_mapped_orders,
  COUNTIF(NOT campaign_mapped) AS campaign_unmapped_orders,
  SAFE_DIVIDE(COUNTIF(campaign_mapped), COUNT(*)) AS campaign_mapping_rate,
  COUNTIF(adset_mapped) AS adset_mapped_orders,
  COUNTIF(NOT adset_mapped) AS adset_unmapped_orders,
  SAFE_DIVIDE(COUNTIF(adset_mapped), COUNT(*)) AS adset_mapping_rate,
  COUNTIF(ad_mapped) AS ad_mapped_orders,
  COUNTIF(NOT ad_mapped) AS ad_unmapped_orders,
  SAFE_DIVIDE(COUNTIF(ad_mapped), COUNT(*)) AS ad_mapping_rate,
  SUM(meta_credit) AS meta_channel_credit,
  SUM(IF(campaign_mapped, meta_credit, 0)) AS campaign_mapped_credit,
  SUM(IF(NOT campaign_mapped, meta_credit, 0)) AS campaign_unmapped_credit,
  SAFE_DIVIDE(SUM(IF(campaign_mapped, meta_credit, 0)), SUM(meta_credit)) AS campaign_credit_coverage,
  COUNTIF(IFNULL(hierarchy_conflict, FALSE)) AS hierarchy_conflict_orders,
  "VALIDATION REQUIRED" AS status,
  "Canonical dashboard mapping uses warehouse session grain. Historical Meta touches without gn_meta_* stay unmapped. Do not fabricate IDs." AS note
FROM scored;
