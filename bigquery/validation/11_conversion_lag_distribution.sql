-- 11 Conversion lag distribution (marketing touch → purchase).
-- Used to choose the production default attribution window.
-- Status until run: VALIDATION REQUIRED.
-- Temporary app default remains 7 days.
--
-- VIEW COLUMNS on analytics.v_attribution_credit_v1 (do not invent others):
--   transaction_id, model_name, touchpoint_id, channel, campaign,
--   is_paid, is_direct, net_revenue, hours_to_conversion, credit,
--   attributed_revenue
-- There is no purchase-time or touch-time column on the view.
-- hours_to_conversion = TIMESTAMP_DIFF(purchase, that touch, HOUR).
-- Linear keeps every eligible touch, so MAX(hours_to_conversion) per order
-- is first-touch lag (the window we actually need).

WITH first_marketing AS (
  SELECT
    transaction_id,
    MAX(hours_to_conversion) AS hours_to_purchase
  FROM `stape-analytics-487802.analytics.v_attribution_credit_v1`
  WHERE model_name = "linear"
    AND NOT is_direct
  GROUP BY transaction_id
)
SELECT
  APPROX_QUANTILES(hours_to_purchase, 100)[OFFSET(50)] AS p50_hours,
  APPROX_QUANTILES(hours_to_purchase, 100)[OFFSET(75)] AS p75_hours,
  APPROX_QUANTILES(hours_to_purchase, 100)[OFFSET(90)] AS p90_hours,
  APPROX_QUANTILES(hours_to_purchase, 100)[OFFSET(95)] AS p95_hours,
  APPROX_QUANTILES(hours_to_purchase, 100)[OFFSET(99)] AS p99_hours,
  COUNT(*) AS orders
FROM first_marketing;

-- Recommendation rule (apply after you have the numbers):
-- If P90 <= 7d (168h) → keep 7d default.
-- If P90 <= 14d (336h) → promote 14d.
-- If P90 > 14d and retention covers it → 30d.
-- Do not promote 90d until migration 003 retention is validated.
