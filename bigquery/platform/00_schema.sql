-- GoodsNova platform warehouse (Meta entities/insights, sync runs, daily business).
-- Run in BigQuery Editor if the dashboard service account cannot CREATE.
-- Grant the dashboard SA: BigQuery Data Editor + Job User on this dataset.
-- Do not mix these tables with First-touch (Shopify gn_*) or warehouse click models.

CREATE SCHEMA IF NOT EXISTS `stape-analytics-487802.goodsnova_platform`
OPTIONS (
  location = "US",
  description = "First-party platform: Meta Ads ingest, sync runs, semantic daily facts. Not Shopify first-touch."
);

CREATE TABLE IF NOT EXISTS `stape-analytics-487802.goodsnova_platform.sync_runs` (
  id STRING NOT NULL,
  source STRING NOT NULL,
  sync_type STRING NOT NULL,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  status STRING NOT NULL,
  records_requested INT64,
  records_inserted INT64,
  records_updated INT64,
  records_failed INT64,
  lookback_start DATE,
  lookback_end DATE,
  error_message STRING,
  metadata STRING
);

CREATE TABLE IF NOT EXISTS `stape-analytics-487802.goodsnova_platform.meta_campaigns` (
  account_id STRING NOT NULL,
  campaign_id STRING NOT NULL,
  campaign_name STRING,
  objective STRING,
  status STRING,
  effective_status STRING,
  buying_type STRING,
  created_time TIMESTAMP,
  updated_time TIMESTAMP,
  start_time TIMESTAMP,
  stop_time TIMESTAMP,
  daily_budget FLOAT64,
  lifetime_budget FLOAT64,
  source_payload STRING,
  first_seen_at TIMESTAMP,
  last_seen_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `stape-analytics-487802.goodsnova_platform.meta_adsets` (
  account_id STRING NOT NULL,
  campaign_id STRING,
  adset_id STRING NOT NULL,
  adset_name STRING,
  status STRING,
  effective_status STRING,
  optimization_goal STRING,
  billing_event STRING,
  bid_strategy STRING,
  daily_budget FLOAT64,
  lifetime_budget FLOAT64,
  attribution_spec STRING,
  promoted_object STRING,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  created_time TIMESTAMP,
  updated_time TIMESTAMP,
  first_seen_at TIMESTAMP,
  last_seen_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `stape-analytics-487802.goodsnova_platform.meta_ads` (
  account_id STRING NOT NULL,
  campaign_id STRING,
  adset_id STRING,
  ad_id STRING NOT NULL,
  ad_name STRING,
  status STRING,
  effective_status STRING,
  creative_id STRING,
  created_time TIMESTAMP,
  updated_time TIMESTAMP,
  first_seen_at TIMESTAMP,
  last_seen_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `stape-analytics-487802.goodsnova_platform.meta_creatives` (
  account_id STRING,
  creative_id STRING NOT NULL,
  name STRING,
  title STRING,
  body STRING,
  image_url STRING,
  thumbnail_url STRING,
  video_id STRING,
  object_story STRING,
  destination_url STRING,
  call_to_action STRING,
  source_payload STRING,
  first_seen_at TIMESTAMP,
  last_seen_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `stape-analytics-487802.goodsnova_platform.meta_campaign_insights_daily` (
  date DATE NOT NULL,
  account_id STRING NOT NULL,
  campaign_id STRING NOT NULL,
  campaign_name STRING,
  spend FLOAT64,
  impressions INT64,
  reach INT64,
  frequency FLOAT64,
  clicks INT64,
  inline_link_clicks INT64,
  unique_clicks INT64,
  cpc FLOAT64,
  cpm FLOAT64,
  ctr FLOAT64,
  purchases FLOAT64,
  purchase_value FLOAT64,
  add_to_cart FLOAT64,
  initiate_checkout FLOAT64,
  landing_page_views FLOAT64,
  actions_json STRING,
  action_values_json STRING,
  synced_at TIMESTAMP,
  sync_run_id STRING
)
PARTITION BY date
CLUSTER BY account_id, campaign_id;

CREATE TABLE IF NOT EXISTS `stape-analytics-487802.goodsnova_platform.meta_adset_insights_daily` (
  date DATE NOT NULL,
  account_id STRING NOT NULL,
  campaign_id STRING,
  adset_id STRING NOT NULL,
  adset_name STRING,
  spend FLOAT64,
  impressions INT64,
  reach INT64,
  frequency FLOAT64,
  clicks INT64,
  inline_link_clicks INT64,
  purchases FLOAT64,
  purchase_value FLOAT64,
  actions_json STRING,
  action_values_json STRING,
  synced_at TIMESTAMP,
  sync_run_id STRING
)
PARTITION BY date
CLUSTER BY account_id, adset_id;

CREATE TABLE IF NOT EXISTS `stape-analytics-487802.goodsnova_platform.meta_ad_insights_daily` (
  date DATE NOT NULL,
  account_id STRING NOT NULL,
  campaign_id STRING,
  adset_id STRING,
  ad_id STRING NOT NULL,
  ad_name STRING,
  spend FLOAT64,
  impressions INT64,
  reach INT64,
  frequency FLOAT64,
  clicks INT64,
  inline_link_clicks INT64,
  purchases FLOAT64,
  purchase_value FLOAT64,
  ctr FLOAT64,
  cpc FLOAT64,
  cpm FLOAT64,
  actions_json STRING,
  action_values_json STRING,
  synced_at TIMESTAMP,
  sync_run_id STRING
)
PARTITION BY date
CLUSTER BY account_id, ad_id;

CREATE TABLE IF NOT EXISTS `stape-analytics-487802.goodsnova_platform.meta_actions_daily` (
  date DATE NOT NULL,
  account_id STRING NOT NULL,
  campaign_id STRING,
  adset_id STRING,
  ad_id STRING,
  reporting_level STRING NOT NULL,
  action_kind STRING NOT NULL,
  action_type STRING NOT NULL,
  action_value FLOAT64,
  synced_at TIMESTAMP,
  sync_run_id STRING
)
PARTITION BY date
CLUSTER BY account_id, reporting_level, action_type;

CREATE TABLE IF NOT EXISTS `stape-analytics-487802.goodsnova_platform.meta_ad_insights_breakdown_daily` (
  date DATE NOT NULL,
  account_id STRING NOT NULL,
  ad_id STRING NOT NULL,
  breakdown_type STRING NOT NULL,
  breakdown_value STRING NOT NULL,
  spend FLOAT64,
  impressions INT64,
  reach INT64,
  clicks INT64,
  purchases FLOAT64,
  purchase_value FLOAT64,
  synced_at TIMESTAMP,
  sync_run_id STRING
)
PARTITION BY date
CLUSTER BY account_id, breakdown_type;

CREATE TABLE IF NOT EXISTS `stape-analytics-487802.goodsnova_platform.analytics_anomalies` (
  id STRING NOT NULL,
  metric STRING NOT NULL,
  entity_type STRING,
  entity_id STRING,
  current_value FLOAT64,
  baseline_value FLOAT64,
  delta_percent FLOAT64,
  severity STRING,
  detected_at TIMESTAMP,
  resolved_at TIMESTAMP,
  context STRING
);

CREATE TABLE IF NOT EXISTS `stape-analytics-487802.goodsnova_platform.analytics_change_log` (
  id STRING NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  type STRING,
  title STRING,
  description STRING,
  entity_type STRING,
  entity_id STRING,
  metadata STRING,
  created_by STRING
);

CREATE TABLE IF NOT EXISTS `stape-analytics-487802.goodsnova_platform.daily_business_metrics` (
  date DATE NOT NULL,
  currency STRING,
  gross_revenue FLOAT64,
  discounts FLOAT64,
  refunds FLOAT64,
  net_revenue FLOAT64,
  orders INT64,
  new_customer_orders INT64,
  returning_customer_orders INT64,
  new_customer_revenue FLOAT64,
  returning_customer_revenue FLOAT64,
  meta_spend FLOAT64,
  google_spend FLOAT64,
  total_ad_spend FLOAT64,
  processing_fees FLOAT64,
  contribution_profit FLOAT64,
  contribution_margin FLOAT64,
  mer FLOAT64,
  blended_roas FLOAT64,
  aov FLOAT64,
  source STRING,
  synced_at TIMESTAMP
)
PARTITION BY date;

CREATE TABLE IF NOT EXISTS `stape-analytics-487802.goodsnova_platform.raw_ga4_metrics` (
  date STRING,
  sessions FLOAT64,
  purchases FLOAT64,
  purchase_revenue FLOAT64,
  engaged_sessions FLOAT64,
  engagement_rate FLOAT64,
  bounce_rate FLOAT64,
  avg_session_seconds FLOAT64,
  new_users FLOAT64,
  active_users FLOAT64,
  add_to_carts FLOAT64,
  checkouts FLOAT64,
  views FLOAT64,
  property_id STRING,
  stream_id STRING,
  synced_at TIMESTAMP,
  source_payload STRING
);

CREATE TABLE IF NOT EXISTS `stape-analytics-487802.goodsnova_platform.raw_ga4_sources` (
  date STRING,
  source STRING,
  medium STRING,
  campaign STRING,
  sessions FLOAT64,
  purchases FLOAT64,
  purchase_revenue FLOAT64,
  property_id STRING,
  stream_id STRING,
  synced_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `stape-analytics-487802.goodsnova_platform.raw_ga4_breakdowns` (
  date STRING,
  kind STRING,
  label STRING,
  sessions FLOAT64,
  purchases FLOAT64,
  purchase_revenue FLOAT64,
  extra FLOAT64,
  property_id STRING,
  stream_id STRING,
  synced_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `stape-analytics-487802.goodsnova_platform.openai_usage` (
  id STRING NOT NULL,
  created_at TIMESTAMP NOT NULL,
  model STRING,
  input_tokens INT64,
  output_tokens INT64,
  tool_calls INT64,
  latency_ms INT64,
  estimated_usd FLOAT64
);

-- Daily supplier COGS (one USD total per Pacific day; Julio types it).
-- Multiple inserts per date: latest updated_at wins. Never copy typicalCogs here.
CREATE TABLE IF NOT EXISTS `stape-analytics-487802.goodsnova_platform.raw_cogs_daily` (
  date DATE NOT NULL,
  amount FLOAT64 NOT NULL,
  note STRING,
  updated_at TIMESTAMP NOT NULL
);
