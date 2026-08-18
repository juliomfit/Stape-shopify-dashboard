-- 03 Order credit integrity for attribution_policy_v1.
-- Requires migration 002. If the view is missing, this query errors — that is
-- VALIDATION REQUIRED, not an app outage.

SELECT
  model_name,
  COUNT(*) AS credit_rows,
  COUNT(DISTINCT transaction_id) AS orders,
  COUNTIF(ABS(order_credit - 1.0) > 1e-6) AS orders_credit_ne_1,
  COUNTIF(ABS(order_attributed - net_revenue) > 0.01) AS orders_revenue_mismatch
FROM (
  SELECT
    model_name,
    transaction_id,
    ANY_VALUE(net_revenue) AS net_revenue,
    SUM(credit) AS order_credit,
    SUM(attributed_revenue) AS order_attributed
  FROM `stape-analytics-487802.analytics.v_attribution_credit_v1`
  GROUP BY 1, 2
)
GROUP BY 1
ORDER BY 1;

-- Expected: orders_credit_ne_1 = 0 and orders_revenue_mismatch = 0 for every
-- model except paid_only (orders with no paid touch have zero credit rows).
