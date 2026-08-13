-- Meaningful acquisition touches only (not every page_view).

CREATE OR REPLACE VIEW `stape-analytics-487802.analytics.fct_touchpoints` AS
WITH session_touches AS (
  SELECT
    TO_HEX(SHA256(CONCAT(session_key, CAST(session_start AS STRING)))) AS touchpoint_id,
    person_id,
    session_key,
    session_start AS touchpoint_timestamp,
    first_source AS source,
    first_medium AS medium,
    first_campaign AS campaign,
    CAST(NULL AS STRING) AS content,
    CAST(NULL AS STRING) AS term,
    channel,
    channel_group,
    CASE
      WHEN gclid IS NOT NULL THEN "gclid"
      WHEN gbraid IS NOT NULL THEN "gbraid"
      WHEN wbraid IS NOT NULL THEN "wbraid"
      WHEN fbclid IS NOT NULL THEN "fbclid"
      WHEN msclkid IS NOT NULL THEN "msclkid"
      WHEN ttclid IS NOT NULL THEN "ttclid"
      ELSE NULL
    END AS click_id_type,
    COALESCE(gclid, gbraid, wbraid, fbclid, msclkid, ttclid) AS click_id,
    landing_page,
    initial_referrer AS referrer,
    is_paid,
    is_direct,
    identity_method,
    identity_confidence
  FROM `stape-analytics-487802.analytics.fct_sessions`
)
SELECT *
FROM session_touches
WHERE is_paid
   OR NOT is_direct
   OR click_id IS NOT NULL
   OR IFNULL(source, "") != ""
   OR IFNULL(campaign, "") != "";
