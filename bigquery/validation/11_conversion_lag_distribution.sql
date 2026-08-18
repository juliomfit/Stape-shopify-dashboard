-- 11 Conversion lag distribution (marketing touch → purchase).
-- Used to choose the production default attribution window.
-- Status until run: VALIDATION REQUIRED.
-- Temporary app default remains 7 days.

WITH touches AS (
  SELECT
    transaction_id,
    TIMESTAMP_DIFF(
      order_timestamp,
      MIN(touchpoint_timestamp) OVER (PARTITION BY transaction_id),
      HOUR
    ) AS hours_to_purchase
  FROM `stape-analytics-487802.analytics.v_attribution_credit_v1`
  WHERE model_name = "last_non_direct"
    AND NOT is_direct
)
SELECT
  APPROX_QUANTILES(hours_to_purchase, 100)[OFFSET(50)] AS p50_hours,
  APPROX_QUANTILES(hours_to_purchase, 100)[OFFSET(75)] AS p75_hours,
  APPROX_QUANTILES(hours_to_purchase, 100)[OFFSET(90)] AS p90_hours,
  APPROX_QUANTILES(hours_to_purchase, 100)[OFFSET(95)] AS p95_hours,
  APPROX_QUANTILES(hours_to_purchase, 100)[OFFSET(99)] AS p99_hours,
  COUNT(DISTINCT transaction_id) AS orders
FROM touches;

-- Recommendation rule (apply after you have the numbers):
-- If P90 <= 7d → keep 7d default.
-- If P90 <= 14d → promote 14d.
-- If P90 > 14d and retention covers it → 30d.
-- Do not promote 90d until migration 003 retention is validated.
