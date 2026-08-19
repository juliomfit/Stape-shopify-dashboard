-- 16 Meta new-customer credit guards. Status: VALIDATION REQUIRED.
-- Shopify new-customer truth lives in the app (numberOfOrders ≤ 1).
-- This query only proves Meta credit is non-negative and does not exceed 1
-- per order. It cannot compute attributed nCAC without Shopify new-customer
-- credit + mapped spend.

WITH meta_credit AS (
  SELECT
    transaction_id,
    SUM(credit) AS meta_credit,
    MIN(credit) AS min_touch_credit
  FROM `stape-analytics-487802.analytics.v_attribution_credit_v1`
  WHERE model_name = "last_non_direct"
    AND channel = "Facebook / Meta Ads"
  GROUP BY transaction_id
)
SELECT
  COUNT(*) AS meta_credited_orders,
  COUNTIF(mc.meta_credit < 0) AS negative_credit_orders,
  COUNTIF(mc.meta_credit > 1.000001) AS orders_meta_credit_gt_1,
  COUNTIF(mc.min_touch_credit < 0) AS negative_touch_credit,
  "VALIDATION REQUIRED" AS status,
  "Attributed nCAC is spend / fractional new-customer credit in the app, only when HIGH/PARTIAL ID mapping and spend exist. No-spend = —." AS note
FROM meta_credit AS mc;
