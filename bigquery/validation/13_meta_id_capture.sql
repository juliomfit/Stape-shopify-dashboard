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
