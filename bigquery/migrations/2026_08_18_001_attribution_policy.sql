-- PURPOSE: Canonical attribution_policy_v1 settings (windows, models, weights).
-- TYPE OF CHANGE: CREATE TABLE IF NOT EXISTS + idempotent MERGE of settings
-- PROJECT: stape-analytics-487802
-- DATASET: analytics
-- OBJECTS AFFECTED: analytics.dim_attribution_settings
-- DESTRUCTIVE: NO
-- SAFE TO RE-RUN: YES
-- DEPENDENCIES: analytics dataset (bigquery/analytics/00_dataset.sql)
-- EXPECTED RESULT: Settings rows for policy v1. 90-day window is stored but not
--   exposed in the app until raw_events_full retention covers it.
-- ROLLBACK STRATEGY: DELETE WHERE setting_key LIKE 'policy_v1_%';
-- VALIDATION QUERY: bigquery/validation/04_attribution_model_parity.sql

CREATE SCHEMA IF NOT EXISTS `stape-analytics-487802.analytics`
OPTIONS (location = "US");

CREATE TABLE IF NOT EXISTS `stape-analytics-487802.analytics.dim_attribution_settings` (
  setting_key STRING,
  setting_value STRING,
  value_type STRING,
  description STRING
);

MERGE `stape-analytics-487802.analytics.dim_attribution_settings` AS t
USING (
  SELECT * FROM UNNEST([
    STRUCT("policy_id" AS setting_key, "attribution_policy_v1" AS setting_value, "string" AS value_type, "Canonical contract id. TypeScript engine and warehouse SQL must match." AS description),
    STRUCT("default_lookback_days", "7", "int", "Provisional after canonicalization. Re-run query 11 after migration 005. Do not mark PRODUCTION VERIFIED until that re-run."),
    STRUCT("lookback_days_options", "1,7,14,30,60", "int_list", "Windows the app may expose. 90 omitted until retention covers it."),
    STRUCT("time_decay_half_life_hours", "168", "float", "weight = POW(2, -hours_to_purchase / 168)"),
    STRUCT("position_first_weight", "0.4", "float", "Position-based first touch (index 1)"),
    STRUCT("position_last_weight", "0.4", "float", "Position-based last touch"),
    STRUCT("position_middle_weight", "0.2", "float", "Remainder split equally across middle touches"),
    STRUCT("revenue_definition", "net_after_refund", "string", "Shopify currentTotalPriceSet. Event value is event_purchase_value, not net_revenue."),
    STRUCT("unknown_is_not_direct", "true", "bool", "Missing tracking stays Unknown. Never coerce to Direct."),
    STRUCT("real_direct_is_eligible", "true", "bool", "Storefront empty-referrer Direct is eligible for FT/LT/linear/position/time-decay."),
    STRUCT("internal_noise_excluded", "true", "bool", "Checkout, web-pixels@, payment processors, own-domain self-referral are not Direct and not touches."),
    STRUCT("credit_view_is_credit_only", "true", "bool", "v_attribution_credit_v1 exposes credit, not Shopify money."),
    STRUCT("linear_includes_direct", "true", "bool", "Direct is an eligible touch for linear/position/time_decay."),
    STRUCT("view_through", "false", "bool", "No view-through. Impressions are not person-level touches."),
    STRUCT("logic_version", "attribution_policy_v1", "string", "Must match src/lib/attribution/policy.ts")
  ])
) AS s
ON t.setting_key = s.setting_key
WHEN MATCHED THEN UPDATE SET
  setting_value = s.setting_value,
  value_type = s.value_type,
  description = s.description
WHEN NOT MATCHED THEN INSERT (setting_key, setting_value, value_type, description)
VALUES (s.setting_key, s.setting_value, s.value_type, s.description);
