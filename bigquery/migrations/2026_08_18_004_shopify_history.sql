-- PURPOSE: Optional Shopify order history table for matured LTV / cohorts
--   beyond the Admin API pagination window. App continues to use Shopify Admin
--   API as money truth (now paginated up to 10,000 orders per request).
-- TYPE OF CHANGE: CREATE TABLE IF NOT EXISTS
-- PROJECT: stape-analytics-487802
-- DATASET: analytics
-- OBJECTS AFFECTED: analytics.fct_shopify_orders
-- DESTRUCTIVE: NO
-- SAFE TO RE-RUN: YES
-- DEPENDENCIES: analytics dataset
-- EXPECTED RESULT: Empty table ready for incremental MERGE from a future loader.
--   App does not query this table yet (backward compatible).
-- ROLLBACK STRATEGY: DROP TABLE analytics.fct_shopify_orders only if unused.
-- VALIDATION QUERY: SELECT COUNT(*) FROM `stape-analytics-487802.analytics.fct_shopify_orders`;
--
-- Do not treat Meta/GA4 purchase value as commerce truth. Load Shopify
-- currentTotalPriceSet / refunds / customer / first gn_* attributes only.

CREATE TABLE IF NOT EXISTS `stape-analytics-487802.analytics.fct_shopify_orders` (
  order_id STRING NOT NULL,
  order_name STRING,
  created_at TIMESTAMP,
  order_date DATE,
  currency STRING,
  net_revenue FLOAT64,
  gross_sales FLOAT64,
  discounts FLOAT64,
  refunds FLOAT64,
  shipping FLOAT64,
  tax FLOAT64,
  processing_fees FLOAT64,
  customer_id STRING,
  is_new_customer BOOL,
  first_touch_channel STRING,
  gn_uid STRING,
  first_product_title STRING,
  ingested_at TIMESTAMP
)
PARTITION BY order_date
CLUSTER BY customer_id, first_touch_channel;
