-- 05 Meta campaign mapping coverage.
-- VALIDATION REQUIRED — do not quote a percentage in the UI until this runs.

DECLARE start_ms INT64 DEFAULT UNIX_MILLIS(TIMESTAMP("2026-08-01", "America/Los_Angeles"));
DECLARE end_ms INT64 DEFAULT UNIX_MILLIS(TIMESTAMP("2026-08-19", "America/Los_Angeles"));

WITH purchases AS (
  SELECT
    transaction_id,
    LOGICAL_OR(IFNULL(fbclid, "") != "" OR page_location LIKE "%fbclid=%") AS has_fbclid,
    LOGICAL_OR(REGEXP_CONTAINS(IFNULL(page_location, ""), r"[?&]utm_campaign=")) AS has_utm_campaign,
    LOGICAL_OR(IFNULL(utm_campaign, "") != "") AS has_utm_campaign_col,
    LOGICAL_OR(IFNULL(utm_content, "") != "") AS has_utm_content
  FROM `stape-analytics-487802.stape_data.raw_events_full`
  WHERE timestamp >= start_ms AND timestamp < end_ms
    AND LOWER(IFNULL(event_name, "")) = "purchase"
    AND IFNULL(transaction_id, "") != ""
  GROUP BY transaction_id
),
meta_campaigns AS (
  SELECT DISTINCT campaign_id, campaign_name
  FROM `stape-analytics-487802.goodsnova_platform.meta_campaign_insights_daily`
)
SELECT
  (SELECT COUNT(*) FROM purchases) AS purchase_orders,
  (SELECT COUNTIF(has_fbclid) FROM purchases) AS with_fbclid,
  (SELECT COUNTIF(has_utm_campaign OR has_utm_campaign_col) FROM purchases) AS with_utm_campaign,
  (SELECT COUNT(*) FROM meta_campaigns) AS meta_campaign_rows,
  "VALIDATION REQUIRED" AS campaign_mapping_coverage,
  "VALIDATION REQUIRED" AS adset_mapping_coverage,
  "VALIDATION REQUIRED" AS ad_mapping_coverage,
  "VALIDATION REQUIRED" AS creative_mapping_coverage;

-- The app must not display a live coverage % until Julio pastes results.
-- raw_events_full typically has utm_campaign / fbclid, not Meta campaign_id.
-- Matching is name/UTM equality in src/lib/attribution/campaign-map.ts.
