import { CHANNEL_SQL, INTERNAL_NOISE_SQL, PAID_CHANNELS } from "@/lib/stape/channel-sql";

/**
 * On-the-fly warehouse CTEs against raw_events_full.
 * Canonical grain: identity → GA4 session → one eligible acquisition touch.
 * Must match bigquery/migrations/2026_08_18_005_canonical_attribution_credit_fix.sql.
 * Channel CASE is CHANNEL_SQL; noise is INTERNAL_NOISE_SQL.
 */
export function warehouseCtes(rawTable: string) {
  const paidList = PAID_CHANNELS.map((channel) => `"${channel}"`).join(", ");
  return `
WITH stg AS (
  SELECT
    timestamp AS event_timestamp_millis,
    TIMESTAMP_MILLIS(timestamp) AS event_timestamp,
    DATE(TIMESTAMP_MILLIS(timestamp), "America/Los_Angeles") AS event_date,
    DATE(_PARTITIONTIME) AS ingestion_date,
    event_name,
    event_id,
    source_client,
    NULLIF(transaction_id, "") AS transaction_id,
    NULLIF(stape_user_id, "") AS stape_user_id,
    NULLIF(gn_uid, "") AS gn_uid,
    COALESCE(NULLIF(shopify_customer_id, ""), NULLIF(user_id, "")) AS shopify_customer_id,
    NULLIF(hashed_email, "") AS hashed_email,
    NULLIF(client_id, "") AS client_id,
    NULLIF(CAST(ga_session_id AS STRING), "") AS ga_session_id,
    ga_session_number,
    page_location,
    REGEXP_EXTRACT(page_location, r"https?://[^/]+(/[^?]*)") AS page_path,
    page_referrer,
    NET.HOST(page_location) AS page_host,
    NET.HOST(page_referrer) AS referrer_host,
    NULLIF(REGEXP_EXTRACT(page_location, r"[?&]utm_source=([^&]+)"), "") AS raw_source,
    NULLIF(REGEXP_EXTRACT(page_location, r"[?&]utm_medium=([^&]+)"), "") AS raw_medium,
    NULLIF(REGEXP_EXTRACT(page_location, r"[?&]utm_campaign=([^&]+)"), "") AS raw_campaign,
    NULLIF(REGEXP_EXTRACT(page_location, r"[?&]utm_content=([^&]+)"), "") AS raw_content,
    NULLIF(REGEXP_EXTRACT(page_location, r"[?&]utm_term=([^&]+)"), "") AS raw_term,
    COALESCE(NULLIF(gclid, ""), NULLIF(REGEXP_EXTRACT(page_location, r"[?&]gclid=([^&]+)"), "")) AS gclid,
    COALESCE(NULLIF(gbraid, ""), NULLIF(REGEXP_EXTRACT(page_location, r"[?&]gbraid=([^&]+)"), "")) AS gbraid,
    COALESCE(NULLIF(wbraid, ""), NULLIF(REGEXP_EXTRACT(page_location, r"[?&]wbraid=([^&]+)"), "")) AS wbraid,
    NULLIF(dclid, "") AS dclid,
    COALESCE(NULLIF(fbclid, ""), NULLIF(REGEXP_EXTRACT(page_location, r"[?&]fbclid=([^&]+)"), "")) AS fbclid,
    CAST(NULL AS STRING) AS fbc,
    NULLIF(REGEXP_EXTRACT(page_location, r"[?&]msclkid=([^&]+)"), "") AS msclkid,
    NULLIF(REGEXP_EXTRACT(page_location, r"[?&]ttclid=([^&]+)"), "") AS ttclid,
    value AS event_purchase_value,
    currency,
    tax,
    shipping,
    LOWER(IFNULL(event_name, "")) = "purchase" AND IFNULL(transaction_id, "") != "" AS is_purchase,
    DATE(_PARTITIONTIME) > DATE_ADD(DATE(TIMESTAMP_MILLIS(timestamp), "America/Los_Angeles"), INTERVAL 1 DAY) AS is_late_event
  FROM ${rawTable}
),
classified AS (
  SELECT
    stg.*,
    ${INTERNAL_NOISE_SQL} AS is_internal_noise,
    ${CHANNEL_SQL} AS channel
  FROM stg
),
enriched AS (
  SELECT
    classified.*,
    classified.channel IN (${paidList}) AS is_paid,
    classified.channel = "Direct" AND NOT classified.is_internal_noise AS is_direct,
    NOT classified.is_internal_noise
      AND classified.channel != "Unknown" AS is_touch_eligible
  FROM classified
),
colliding AS (
  SELECT client_id
  FROM enriched
  WHERE client_id IS NOT NULL AND shopify_customer_id IS NOT NULL
  GROUP BY client_id
  HAVING COUNT(DISTINCT shopify_customer_id) > 1
),
txn_person AS (
  SELECT
    transaction_id,
    ARRAY_AGG(shopify_customer_id IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS shopify_customer_id
  FROM enriched
  WHERE is_purchase
  GROUP BY transaction_id
),
dim_person AS (
  SELECT
    m.client_id,
    m.shopify_customer_id,
    m.hashed_email,
    m.gn_uid,
    m.stape_user_id,
    CASE
      WHEN m.shopify_customer_id IS NOT NULL THEN CONCAT("cust:", m.shopify_customer_id)
      WHEN m.hashed_email IS NOT NULL THEN CONCAT("email:", m.hashed_email)
      WHEN m.gn_uid IS NOT NULL THEN CONCAT("gn:", m.gn_uid)
      WHEN m.stape_user_id IS NOT NULL THEN CONCAT("stape:", m.stape_user_id)
      ELSE CONCAT("cid:", m.client_id)
    END AS person_id,
    CASE
      WHEN m.shopify_customer_id IS NOT NULL THEN "HIGH"
      WHEN m.gn_uid IS NOT NULL THEN "HIGH"
      WHEN m.stape_user_id IS NOT NULL THEN "HIGH/MEDIUM"
      ELSE "MEDIUM"
    END AS identity_confidence,
    CASE
      WHEN m.shopify_customer_id IS NOT NULL THEN "shopify_customer_id"
      WHEN m.hashed_email IS NOT NULL THEN "hashed_email"
      WHEN m.gn_uid IS NOT NULL THEN "gn_uid"
      WHEN m.stape_user_id IS NOT NULL THEN "stape_user_id"
      ELSE "client_id"
    END AS identity_method
  FROM (
    SELECT
      s.client_id,
      ANY_VALUE(s.gn_uid) AS gn_uid,
      ANY_VALUE(s.stape_user_id) AS stape_user_id,
      ANY_VALUE(s.hashed_email) AS hashed_email,
      COALESCE(ANY_VALUE(s.shopify_customer_id), ANY_VALUE(t.shopify_customer_id)) AS shopify_customer_id
    FROM enriched AS s
    LEFT JOIN txn_person AS t
      ON s.transaction_id = t.transaction_id
    LEFT JOIN colliding AS c
      ON s.client_id = c.client_id
    WHERE s.client_id IS NOT NULL
      AND c.client_id IS NULL
    GROUP BY s.client_id
  ) AS m
),
sessions AS (
  SELECT
    CONCAT(e.client_id, "|", e.ga_session_id) AS session_key,
    ANY_VALUE(p.person_id) AS person_id,
    ANY_VALUE(e.client_id) AS ga_client_id,
    ANY_VALUE(e.ga_session_id) AS ga_session_id,
    MIN(e.event_timestamp) AS session_start,
    MAX(e.event_timestamp) AS session_end,
    ARRAY_AGG(e.page_location IGNORE NULLS ORDER BY e.event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS landing_page,
    ARRAY_AGG(e.raw_source IGNORE NULLS ORDER BY e.event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS first_source,
    ARRAY_AGG(e.raw_medium IGNORE NULLS ORDER BY e.event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS first_medium,
    ARRAY_AGG(e.raw_campaign IGNORE NULLS ORDER BY e.event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS first_campaign,
    ARRAY_AGG(e.gclid IGNORE NULLS ORDER BY e.event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS gclid,
    ARRAY_AGG(e.gbraid IGNORE NULLS ORDER BY e.event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS gbraid,
    ARRAY_AGG(e.wbraid IGNORE NULLS ORDER BY e.event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS wbraid,
    ARRAY_AGG(e.fbclid IGNORE NULLS ORDER BY e.event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS fbclid,
    ARRAY_AGG(e.channel IGNORE NULLS ORDER BY e.event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS channel,
    ARRAY_AGG(e.is_paid IGNORE NULLS ORDER BY e.event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS is_paid,
    ARRAY_AGG(e.is_direct IGNORE NULLS ORDER BY e.event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS is_direct,
    ANY_VALUE(p.identity_method) AS identity_method,
    ANY_VALUE(p.identity_confidence) AS identity_confidence
  FROM enriched AS e
  LEFT JOIN dim_person AS p
    ON p.client_id = e.client_id
  WHERE IFNULL(e.source_client, "GA4") = "GA4"
    AND e.client_id IS NOT NULL
    AND e.ga_session_id IS NOT NULL
    AND LOWER(IFNULL(e.event_name, "")) != "shopify_order"
  GROUP BY session_key
),
eligible_session_landing AS (
  SELECT
    CONCAT(e.client_id, "|", e.ga_session_id) AS session_key,
    ANY_VALUE(p.person_id) AS person_id,
    MIN(e.event_timestamp) AS first_eligible_ts,
    ARRAY_AGG(e.page_location IGNORE NULLS ORDER BY e.event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS landing_page,
    ARRAY_AGG(e.raw_source IGNORE NULLS ORDER BY e.event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS first_source,
    ARRAY_AGG(e.raw_medium IGNORE NULLS ORDER BY e.event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS first_medium,
    ARRAY_AGG(e.raw_campaign IGNORE NULLS ORDER BY e.event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS first_campaign,
    ARRAY_AGG(e.gclid IGNORE NULLS ORDER BY e.event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS gclid,
    ARRAY_AGG(e.gbraid IGNORE NULLS ORDER BY e.event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS gbraid,
    ARRAY_AGG(e.wbraid IGNORE NULLS ORDER BY e.event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS wbraid,
    ARRAY_AGG(e.fbclid IGNORE NULLS ORDER BY e.event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS fbclid,
    ARRAY_AGG(e.channel IGNORE NULLS ORDER BY e.event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS channel,
    ARRAY_AGG(e.is_paid IGNORE NULLS ORDER BY e.event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS is_paid,
    ARRAY_AGG(e.is_direct IGNORE NULLS ORDER BY e.event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS is_direct,
    ANY_VALUE(p.identity_method) AS identity_method,
    ANY_VALUE(p.identity_confidence) AS identity_confidence
  FROM enriched AS e
  LEFT JOIN dim_person AS p
    ON p.client_id = e.client_id
  WHERE IFNULL(e.source_client, "GA4") = "GA4"
    AND e.client_id IS NOT NULL
    AND e.ga_session_id IS NOT NULL
    AND LOWER(IFNULL(e.event_name, "")) != "shopify_order"
    AND e.is_touch_eligible
  GROUP BY session_key
),
touchpoints AS (
  SELECT
    TO_HEX(SHA256(CONCAT(l.session_key, CAST(IFNULL(s.session_start, l.first_eligible_ts) AS STRING)))) AS touchpoint_id,
    l.person_id,
    l.session_key,
    l.first_eligible_ts AS touchpoint_timestamp,
    l.first_source AS source,
    l.first_medium AS medium,
    l.first_campaign AS campaign,
    l.channel,
    CASE
      WHEN l.gclid IS NOT NULL THEN "gclid"
      WHEN l.gbraid IS NOT NULL THEN "gbraid"
      WHEN l.wbraid IS NOT NULL THEN "wbraid"
      WHEN l.fbclid IS NOT NULL THEN "fbclid"
      ELSE NULL
    END AS click_id_type,
    COALESCE(l.gclid, l.gbraid, l.wbraid, l.fbclid) AS click_id,
    l.landing_page,
    l.is_paid,
    l.is_direct,
    FALSE AS is_internal_noise,
    TRUE AS is_touch_eligible,
    l.identity_method,
    l.identity_confidence
  FROM eligible_session_landing AS l
  LEFT JOIN sessions AS s
    ON s.session_key = l.session_key
  WHERE l.channel IS NOT NULL
    AND l.channel != "Unknown"
),
orders AS (
  SELECT * EXCEPT (source_rank)
  FROM (
    SELECT
      e.transaction_id,
      e.event_timestamp AS order_timestamp,
      e.event_date AS order_date,
      p.person_id,
      e.shopify_customer_id,
      e.hashed_email,
      e.gn_uid,
      e.stape_user_id,
      e.client_id,
      e.event_purchase_value,
      e.currency,
      e.source_client AS order_source,
      p.identity_method,
      p.identity_confidence,
      ROW_NUMBER() OVER (
        PARTITION BY e.transaction_id
        ORDER BY
          CASE e.source_client WHEN "Data Client" THEN 0 WHEN "GA4" THEN 1 ELSE 2 END,
          CASE WHEN e.shopify_customer_id IS NOT NULL THEN 0 ELSE 1 END,
          e.event_timestamp
      ) AS source_rank
    FROM enriched AS e
    LEFT JOIN dim_person AS p
      ON p.client_id = e.client_id
    WHERE e.is_purchase
  )
  WHERE source_rank = 1
),
order_touches AS (
  SELECT
    o.*,
    t.touchpoint_id,
    t.touchpoint_timestamp,
    t.source,
    t.medium,
    t.campaign,
    t.channel,
    t.click_id_type,
    t.click_id,
    t.landing_page,
    t.is_paid,
    t.is_direct,
    t.session_key,
    TIMESTAMP_DIFF(o.order_timestamp, t.touchpoint_timestamp, HOUR) AS hours_to_conversion,
    TIMESTAMP_DIFF(o.order_timestamp, t.touchpoint_timestamp, DAY) AS days_to_conversion
  FROM orders AS o
  LEFT JOIN touchpoints AS t
    ON t.person_id = o.person_id
   AND t.touchpoint_timestamp <= o.order_timestamp
   AND t.touchpoint_timestamp >= TIMESTAMP_SUB(o.order_timestamp, INTERVAL @lookbackDays DAY)
)
`;
}
