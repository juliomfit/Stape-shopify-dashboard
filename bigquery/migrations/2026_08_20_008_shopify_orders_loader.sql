-- PURPOSE: Additive columns on analytics.fct_shopify_orders so the app can
--   MERGE Shopify Admin orders (currentTotalPriceSet / refunds / customer /
--   first-touch JSON / line items) without creating a second fact table.
-- TYPE OF CHANGE: ALTER TABLE ADD COLUMN IF NOT EXISTS
-- PROJECT: stape-analytics-487802
-- DATASET: analytics
-- OBJECTS AFFECTED: analytics.fct_shopify_orders
-- DESTRUCTIVE: NO
-- SAFE TO RE-RUN: YES
-- DEPENDENCIES: bigquery/migrations/2026_08_18_004_shopify_history.sql
-- EXPECTED RESULT: Extra columns exist. App also issues CREATE TABLE IF NOT
--   EXISTS + ADD COLUMN IF NOT EXISTS at runtime, so Production does not crash
--   if this file has not been run. Run this in the console for the documented
--   warehouse schema.
-- ROLLBACK STRATEGY: Leave columns in place (additive). Do not DROP TABLE.
-- VALIDATION QUERY:
--   SELECT column_name FROM `stape-analytics-487802.analytics.INFORMATION_SCHEMA.COLUMNS`
--   WHERE table_name = "fct_shopify_orders"
--   ORDER BY column_name;

ALTER TABLE `stape-analytics-487802.analytics.fct_shopify_orders`
  ADD COLUMN IF NOT EXISTS subtotal FLOAT64;

ALTER TABLE `stape-analytics-487802.analytics.fct_shopify_orders`
  ADD COLUMN IF NOT EXISTS refund_fees FLOAT64;

ALTER TABLE `stape-analytics-487802.analytics.fct_shopify_orders`
  ADD COLUMN IF NOT EXISTS financial_status STRING;

ALTER TABLE `stape-analytics-487802.analytics.fct_shopify_orders`
  ADD COLUMN IF NOT EXISTS is_guest BOOL;

ALTER TABLE `stape-analytics-487802.analytics.fct_shopify_orders`
  ADD COLUMN IF NOT EXISTS customer_order_number INT64;

ALTER TABLE `stape-analytics-487802.analytics.fct_shopify_orders`
  ADD COLUMN IF NOT EXISTS customer_display_name STRING;

ALTER TABLE `stape-analytics-487802.analytics.fct_shopify_orders`
  ADD COLUMN IF NOT EXISTS customer_created_at TIMESTAMP;

ALTER TABLE `stape-analytics-487802.analytics.fct_shopify_orders`
  ADD COLUMN IF NOT EXISTS order_gid STRING;

ALTER TABLE `stape-analytics-487802.analytics.fct_shopify_orders`
  ADD COLUMN IF NOT EXISTS shop_name STRING;

ALTER TABLE `stape-analytics-487802.analytics.fct_shopify_orders`
  ADD COLUMN IF NOT EXISTS first_touch_json STRING;

ALTER TABLE `stape-analytics-487802.analytics.fct_shopify_orders`
  ADD COLUMN IF NOT EXISTS line_items_json STRING;

ALTER TABLE `stape-analytics-487802.analytics.fct_shopify_orders`
  ADD COLUMN IF NOT EXISTS custom_attributes_json STRING;
