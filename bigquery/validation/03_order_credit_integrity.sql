-- 03 Order credit integrity — CREDIT ONLY after migration 005.
-- Status: VALIDATION REQUIRED until Julio pastes results.
-- Does NOT compare Shopify money. Event purchase value is QA only.
-- After 005 the view has no net_revenue / attributed_revenue columns.

SELECT
  model_name,
  COUNT(*) AS credit_rows,
  COUNT(DISTINCT transaction_id) AS orders,
  COUNTIF(ABS(order_credit - 1.0) > 1e-6) AS orders_credit_ne_1
FROM (
  SELECT
    model_name,
    transaction_id,
    SUM(credit) AS order_credit
  FROM `stape-analytics-487802.analytics.v_attribution_credit_v1`
  GROUP BY 1, 2
)
GROUP BY 1
ORDER BY 1;

-- Expected: orders_credit_ne_1 = 0 for every model except paid_only
-- (orders with no paid touch have zero credit rows, so they do not appear).
-- If this errors with Unrecognized name: net_revenue, 005 has not been applied.
-- If it errors with Unrecognized name: credit, the view is missing — run 005.
-- Paste the full result. Do not treat event_purchase_value as Shopify revenue.
