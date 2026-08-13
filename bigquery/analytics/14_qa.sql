-- QA. Expected: duplicate_order_keys = 0, credit per order per single-touch model ≈ 1.

-- No duplicated orders
SELECT "orders_pk" AS check_name, COUNT(*) AS n, COUNT(DISTINCT transaction_id) AS distinct_n
FROM `stape-analytics-487802.analytics.fct_orders`;

-- Revenue not double-counted vs unique transactions
SELECT
  "purchase_events_vs_orders" AS check_name,
  (SELECT COUNT(*) FROM `stape-analytics-487802.analytics.stg_events` WHERE is_purchase) AS purchase_events,
  (SELECT COUNT(*) FROM `stape-analytics-487802.analytics.fct_orders`) AS canonical_orders;

-- Identity fill
SELECT
  COUNT(*) AS orders,
  COUNTIF(shopify_customer_id IS NOT NULL) / COUNT(*) AS customer_id_rate,
  COUNTIF(hashed_email IS NOT NULL) / COUNT(*) AS hashed_email_rate,
  COUNTIF(gn_uid IS NOT NULL) / COUNT(*) AS gn_uid_rate,
  COUNTIF(stape_user_id IS NOT NULL) / COUNT(*) AS stape_user_id_rate,
  COUNTIF(person_id IS NOT NULL) / COUNT(*) AS person_id_rate
FROM `stape-analytics-487802.analytics.fct_orders`;

-- Click ID capture on paid sessions
SELECT
  COUNT(*) AS paid_sessions,
  COUNTIF(gclid IS NOT NULL OR gbraid IS NOT NULL OR wbraid IS NOT NULL OR fbclid IS NOT NULL) AS with_click_id
FROM `stape-analytics-487802.analytics.fct_sessions`
WHERE is_paid;

-- Attribution coverage last_non_direct
SELECT
  COUNT(DISTINCT o.transaction_id) AS orders,
  COUNT(DISTINCT a.transaction_id) AS attributed_orders
FROM `stape-analytics-487802.analytics.fct_orders` AS o
LEFT JOIN `stape-analytics-487802.analytics.fct_attribution` AS a
  ON a.transaction_id = o.transaction_id
 AND a.model_name = "last_non_direct";

-- Single-touch models credit sums to 1 per attributed order
SELECT model_name, transaction_id, SUM(credit) AS credit_sum
FROM `stape-analytics-487802.analytics.fct_attribution`
WHERE model_name IN ("first_touch", "last_touch", "last_non_direct", "last_paid", "first_paid")
GROUP BY 1, 2
HAVING ABS(SUM(credit) - 1) > 0.001;

-- Identity collisions (should stay 0 or be reviewed, never auto-merged)
SELECT * FROM `stape-analytics-487802.analytics.identity_collisions`;

-- Late events
SELECT COUNT(*) AS late_events
FROM `stape-analytics-487802.analytics.stg_events`
WHERE is_late_event;
