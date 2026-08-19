-- 05 Meta campaign mapping coverage (touch grain, after migration 005).
-- Status: VALIDATION REQUIRED. Do not invent a live UI %.
-- Does NOT claim ad-set / ad / creative OUR mapping — those IDs are not on
-- first-party journey touches.

DECLARE start_ts TIMESTAMP DEFAULT TIMESTAMP("2026-08-01", "America/Los_Angeles");
DECLARE end_ts TIMESTAMP DEFAULT TIMESTAMP("2026-08-19", "America/Los_Angeles");

WITH purchases AS (
  SELECT DISTINCT transaction_id
  FROM `stape-analytics-487802.stape_data.raw_events_full`
  WHERE timestamp >= UNIX_MILLIS(start_ts)
    AND timestamp < UNIX_MILLIS(end_ts)
    AND LOWER(IFNULL(event_name, "")) = "purchase"
    AND IFNULL(transaction_id, "") != ""
),
meta_touches AS (
  SELECT
    transaction_id,
    touchpoint_id,
    campaign,
    channel
  FROM `stape-analytics-487802.analytics.v_attribution_credit_v1`
  WHERE model_name = "linear"
    AND channel = "Facebook / Meta Ads"
    AND transaction_id IN (SELECT transaction_id FROM purchases)
),
meta_campaigns AS (
  SELECT
    CAST(campaign_id AS STRING) AS campaign_id,
    campaign_name,
    LOWER(TRIM(campaign_name)) AS name_norm
  FROM `stape-analytics-487802.goodsnova_platform.meta_campaign_insights_daily`
  WHERE date >= DATE(start_ts, "America/Los_Angeles")
    AND date < DATE(end_ts, "America/Los_Angeles")
  GROUP BY 1, 2, 3
),
name_counts AS (
  SELECT name_norm, COUNT(DISTINCT campaign_id) AS id_n
  FROM meta_campaigns
  GROUP BY 1
),
mapped AS (
  SELECT
    t.transaction_id,
    t.touchpoint_id,
    t.campaign AS our_campaign,
    CASE
      WHEN t.campaign IS NULL OR TRIM(t.campaign) = "" THEN "unmapped"
      WHEN EXISTS (
        SELECT 1 FROM meta_campaigns m WHERE m.campaign_id = t.campaign
      ) THEN "campaign_id_exact"
      WHEN (
        SELECT id_n FROM name_counts n
        WHERE n.name_norm = LOWER(TRIM(t.campaign))
      ) > 1 THEN "ambiguous_name"
      WHEN EXISTS (
        SELECT 1 FROM meta_campaigns m
        WHERE m.name_norm = LOWER(TRIM(t.campaign))
      ) THEN "campaign_name_exact_unique"
      ELSE "unmapped"
    END AS mapping_method
  FROM meta_touches AS t
)
SELECT
  (SELECT COUNT(*) FROM purchases) AS tracked_orders_in_window,
  (SELECT COUNT(DISTINCT transaction_id) FROM meta_touches) AS our_meta_attributed_orders,
  (SELECT COUNT(*) FROM meta_touches) AS our_meta_touches,
  COUNTIF(mapping_method = "campaign_id_exact") AS exact_campaign_id_mapped,
  COUNTIF(mapping_method = "campaign_name_exact_unique") AS unique_name_mapped,
  COUNTIF(mapping_method = "ambiguous_name") AS ambiguous_names,
  COUNTIF(mapping_method = "unmapped") AS unmapped,
  SAFE_DIVIDE(
    COUNTIF(mapping_method IN ("campaign_id_exact", "campaign_name_exact_unique")),
    COUNT(*)
  ) AS mapping_rate,
  (SELECT COUNT(DISTINCT campaign_id) FROM meta_campaigns) AS meta_campaign_ids_in_range,
  "VALIDATION REQUIRED" AS status,
  "Ad-set/ad/creative OUR attribution is NOT claimed — those IDs are not on first-party touches." AS grain_note
FROM mapped;
