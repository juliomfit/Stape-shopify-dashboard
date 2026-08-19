-- 11 Conversion lag distribution (marketing touch → purchase).
-- Used to choose the production default attribution window.
-- Status: ran 2026-08-19. P50/P75/P90=0h P95=3h P99=69h n=69. Keep 7d default.
-- Temporary app default remains 7 days.
--
-- Status: VALIDATION REQUIRED after migration 005 (prior 2026-08-19 lag used
-- the old event/touch grain). Keep the 7-day default until this re-run.
-- VIEW COLUMNS after 005 (do not invent others):
--   transaction_id, model_name, touchpoint_id, channel, campaign,
--   is_paid, is_direct, event_purchase_value, hours_to_conversion, credit
-- There is no net_revenue / attributed_revenue on the credit-only view.
-- hours_to_conversion = TIMESTAMP_DIFF(purchase, that touch, HOUR).
-- If this returns orders = 0, the view is empty. Run 005, then 11a.

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
-- Do not mark PRODUCTION VERIFIED without pasting this result after 005.
