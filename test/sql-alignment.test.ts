import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { POLICY_RULES } from "../src/lib/attribution/policy.ts";
import { ATTRIBUTION_WINDOW_PRODUCTION_DEFAULT_STATUS } from "../src/lib/attribution/windows.ts";

const warehouse = readFileSync("src/lib/warehouse/sql.ts", "utf8");
const channelSql = readFileSync("src/lib/stape/channel-sql.ts", "utf8");
const creditFix = readFileSync(
  "bigquery/migrations/2026_08_18_005_canonical_attribution_credit_fix.sql",
  "utf8",
);
const settingsLegacy = readFileSync(
  "bigquery/analytics/07_dim_attribution_settings.sql",
  "utf8",
);
const fctLegacy = readFileSync("bigquery/analytics/08_fct_attribution.sql", "utf8");
const policy001 = readFileSync(
  "bigquery/migrations/2026_08_18_001_attribution_policy.sql",
  "utf8",
);

test("warehouse SQL and migration 005 share canonical eligibility markers", () => {
  for (const body of [warehouse, creditFix]) {
    assert.match(body, /is_internal_noise/);
    assert.match(body, /is_touch_eligible/);
    assert.match(body, /event_purchase_value/);
    assert.match(body, /CAST\(NULL AS STRING\) AS fbc/);
    assert.match(body, /eligible_session_landing/);
    assert.equal(body.includes("NULLIF(fbc,"), false);
    assert.doesNotMatch(body, /e\.value AS net_revenue/);
  }
});

test("CHANNEL_SQL does not classify checkout as Direct", () => {
  assert.match(channelSql, /INTERNAL_NOISE_SQL/);
  assert.match(channelSql, /ELSE 'Unknown'/);
  assert.match(channelSql, /NOT LIKE '%\/checkout%'/);
  assert.equal(
    channelSql.includes("OR page_location LIKE '%/checkout%'\n      THEN 'Direct'"),
    false,
  );
});

test("policy checkout wording is internal noise, not Direct", () => {
  assert.match(POLICY_RULES.checkoutExclusion, /internal noise/i);
  assert.doesNotMatch(POLICY_RULES.checkoutExclusion, /classify as Direct/i);
  assert.match(POLICY_RULES.unknownIsNotDirect, /NEVER BECOME DIRECT/i);
});

test("legacy settings SQL cannot overwrite dim_attribution_settings", () => {
  assert.match(settingsLegacy, /LEGACY — DO NOT RUN IN PRODUCTION/);
  assert.doesNotMatch(settingsLegacy, /INSERT INTO/);
  assert.doesNotMatch(settingsLegacy, /"default_lookback_days", "30"/);
  assert.match(fctLegacy, /LEGACY — DO NOT RUN IN PRODUCTION/);
  assert.doesNotMatch(fctLegacy, /CREATE OR REPLACE VIEW/);
});

test("migration 001 settings match corrected policy", () => {
  assert.match(policy001, /internal_noise_excluded/);
  assert.match(policy001, /real_direct_is_eligible/);
  assert.match(policy001, /credit_view_is_credit_only/);
  assert.match(policy001, /"default_lookback_days", "7"/);
  assert.match(policy001, /Re-run query 11 after migration 005/);
});

test("legacy analytics SQL cannot create competing attribution objects", () => {
  for (const file of [
    "bigquery/analytics/01_stg_events.sql",
    "bigquery/analytics/02_dim_channel_rules.sql",
    "bigquery/analytics/03_identity.sql",
    "bigquery/analytics/04_fct_sessions.sql",
    "bigquery/analytics/05_fct_touchpoints.sql",
    "bigquery/analytics/06_fct_orders.sql",
    "bigquery/analytics/07_dim_attribution_settings.sql",
    "bigquery/analytics/08_fct_attribution.sql",
    "bigquery/analytics/09_marts.sql",
    "bigquery/analytics/14_qa.sql",
    "bigquery/attribution_views.sql",
  ]) {
    const body = readFileSync(file, "utf8");
    assert.match(body, /LEGACY — DO NOT RUN IN PRODUCTION/);
    assert.match(body, /DO_NOT_RUN/);
    assert.doesNotMatch(body, /^CREATE /m);
    assert.doesNotMatch(body, /^INSERT /m);
  }
});

