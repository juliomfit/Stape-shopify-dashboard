# Manual production actions

Actions Julio must perform outside Cursor. Application code for these items is already in the repository unless noted.

Use checkboxes. Do not mark production verified without evidence.

# BigQuery — run in this exact order

Project: `stape-analytics-487802`. Cursor cannot run these.

## 1. Policy settings (001) — required — P0

- [ ] Run `bigquery/migrations/2026_08_18_001_attribution_policy.sql`
- Expected: `analytics.dim_attribution_settings` contains `attribution_policy_v1` with default lookback 7, `internal_noise_excluded=true`, `credit_view_is_credit_only=true`.
- Validation:

```sql
SELECT * FROM `stape-analytics-487802.analytics.dim_attribution_settings` ORDER BY setting_key;
```

- If validation fails: paste the full result. Do not run `bigquery/analytics/07_dim_attribution_settings.sql` (legacy 30-day overwrite; now a no-op).

## 2. Canonical credit view (005) — required — P0

002 is already live. Do **not** roll it back. 005 is `CREATE OR REPLACE VIEW`.

- [ ] Run `bigquery/migrations/2026_08_18_005_canonical_attribution_credit_fix.sql`
- Expected: view exists; columns include `credit`, `event_purchase_value`, `is_direct`. **No `net_revenue` / `attributed_revenue` from event value.**
- Validation immediately after, in order:

### 2a. Golden model parity (no customer data)

- [ ] Run `bigquery/validation/04_attribution_model_parity.sql`
- Expected: `mismatch_count = 0`
- If `mismatch_count != 0`: uncomment / run the mismatches select at the bottom of that file and paste every row.

### 2b. Credit integrity + rowcount

- [ ] Run `bigquery/validation/03_order_credit_integrity.sql`
- Expected: `orders_credit_ne_1 = 0` for models with touches; `paid_only` may have zero rows. After 005 there is **no** `net_revenue` / `attributed_revenue` column. If BigQuery says `Unrecognized name: net_revenue`, 005 was not applied.
- [ ] Run `bigquery/validation/11a_credit_view_rowcount.sql`
- Expected: `credit_rows` > 0 when `purchase_transaction_ids` > 0. If 0, paste 11a output (identity stitch likely broken).

### 2c. Conversion lag (re-run after canonicalization)

- [ ] Run `bigquery/validation/11_conversion_lag_distribution.sql`
- Expected: a lag distribution with `orders` > 0. Keep the **7-day default** unless P90/P99 clearly need 14/30. Do not mark PRODUCTION VERIFIED until this result is pasted.
- If it fails / returns 0 orders: paste the output; do not change the app window.

### 2d. Coverage (same date window)

- [ ] Run `bigquery/validation/07_attribution_coverage.sql`
- Expected: numeric `tracked_purchases`, `identity_match_rate`, `journey_match_rate`, `warehouse_attribution_coverage`, `unattributed_count`. `shopify_to_tracking_coverage` is NULL until a Shopify mirror exists — that is not 0% tracking.
- If it fails: paste the error and the SELECT output.

### 2e. Campaign mapping

- [ ] Run `bigquery/validation/05_meta_campaign_mapping_coverage.sql`
- Expected: counts for exact ID / unique name / ambiguous / unmapped and a `mapping_rate`. UI stays VALIDATION REQUIRED until you paste this.
- If it fails: paste the output. Do not invent ad-set/ad/creative OUR mapping.

### 2f. Refunds

- [ ] Run `bigquery/validation/06_refund_reconciliation.sql`
- Expected: status stating BigQuery-only refund recon **cannot be completed** until `analytics.fct_shopify_orders` is populated. App already uses Shopify Admin `currentTotalPriceSet`.
- If the query errors: paste the error. Do not treat event `value` as net revenue.

## 3. dashboard_events lifecycle (003) — required — P0

Canonical attribution does **not** use this view (it uses `raw_events_full`). 003 is for funnel + 400-day retention.

- [ ] Run `bigquery/migrations/2026_08_18_003_dashboard_events_lifecycle.sql`
- Expected: view has no expiration; identity columns coalesced (Data Client identity kept); `raw_events_full` `partition_expiration_days = 400`.
- Validation: `bigquery/validation/08_event_retention.sql`
- If it fails: paste 08 output.

## 4. Shopify history (004) — optional — P4

- [ ] Only if you want a BQ Shopify mirror for LTV/refund recon later.
- File: `bigquery/migrations/2026_08_18_004_shopify_history.sql`
- Expected: empty `analytics.fct_shopify_orders`.
- App LTV remains **Selected-history LTV (incomplete)** until this table is loaded.

# Web GTM / Server GTM / Meta CAPI / GA4

- [x] No changes. Do not publish GTM for this pass.

# Vercel

- [ ] Redeploy after merging this branch to `main`.
- [ ] No new env vars.

# After you paste validation results

Send back:

1. 04 `mismatch_count`
2. 11a `credit_rows` / `purchase_transaction_ids`
3. 11 lag P50/P75/P90/P95/P99 and n
4. 07 coverage rates
5. 05 mapping counts
6. 06 status line

If any query fails, paste the **full error plus the query filename**. Do not infer a fix from a screenshot of one number.
