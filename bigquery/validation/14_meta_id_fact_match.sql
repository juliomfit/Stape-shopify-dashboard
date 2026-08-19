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