test("credit-only validation 03 does not treat event value as net_revenue", () => {
  const body = readFileSync("bigquery/validation/03_order_credit_integrity.sql", "utf8");
  assert.doesNotMatch(body, /orders_revenue_mismatch/);
  assert.match(body, /CREDIT ONLY/);
  assert.match(body, /SUM\(credit\)/);
});

test("migration 005 has no last_paid and no event-value attributed_revenue", () => {
  assert.doesNotMatch(creditFix, /last_paid/);
  assert.doesNotMatch(creditFix, /attributed_revenue/);
  assert.match(creditFix, /paidsearch\|paid_search/);
  assert.match(creditFix, /klaviyo/);
});

test("runtime and 005 share Real Direct empty-referrer storefront rule", () => {
  assert.match(channelSql, /NOT LIKE '%\/checkout%'/);
  assert.match(creditFix, /NOT LIKE "%\/checkout%"/);
  assert.match(warehouse, /is_direct/);
  assert.match(creditFix, /channel = "Direct" AND NOT is_internal_noise AS is_direct/);
});

test("legacy event queries alias fbc as CAST NULL, never raw_events_full.fbc", () => {
  for (const file of [
    "src/lib/stape/get-attribution-metrics.ts",
    "src/lib/stape/get-funnel-metrics.ts",
    "src/lib/stape/get-traffic-metrics.ts",
  ]) {
    const body = readFileSync(file, "utf8");
    assert.match(body, /CAST\(NULL AS STRING\) AS fbc/);
    assert.doesNotMatch(body, /IFNULL\(e\.fbc,/);
    assert.doesNotMatch(body, /IFNULL\(fbc, ''\) AS fbc/);
  }
});

test("warehouse SQL extracts gn_meta_* from page_location and does not require typed columns", () => {
  assert.match(warehouse, /REGEXP_EXTRACT\(page_location, r"\[\?&\]gn_meta_campaign_id=/);
  assert.match(warehouse, /REGEXP_EXTRACT\(page_location, r"\[\?&\]gn_meta_adset_id=/);
  assert.match(warehouse, /REGEXP_EXTRACT\(page_location, r"\[\?&\]gn_meta_ad_id=/);
  assert.match(warehouse, /REGEXP_EXTRACT\(page_location, r"\[\?&\]utm_content=/);
  assert.match(warehouse, /AS first_content/);
  assert.match(warehouse, /l\.first_content AS content/);
  assert.match(warehouse, /meta_campaign_id_conflict/);
  assert.match(warehouse, /ORDER BY e\.event_timestamp, IFNULL\(e\.event_id, ""\) LIMIT 1/);
  assert.doesNotMatch(creditFix, /gn_meta_campaign_id/);
});

test("validation 15 is order-grain mapping rates, not events divided by orders", () => {
  const body = readFileSync("bigquery/validation/15_meta_attribution_mapping.sql", "utf8");
  assert.match(body, /meta_attributed_orders/);
  assert.match(body, /campaign_mapped_orders/);
  assert.match(body, /campaign_unmapped_orders/);
  assert.match(body, /campaign_mapping_rate/);
  assert.match(body, /adset_mapped_orders/);
  assert.match(body, /ad_mapped_orders/);
  assert.match(body, /hierarchy_conflict/);
  assert.match(body, /ON t\.touchpoint_id = mo\.touchpoint_id/);
  assert.match(body, /GREATEST\(0, LEAST\(1,/);
  assert.doesNotMatch(body, /events_with_campaign_id/);
  assert.doesNotMatch(body, /campaign_id_events_per_meta_order/);
});

test("validation 17 joins credited touchpoint_id and returns violation counts", () => {
  const body = readFileSync("bigquery/validation/17_meta_credit_reconciliation.sql", "utf8");
  assert.match(body, /campaign_mapped_credit/);
  assert.match(body, /campaign_unmapped_credit/);
  assert.match(body, /adset_parent_mismatch/);
  assert.match(body, /ad_parent_mismatch/);
  assert.match(body, /hierarchy_violations/);
  assert.match(body, /adset_exceeds_parent_campaign/);
  assert.match(body, /ON t\.touchpoint_id = c\.touchpoint_id/);
  assert.match(body, /TO_HEX\(SHA256\(CONCAT\(e\.session_key, CAST\(s\.session_start AS STRING\)\)\)\)/);
  assert.doesNotMatch(body, /campaign_mapped_credit_sql_unknown_until_ids/);
  assert.doesNotMatch(body, /ORDER BY s\.session_start DESC, s\.session_key DESC/);
});

test("validation 17a synthetic linear A/Organic/B keeps per-touch IDs", () => {
  const body = readFileSync("bigquery/validation/17a_linear_meta_touch_ids.sql", "utf8");
  assert.match(body, /a_keeps_a/);
  assert.match(body, /b_keeps_b/);
  assert.match(body, /b_not_assigned_to_a/);
  assert.match(body, /hierarchy_violations/);
});

test("7-day default is pending revalidation after canonicalization", () => {
  assert.equal(
    ATTRIBUTION_WINDOW_PRODUCTION_DEFAULT_STATUS,
    "7d pending revalidation after canonicalization",
  );
});

test("winner-take-all SQL uses ROW_NUMBER with touchpoint_id tie-break", () => {
  const warehouseRuntime = readFileSync(
    "src/lib/warehouse/get-warehouse-metrics.ts",
    "utf8",
  );
  const parity = readFileSync("bigquery/validation/04_attribution_model_parity.sql", "utf8");
  for (const body of [creditFix, warehouseRuntime, parity]) {
    assert.match(body, /WHEN "first_touch" THEN ROW_NUMBER\(\) OVER/);
    assert.match(body, /ORDER BY ot\.touchpoint_timestamp ASC, ot\.touchpoint_id ASC/);
    assert.match(body, /ORDER BY ot\.touchpoint_timestamp DESC, ot\.touchpoint_id DESC/);
    assert.match(body, /IF\(NOT ot\.is_direct, 0, 1\), ot\.touchpoint_timestamp DESC, ot\.touchpoint_id DESC/);
    assert.doesNotMatch(
      body,
      /model_name = "first_touch"\s+AND ot\.touchpoint_timestamp = MIN/,
    );
  }
  assert.match(parity, /STRUCT\("K", "K-order"/);
  assert.match(parity, /same-timestamp/);
});

test("validation 11a tells Julio to re-run migration 005, not 002", () => {
  const body = readFileSync("bigquery/validation/11a_credit_view_rowcount.sql", "utf8");
  assert.match(body, /Re-run migration 005/);
  assert.doesNotMatch(body, /Re-run migration 002/);
});

test("migration 003 explicitly clears dashboard_events view expiration", () => {
  const body = readFileSync(
    "bigquery/migrations/2026_08_18_003_dashboard_events_lifecycle.sql",
    "utf8",
  );
  assert.match(
    body,
    /CREATE OR REPLACE VIEW `stape-analytics-487802\.stape_data\.dashboard_events` AS[\s\S]*?;\s*ALTER VIEW `stape-analytics-487802\.stape_data\.dashboard_events`\s+SET OPTIONS \(expiration_timestamp = NULL\);/,
  );
  assert.match(body, /ALTER VIEW[\s\S]*expiration_timestamp = NULL/);
});
