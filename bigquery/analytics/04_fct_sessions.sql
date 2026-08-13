-- GA4 sessions use ga_session_id. Data Client has none; those events are not
-- sessionized here to avoid double-counting the duplicate pixel.

CREATE OR REPLACE VIEW `stape-analytics-487802.analytics.fct_sessions` AS
WITH browse AS (
  SELECT
    e.*,
    p.person_id,
    p.identity_method,
    p.identity_confidence
  FROM `stape-analytics-487802.analytics.v_channel_classified_enriched` AS e
  LEFT JOIN `stape-analytics-487802.analytics.dim_person` AS p
    ON p.client_id = e.client_id
  WHERE IFNULL(e.source_client, "GA4") = "GA4"
    AND e.event_name IS NOT NULL
    AND LOWER(e.event_name) != "shopify_order"
    AND e.client_id IS NOT NULL
    AND e.ga_session_id IS NOT NULL
),
ranked AS (
  SELECT
    *,
    CONCAT(client_id, "|", ga_session_id) AS session_key,
    ROW_NUMBER() OVER (PARTITION BY client_id, ga_session_id ORDER BY event_timestamp) AS event_seq
  FROM browse
)
SELECT
  session_key,
  ANY_VALUE(person_id) AS person_id,
  ANY_VALUE(client_id) AS ga_client_id,
  ANY_VALUE(ga_session_id) AS ga_session_id,
  ANY_VALUE(stape_user_id) AS stape_user_id,
  ANY_VALUE(gn_uid) AS gn_uid,
  MIN(event_timestamp) AS session_start,
  MAX(event_timestamp) AS session_end,
  ANY_VALUE(ga_session_number) AS session_number,
  ARRAY_AGG(page_location IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS landing_page,
  ARRAY_AGG(page_path IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS landing_path,
  ARRAY_AGG(page_referrer IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS initial_referrer,
  ARRAY_AGG(raw_source IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS first_source,
  ARRAY_AGG(raw_medium IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS first_medium,
  ARRAY_AGG(raw_campaign IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS first_campaign,
  ARRAY_AGG(gclid IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS gclid,
  ARRAY_AGG(gbraid IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS gbraid,
  ARRAY_AGG(wbraid IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS wbraid,
  ARRAY_AGG(fbclid IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS fbclid,
  ARRAY_AGG(msclkid IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS msclkid,
  ARRAY_AGG(ttclid IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS ttclid,
  ARRAY_AGG(channel IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS channel,
  ARRAY_AGG(channel_group IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS channel_group,
  ARRAY_AGG(is_paid IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS is_paid,
  ARRAY_AGG(is_direct IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS is_direct,
  CAST(NULL AS STRING) AS fb_first_click,
  CAST(NULL AS STRING) AS google_first_click,
  COUNT(*) AS events,
  ANY_VALUE(identity_method) AS identity_method,
  ANY_VALUE(identity_confidence) AS identity_confidence
FROM ranked
GROUP BY session_key;
