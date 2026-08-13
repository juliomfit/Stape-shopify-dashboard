-- Exactly one row per Shopify transaction_id. Never sum raw purchase events.

CREATE OR REPLACE VIEW `stape-analytics-487802.analytics.fct_orders` AS
WITH ranked AS (
  SELECT
    e.*,
    p.person_id,
    p.identity_method,
    p.identity_confidence,
    ROW_NUMBER() OVER (
      PARTITION BY e.transaction_id
      ORDER BY
        CASE e.source_client WHEN "Data Client" THEN 0 WHEN "GA4" THEN 1 ELSE 2 END,
        CASE WHEN e.shopify_customer_id IS NOT NULL THEN 0 ELSE 1 END,
        e.event_timestamp
    ) AS source_rank
  FROM `stape-analytics-487802.analytics.stg_events` AS e
  LEFT JOIN `stape-analytics-487802.analytics.dim_person` AS p
    ON p.client_id = e.client_id
  WHERE e.is_purchase
    AND e.transaction_id IS NOT NULL
    AND LOWER(IFNULL(e.event_name, "")) NOT IN (
      "purchase_new_customer",
      "purchase_return_customer"
    )
),
copies AS (
  SELECT
    transaction_id,
    COUNT(*) AS purchase_event_copies
  FROM `stape-analytics-487802.analytics.stg_events`
  WHERE is_purchase
  GROUP BY transaction_id
)
SELECT
  r.transaction_id,
  r.event_timestamp AS order_timestamp,
  r.event_date AS order_date,
  r.person_id,
  r.shopify_customer_id,
  r.hashed_email,
  r.gn_uid,
  r.stape_user_id,
  r.client_id,
  r.value AS gross_revenue,
  CAST(NULL AS FLOAT64) AS discount,
  r.tax,
  r.shipping,
  r.value AS net_revenue,
  r.currency,
  CAST(NULL AS BOOL) AS new_customer,
  CAST(NULL AS BOOL) AS returning_customer,
  CAST(NULL AS INT64) AS purchase_count,
  r.source_client AS order_source,
  c.purchase_event_copies,
  r.identity_method,
  r.identity_confidence
FROM ranked AS r
JOIN copies AS c
  USING (transaction_id)
WHERE r.source_rank = 1;
