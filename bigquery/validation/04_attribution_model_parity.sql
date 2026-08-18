-- 04 Attribution model parity helpers (SQL side).
-- Compare a known journey's SQL credit to the TypeScript golden tests in
-- test/attribution-engine.test.ts (Journey A: Meta → Google Organic → Direct).
-- This query does not invent production percentages.

SELECT
  model_name,
  channel,
  SUM(credit) AS credit,
  SUM(attributed_revenue) AS attributed_revenue
FROM `stape-analytics-487802.analytics.v_attribution_credit_v1`
WHERE transaction_id = "REPLACE_WITH_A_KNOWN_ORDER_ID"
GROUP BY 1, 2
ORDER BY 1, 2;

-- TypeScript expected for Journey A (Meta, Organic, Direct):
-- first_touch: Meta 1.0
-- last_touch: Direct 1.0
-- last_non_direct: Google Organic 1.0
-- linear: 1/3 each
-- position_based: 0.4 / 0.2 / 0.4
-- paid_only: Meta 1.0
