-- Order × model × credited touch. Default lookback 30 days (override in app).

CREATE OR REPLACE VIEW `stape-analytics-487802.analytics.v_order_touches` AS
SELECT
  o.transaction_id,
  o.person_id,
  o.order_timestamp,
  o.order_date,
  o.net_revenue,
  o.currency,
  o.new_customer,
  o.returning_customer,
  o.identity_method AS order_identity_method,
  o.identity_confidence AS order_identity_confidence,
  t.touchpoint_id,
  t.touchpoint_timestamp,
  t.source,
  t.medium,
  t.campaign,
  t.channel,
  t.channel_group,
  t.click_id_type,
  t.click_id,
  t.is_paid,
  t.is_direct,
  TIMESTAMP_DIFF(o.order_timestamp, t.touchpoint_timestamp, HOUR) AS hours_to_conversion,
  TIMESTAMP_DIFF(o.order_timestamp, t.touchpoint_timestamp, DAY) AS days_to_conversion
FROM `stape-analytics-487802.analytics.fct_orders` AS o
LEFT JOIN `stape-analytics-487802.analytics.fct_touchpoints` AS t
  ON t.person_id = o.person_id
 AND t.touchpoint_timestamp <= o.order_timestamp
 AND t.touchpoint_timestamp >= TIMESTAMP_SUB(o.order_timestamp, INTERVAL 30 DAY);

CREATE OR REPLACE VIEW `stape-analytics-487802.analytics.fct_attribution` AS
WITH touches AS (
  SELECT
    *,
    COUNT(touchpoint_id) OVER (PARTITION BY transaction_id) AS touch_count,
    COUNTIF(NOT IFNULL(is_direct, TRUE)) OVER (PARTITION BY transaction_id) AS nondirect_count,
    COUNTIF(IFNULL(is_paid, FALSE)) OVER (PARTITION BY transaction_id) AS paid_count
  FROM `stape-analytics-487802.analytics.v_order_touches`
  WHERE touchpoint_id IS NOT NULL
),
scored AS (
  SELECT
    t.*,
    model.model_name,
    model.credit
  FROM touches AS t
  CROSS JOIN UNNEST([
    STRUCT("first_touch" AS model_name, 1.0 AS credit),
    STRUCT("last_touch", 1.0),
    STRUCT("last_non_direct", 1.0),
    STRUCT("last_paid", 1.0),
    STRUCT("first_paid", 1.0),
    STRUCT("paid_last_click", 1.0),
    STRUCT("linear", 1.0),
    STRUCT("position_based", 1.0),
    STRUCT("time_decay", 1.0)
  ]) AS model
  WHERE
    (model.model_name = "first_touch"
      AND t.touchpoint_timestamp = MIN(t.touchpoint_timestamp) OVER (PARTITION BY t.transaction_id))
    OR (model.model_name = "last_touch"
      AND t.touchpoint_timestamp = MAX(t.touchpoint_timestamp) OVER (PARTITION BY t.transaction_id))
    OR (model.model_name = "last_non_direct"
      AND (
        (t.nondirect_count > 0 AND NOT t.is_direct
          AND t.touchpoint_timestamp = MAX(IF(NOT t.is_direct, t.touchpoint_timestamp, NULL)) OVER (PARTITION BY t.transaction_id))
        OR (t.nondirect_count = 0
          AND t.touchpoint_timestamp = MAX(t.touchpoint_timestamp) OVER (PARTITION BY t.transaction_id))
      ))
    OR (model.model_name IN ("last_paid", "paid_last_click")
      AND t.is_paid
      AND t.touchpoint_timestamp = MAX(IF(t.is_paid, t.touchpoint_timestamp, NULL)) OVER (PARTITION BY t.transaction_id))
    OR (model.model_name = "first_paid"
      AND t.is_paid
      AND t.touchpoint_timestamp = MIN(IF(t.is_paid, t.touchpoint_timestamp, NULL)) OVER (PARTITION BY t.transaction_id))
    OR (model.model_name = "linear" AND (t.nondirect_count = 0 OR NOT t.is_direct))
    OR (model.model_name = "position_based" AND (t.nondirect_count = 0 OR NOT t.is_direct))
    OR (model.model_name = "time_decay" AND (t.nondirect_count = 0 OR NOT t.is_direct))
),
with_credit AS (
  SELECT
    * EXCEPT (credit),
    CASE model_name
      WHEN "linear" THEN 1.0 / COUNT(*) OVER (PARTITION BY transaction_id, model_name)
      WHEN "position_based" THEN
        CASE
          WHEN COUNT(*) OVER (PARTITION BY transaction_id, model_name) = 1 THEN 1.0
          WHEN COUNT(*) OVER (PARTITION BY transaction_id, model_name) = 2 THEN 0.5
          WHEN touchpoint_timestamp = MIN(touchpoint_timestamp) OVER (PARTITION BY transaction_id, model_name) THEN 0.4
          WHEN touchpoint_timestamp = MAX(touchpoint_timestamp) OVER (PARTITION BY transaction_id, model_name) THEN 0.4
          ELSE 0.2 / (COUNT(*) OVER (PARTITION BY transaction_id, model_name) - 2)
        END
      WHEN "time_decay" THEN
        POW(2, -hours_to_conversion / 168.0)
        / SUM(POW(2, -hours_to_conversion / 168.0)) OVER (PARTITION BY transaction_id, model_name)
      ELSE 1.0
    END AS credit
  FROM scored
)
SELECT
  transaction_id,
  person_id,
  model_name,
  touchpoint_id,
  touchpoint_timestamp,
  order_timestamp AS conversion_timestamp,
  days_to_conversion,
  hours_to_conversion,
  channel,
  source,
  medium,
  campaign,
  click_id_type,
  click_id,
  credit,
  net_revenue * credit AS attributed_revenue,
  order_identity_method AS identity_method,
  order_identity_confidence AS identity_confidence,
  CASE
    WHEN order_identity_confidence IN ("VERY HIGH", "HIGH") AND click_id IS NOT NULL THEN "VERY HIGH"
    WHEN order_identity_confidence IN ("VERY HIGH", "HIGH") THEN "HIGH"
    WHEN click_id IS NOT NULL THEN "HIGH"
    WHEN channel IS NOT NULL AND NOT IFNULL(is_direct, TRUE) THEN "MEDIUM"
    ELSE "LOWER"
  END AS attribution_confidence,
  CASE
    WHEN click_id IS NOT NULL THEN "HIGH"
    WHEN NOT IFNULL(is_direct, TRUE) THEN "MEDIUM"
    ELSE "LOWER"
  END AS touchpoint_confidence,
  new_customer,
  returning_customer
FROM with_credit;
