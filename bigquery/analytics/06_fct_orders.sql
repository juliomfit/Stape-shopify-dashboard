-- LEGACY — DO NOT RUN IN PRODUCTION
-- Old fct_orders labeled event value as net_revenue. Shopify
-- currentTotalPriceSet is money truth. Canonical orders CTE is in
-- src/lib/warehouse/sql.ts (event_purchase_value, not net_revenue).
-- Optional future mirror: bigquery/migrations/2026_08_18_004_shopify_history.sql.

SELECT
  "DO_NOT_RUN" AS status,
  "src/lib/warehouse/sql.ts orders CTE + Shopify Admin currentTotalPriceSet" AS use_instead,
  "LEGACY — DO NOT RUN IN PRODUCTION" AS warning;
