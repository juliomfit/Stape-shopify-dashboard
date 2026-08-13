-- Deterministic identity edges only. No IP. Click IDs are not person keys.
-- Do not merge two shopify_customer_id values because a weak id matches.

CREATE OR REPLACE VIEW `stape-analytics-487802.analytics.identity_edges` AS
WITH pairs AS (
  SELECT
    "shopify_customer_id" AS identifier_a_type,
    shopify_customer_id AS identifier_a_value,
    "client_id" AS identifier_b_type,
    client_id AS identifier_b_value,
    event_timestamp,
    source_client,
    "same_event" AS source,
    0.95 AS confidence
  FROM `stape-analytics-487802.analytics.stg_events`
  WHERE shopify_customer_id IS NOT NULL AND client_id IS NOT NULL

  UNION ALL
  SELECT
    "shopify_customer_id", hashed_email, "hashed_email", hashed_email, event_timestamp, source_client, "same_event", 0.99
  FROM `stape-analytics-487802.analytics.stg_events`
  WHERE FALSE

  UNION ALL
  SELECT
    "gn_uid", gn_uid, "stape_user_id", stape_user_id, event_timestamp, source_client, "same_event", 0.80
  FROM `stape-analytics-487802.analytics.stg_events`
  WHERE gn_uid IS NOT NULL AND stape_user_id IS NOT NULL

  UNION ALL
  SELECT
    "gn_uid", gn_uid, "client_id", client_id, event_timestamp, source_client, "same_event", 0.85
  FROM `stape-analytics-487802.analytics.stg_events`
  WHERE gn_uid IS NOT NULL AND client_id IS NOT NULL

  UNION ALL
  SELECT
    "stape_user_id", stape_user_id, "client_id", client_id, event_timestamp, source_client, "same_event", 0.70
  FROM `stape-analytics-487802.analytics.stg_events`
  WHERE stape_user_id IS NOT NULL AND client_id IS NOT NULL

  UNION ALL
  SELECT
    "hashed_email", hashed_email, "shopify_customer_id", shopify_customer_id, event_timestamp, source_client, "same_event", 0.99
  FROM `stape-analytics-487802.analytics.stg_events`
  WHERE hashed_email IS NOT NULL AND shopify_customer_id IS NOT NULL

  UNION ALL
  SELECT
    "hashed_email", hashed_email, "gn_uid", gn_uid, event_timestamp, source_client, "same_event", 0.90
  FROM `stape-analytics-487802.analytics.stg_events`
  WHERE hashed_email IS NOT NULL AND gn_uid IS NOT NULL

  UNION ALL
  SELECT
    "hashed_email", hashed_email, "stape_user_id", stape_user_id, event_timestamp, source_client, "same_event", 0.80
  FROM `stape-analytics-487802.analytics.stg_events`
  WHERE hashed_email IS NOT NULL AND stape_user_id IS NOT NULL

  UNION ALL
  -- Same Shopify transaction observed by both pixels (GA4 client_id ≠ dcid).
  SELECT
    "client_id",
    a.client_id,
    "client_id",
    b.client_id,
    a.event_timestamp,
    a.source_client,
    "same_transaction_id",
    0.90
  FROM `stape-analytics-487802.analytics.stg_events` AS a
  JOIN `stape-analytics-487802.analytics.stg_events` AS b
    ON a.transaction_id = b.transaction_id
   AND a.client_id < b.client_id
  WHERE a.transaction_id IS NOT NULL
    AND a.client_id IS NOT NULL
    AND b.client_id IS NOT NULL
    AND a.is_purchase
    AND b.is_purchase
)
SELECT
  identifier_a_type,
  identifier_a_value,
  identifier_b_type,
  identifier_b_value,
  MIN(event_timestamp) AS first_seen_at,
  MAX(event_timestamp) AS last_seen_at,
  COUNT(*) AS observation_count,
  MAX(confidence) AS confidence,
  ANY_VALUE(source) AS source
FROM pairs
WHERE identifier_a_value IS NOT NULL
  AND identifier_b_value IS NOT NULL
  AND identifier_a_value != identifier_b_value
GROUP BY 1, 2, 3, 4;

-- Collisions: one client_id tied to two Shopify customers. Do not merge people.
CREATE OR REPLACE VIEW `stape-analytics-487802.analytics.identity_collisions` AS
SELECT
  client_id,
  COUNT(DISTINCT shopify_customer_id) AS customer_count,
  ARRAY_AGG(DISTINCT shopify_customer_id IGNORE NULLS) AS shopify_customer_ids
FROM `stape-analytics-487802.analytics.stg_events`
WHERE client_id IS NOT NULL
  AND shopify_customer_id IS NOT NULL
GROUP BY client_id
HAVING COUNT(DISTINCT shopify_customer_id) > 1;

CREATE OR REPLACE VIEW `stape-analytics-487802.analytics.dim_person` AS
WITH colliding AS (
  SELECT client_id FROM `stape-analytics-487802.analytics.identity_collisions`
),
txn_person AS (
  SELECT
    transaction_id,
    ARRAY_AGG(shopify_customer_id IGNORE NULLS ORDER BY event_timestamp LIMIT 1)[SAFE_OFFSET(0)] AS shopify_customer_id
  FROM `stape-analytics-487802.analytics.stg_events`
  WHERE is_purchase
  GROUP BY transaction_id
),
id_map AS (
  SELECT
    s.client_id,
    ANY_VALUE(s.gn_uid) AS gn_uid,
    ANY_VALUE(s.stape_user_id) AS stape_user_id,
    ANY_VALUE(s.hashed_email) AS hashed_email,
    COALESCE(
      ANY_VALUE(s.shopify_customer_id),
      ANY_VALUE(t.shopify_customer_id)
    ) AS shopify_customer_id
  FROM `stape-analytics-487802.analytics.stg_events` AS s
  LEFT JOIN txn_person AS t
    ON s.transaction_id = t.transaction_id
  LEFT JOIN colliding AS c
    ON s.client_id = c.client_id
  WHERE s.client_id IS NOT NULL
    AND c.client_id IS NULL
  GROUP BY s.client_id
)
SELECT
  CASE
    WHEN shopify_customer_id IS NOT NULL THEN CONCAT("cust:", shopify_customer_id)
    WHEN hashed_email IS NOT NULL THEN CONCAT("email:", hashed_email)
    WHEN gn_uid IS NOT NULL THEN CONCAT("gn:", gn_uid)
    WHEN stape_user_id IS NOT NULL THEN CONCAT("stape:", stape_user_id)
    ELSE CONCAT("cid:", client_id)
  END AS person_id,
  client_id,
  shopify_customer_id,
  hashed_email,
  gn_uid,
  stape_user_id,
  CASE
    WHEN shopify_customer_id IS NOT NULL AND hashed_email IS NOT NULL THEN "VERY HIGH"
    WHEN shopify_customer_id IS NOT NULL THEN "HIGH"
    WHEN gn_uid IS NOT NULL THEN "HIGH"
    WHEN stape_user_id IS NOT NULL THEN "HIGH/MEDIUM"
    ELSE "MEDIUM"
  END AS identity_confidence,
  CASE
    WHEN shopify_customer_id IS NOT NULL THEN "shopify_customer_id"
    WHEN hashed_email IS NOT NULL THEN "hashed_email"
    WHEN gn_uid IS NOT NULL THEN "gn_uid"
    WHEN stape_user_id IS NOT NULL THEN "stape_user_id"
    ELSE "client_id"
  END AS identity_method
FROM id_map;
