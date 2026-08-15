-- Flyweel / provider-agnostic Meta additions. Safe to re-run.
-- Does not drop existing tables. Extra columns use IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS `stape-analytics-487802.goodsnova_platform.meta_accounts` (
  account_id STRING NOT NULL,
  account_name STRING,
  currency STRING,
  timezone STRING,
  platform STRING,
  provider STRING,
  first_seen_at TIMESTAMP,
  last_seen_at TIMESTAMP,
  raw_source STRING
);

CREATE TABLE IF NOT EXISTS `stape-analytics-487802.goodsnova_platform.meta_insights_breakdowns_daily` (
  date DATE NOT NULL,
  account_id STRING NOT NULL,
  campaign_id STRING,
  adset_id STRING,
  ad_id STRING,
  reporting_level STRING,
  breakdown_type STRING NOT NULL,
  breakdown_value STRING NOT NULL,
  spend FLOAT64,
  impressions INT64,
  reach INT64,
  clicks INT64,
  purchases FLOAT64,
  purchase_value FLOAT64,
  provider STRING,
  synced_at TIMESTAMP,
  sync_run_id STRING
)
PARTITION BY date
CLUSTER BY account_id, breakdown_type;

ALTER TABLE `stape-analytics-487802.goodsnova_platform.meta_campaigns`
  ADD COLUMN IF NOT EXISTS provider STRING;
ALTER TABLE `stape-analytics-487802.goodsnova_platform.meta_adsets`
  ADD COLUMN IF NOT EXISTS provider STRING;
ALTER TABLE `stape-analytics-487802.goodsnova_platform.meta_ads`
  ADD COLUMN IF NOT EXISTS provider STRING;
ALTER TABLE `stape-analytics-487802.goodsnova_platform.meta_creatives`
  ADD COLUMN IF NOT EXISTS provider STRING;
ALTER TABLE `stape-analytics-487802.goodsnova_platform.meta_campaign_insights_daily`
  ADD COLUMN IF NOT EXISTS provider STRING;
ALTER TABLE `stape-analytics-487802.goodsnova_platform.meta_adset_insights_daily`
  ADD COLUMN IF NOT EXISTS provider STRING;
ALTER TABLE `stape-analytics-487802.goodsnova_platform.meta_ad_insights_daily`
  ADD COLUMN IF NOT EXISTS provider STRING;
ALTER TABLE `stape-analytics-487802.goodsnova_platform.meta_actions_daily`
  ADD COLUMN IF NOT EXISTS provider STRING;
ALTER TABLE `stape-analytics-487802.goodsnova_platform.meta_actions_daily`
  ADD COLUMN IF NOT EXISTS metadata STRING;
