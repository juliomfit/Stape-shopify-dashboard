CREATE OR REPLACE VIEW `stape-analytics-487802.analytics.customer_journey` AS
WITH touches AS (
  SELECT
    transaction_id,
    person_id,
    order_timestamp,
    net_revenue,
    ARRAY_AGG(STRUCT(touchpoint_timestamp, channel, source, medium, campaign, is_paid, is_direct) ORDER BY touchpoint_timestamp) AS path
  FROM `stape-analytics-487802.analytics.v_order_touches`
  WHERE touchpoint_id IS NOT NULL
  GROUP BY 1, 2, 3, 4
)
SELECT
  transaction_id,
  person_id,
  order_timestamp,
  net_revenue,
  path,
  (SELECT p.channel FROM UNNEST(path) AS p ORDER BY p.touchpoint_timestamp LIMIT 1) AS first_touch_channel,
  (SELECT p.channel FROM UNNEST(path) AS p ORDER BY p.touchpoint_timestamp DESC LIMIT 1) AS last_touch_channel,
  (SELECT p.channel FROM UNNEST(path) AS p WHERE NOT p.is_direct ORDER BY p.touchpoint_timestamp DESC LIMIT 1) AS last_non_direct_channel,
  (SELECT p.channel FROM UNNEST(path) AS p WHERE p.is_paid ORDER BY p.touchpoint_timestamp DESC LIMIT 1) AS last_paid_channel,
  (SELECT STRING_AGG(p.channel, " → " ORDER BY p.touchpoint_timestamp)
   FROM UNNEST(path) AS p WHERE NOT p.is_direct) AS assisting_path,
  ARRAY_LENGTH(path) AS touches_before_purchase,
  TIMESTAMP_DIFF(order_timestamp, (SELECT MIN(p.touchpoint_timestamp) FROM UNNEST(path) AS p), DAY) AS days_to_purchase
FROM touches;

CREATE OR REPLACE VIEW `stape-analytics-487802.analytics.mart_attribution_daily` AS
SELECT
  o.order_date AS date,
  a.model_name AS model,
  a.channel,
  a.source,
  a.medium,
  a.campaign,
  COUNT(DISTINCT o.transaction_id) AS orders,
  SUM(o.net_revenue) AS revenue,
  COUNT(DISTINCT IF(o.new_customer, o.transaction_id, NULL)) AS new_customer_orders,
  COUNT(DISTINCT IF(o.returning_customer, o.transaction_id, NULL)) AS returning_customer_orders,
  SUM(a.credit) AS attributed_orders,
  SUM(a.attributed_revenue) AS attributed_revenue,
  SUM(IF(a.attribution_confidence IN ("VERY HIGH", "HIGH"), a.credit, 0)) AS high_confidence_orders,
  SUM(IF(a.attribution_confidence = "MEDIUM", a.credit, 0)) AS medium_confidence_orders,
  SUM(IF(a.attribution_confidence IN ("LOWER", "UNKNOWN"), a.credit, 0)) AS low_confidence_orders
FROM `stape-analytics-487802.analytics.fct_attribution` AS a
JOIN `stape-analytics-487802.analytics.fct_orders` AS o
  USING (transaction_id)
GROUP BY 1, 2, 3, 4, 5, 6;

CREATE OR REPLACE VIEW `stape-analytics-487802.analytics.mart_campaign_performance` AS
SELECT
  date,
  CASE
    WHEN channel = "Facebook / Meta Ads" THEN "Meta"
    WHEN channel = "Google Ads" THEN "Google"
    WHEN channel = "TikTok Ads" THEN "TikTok"
    WHEN channel = "Microsoft Ads" THEN "Microsoft"
    ELSE "Other"
  END AS platform,
  campaign,
  source,
  medium,
  SUM(IF(model = "first_touch", attributed_orders, 0)) AS first_touch_orders,
  SUM(IF(model = "last_non_direct", attributed_orders, 0)) AS last_non_direct_orders,
  SUM(IF(model = "last_paid", attributed_orders, 0)) AS last_paid_orders,
  SUM(IF(model = "linear", attributed_orders, 0)) AS linear_orders,
  SUM(IF(model = "first_touch", attributed_revenue, 0)) AS first_touch_revenue,
  SUM(IF(model = "last_non_direct", attributed_revenue, 0)) AS last_non_direct_revenue,
  SUM(IF(model = "last_paid", attributed_revenue, 0)) AS last_paid_revenue,
  SUM(IF(model = "linear", attributed_revenue, 0)) AS linear_revenue
