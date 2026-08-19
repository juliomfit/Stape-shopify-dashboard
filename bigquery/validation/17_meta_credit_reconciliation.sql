-- 17 Meta credit reconciliation. Status: VALIDATION REQUIRED.
-- Child mapped credit must not exceed parent. Exact equality only when
-- mapping coverage is 100%. Unmapped Meta is kept, not dropped.
-- Credit view (005) is channel + utm campaign only. Until gn_meta_* IDs
-- exist, campaign/adset/ad mapped credit is expected to be 0 and unmapped
-- equals Meta channel credit.

WITH models AS (
  SELECT model_name
  FROM UNNEST([
    "first_touch", "last_touch", "last_non_direct", "linear",
    "position_based", "paid_only", "time_decay"
  ]) AS model_name
),
channel AS (
  SELECT
    model_name,
    SUM(credit) AS meta_channel_credit
  FROM `stape-analytics-487802.analytics.v_attribution_credit_v1`
  WHERE channel = "Facebook / Meta Ads"
  GROUP BY model_name
),
url_ids AS (
  SELECT
    COUNTIF(REGEXP_EXTRACT(page_location, r"[?&]gn_meta_campaign_id=([0-9]{1,32})") IS NOT NULL) AS campaign_id_events,
    COUNTIF(REGEXP_EXTRACT(page_location, r"[?&]gn_meta_adset_id=([0-9]{1,32})") IS NOT NULL) AS adset_id_events,
    COUNTIF(REGEXP_EXTRACT(page_location, r"[?&]gn_meta_ad_id=([0-9]{1,32})") IS NOT NULL) AS ad_id_events
  FROM `stape-analytics-487802.stape_data.raw_events_full`
)
SELECT
  m.model_name,
  IFNULL(c.meta_channel_credit, 0) AS meta_channel_credit,
  IF((SELECT campaign_id_events FROM url_ids) = 0, 0, NULL) AS campaign_mapped_credit_sql_unknown_until_ids,
  IFNULL(c.meta_channel_credit, 0) AS unmapped_meta_credit_if_no_ids,
  IFNULL(c.meta_channel_credit, 0) >= 0 AS channel_credit_non_negative,
  "VALIDATION REQUIRED" AS status,
  "App enforces campaign_mapped + unmapped = channel, adset_mapped <= channel, ad_mapped <= channel. Do not treat unmapped as missing money." AS note
FROM models AS m
LEFT JOIN channel AS c USING (model_name)
ORDER BY m.model_name;
