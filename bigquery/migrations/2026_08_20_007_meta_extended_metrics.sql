-- Additive Meta campaign extended-metrics columns.
-- Safe to re-run. Does not replace meta_campaign_insights_daily.
-- Existing dashboard queries keep working: new columns are nullable.

ALTER TABLE `stape-analytics-487802.goodsnova_platform.meta_campaign_insights_daily`
  ADD COLUMN IF NOT EXISTS conversions FLOAT64;

ALTER TABLE `stape-analytics-487802.goodsnova_platform.meta_campaign_insights_daily`
  ADD COLUMN IF NOT EXISTS unique_ctr FLOAT64;

ALTER TABLE `stape-analytics-487802.goodsnova_platform.meta_campaign_insights_daily`
  ADD COLUMN IF NOT EXISTS outbound_clicks FLOAT64;

ALTER TABLE `stape-analytics-487802.goodsnova_platform.meta_campaign_insights_daily`
  ADD COLUMN IF NOT EXISTS extended_metrics STRING;

-- First-class funnel columns already exist on this table
-- (add_to_cart, initiate_checkout, landing_page_views, purchases, purchase_value).
-- Refresh Meta / backfill populates them from Flyweel. Old rows stay NULL until overwritten.