FROM `stape-analytics-487802.analytics.mart_attribution_daily`
GROUP BY 1, 2, 3, 4, 5;

CREATE OR REPLACE VIEW `stape-analytics-487802.analytics.mart_customer_acquisition` AS
SELECT
  o.order_date AS date,
  a.channel AS acquisition_channel,
  a.source AS acquisition_source,
  a.campaign AS acquisition_campaign,
  COUNT(DISTINCT IF(o.new_customer, o.transaction_id, NULL)) AS new_customers,
  SUM(IF(o.new_customer, a.attributed_revenue, 0)) AS new_customer_revenue,
  COUNT(DISTINCT IF(o.returning_customer, o.transaction_id, NULL)) AS repeat_customers,
  SUM(IF(o.returning_customer, a.attributed_revenue, 0)) AS repeat_revenue
FROM `stape-analytics-487802.analytics.fct_attribution` AS a
JOIN `stape-analytics-487802.analytics.fct_orders` AS o
  USING (transaction_id)
WHERE a.model_name = "first_paid"
GROUP BY 1, 2, 3, 4;

CREATE OR REPLACE VIEW `stape-analytics-487802.analytics.mart_attribution_quality` AS
SELECT
  o.order_date AS date,
  COUNT(*) AS total_orders,
  COUNTIF(o.shopify_customer_id IS NOT NULL) AS orders_with_known_customer,
  COUNTIF(o.hashed_email IS NOT NULL) AS orders_with_hashed_email,
  COUNTIF(o.gn_uid IS NOT NULL) AS orders_with_gn_uid,
  COUNTIF(o.stape_user_id IS NOT NULL) AS orders_with_stape_user_id,
  COUNTIF(o.person_id IS NOT NULL) AS orders_with_person_id,
  COUNTIF(EXISTS (
    SELECT 1 FROM `stape-analytics-487802.analytics.fct_attribution` AS a
    WHERE a.transaction_id = o.transaction_id AND a.click_id IS NOT NULL
  )) AS orders_with_click_id,
  COUNTIF(EXISTS (
    SELECT 1 FROM `stape-analytics-487802.analytics.fct_attribution` AS a
    WHERE a.transaction_id = o.transaction_id
      AND a.model_name = "last_non_direct"
      AND a.attribution_confidence IN ("VERY HIGH", "HIGH")
  )) AS orders_attributed_high_confidence,
  COUNTIF(EXISTS (
    SELECT 1 FROM `stape-analytics-487802.analytics.fct_attribution` AS a
    WHERE a.transaction_id = o.transaction_id
      AND a.model_name = "last_non_direct"
      AND a.attribution_confidence = "MEDIUM"
  )) AS orders_attributed_medium_confidence,
  COUNTIF(EXISTS (
    SELECT 1 FROM `stape-analytics-487802.analytics.fct_attribution` AS a
    WHERE a.transaction_id = o.transaction_id
      AND a.model_name = "last_non_direct"
      AND a.attribution_confidence IN ("LOWER", "UNKNOWN")
  )) AS orders_attributed_low_confidence,
  COUNTIF(o.purchase_event_copies > 1) AS duplicate_purchase_event_orders
FROM `stape-analytics-487802.analytics.fct_orders` AS o
GROUP BY 1;

CREATE OR REPLACE VIEW `stape-analytics-487802.analytics.mart_platform_compare` AS
SELECT
  a.order_date AS date,
  a.channel,
  a.model_name,
  SUM(a.credit) AS warehouse_attributed_orders,
  SUM(a.attributed_revenue) AS warehouse_attributed_revenue,
  CAST(NULL AS FLOAT64) AS platform_reported_orders,
  CAST(NULL AS FLOAT64) AS platform_reported_revenue,
  CAST(NULL AS FLOAT64) AS platform_spend
FROM `stape-analytics-487802.analytics.fct_attribution` AS a
GROUP BY 1, 2, 3;
