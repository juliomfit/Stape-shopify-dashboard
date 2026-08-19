# Manual production actions

Actions Julio must perform outside Cursor. Application code for these items is already in the repository unless noted.

Use checkboxes. Do not mark production verified without evidence.

# BigQuery

- [ ] **001 Attribution policy settings** — required? yes — priority: P0
  - Reason: Persist the canonical window/weight contract in the warehouse.
  - Action: Run `bigquery/migrations/2026_08_18_001_attribution_policy.sql` in project `stape-analytics-487802`.
  - Expected: `analytics.dim_attribution_settings` contains `attribution_policy_v1` rows; default lookback 7.
  - Validation: `SELECT * FROM \`stape-analytics-487802.analytics.dim_attribution_settings\` ORDER BY setting_key;`
  - App code complete: yes (app does not require this table at runtime).

- [x] **002 Attribution credit view** — required? done for current revision — priority: P0
  - Reason: Warehouse-scale credit matching the TypeScript engine.
  - Action: Re-run `bigquery/migrations/2026_08_18_002_attribution_credit.sql` (CREATE OR REPLACE VIEW). (1) Do not select `fbc` — it is not a column. (2) The first working view still returned 0 credit rows because Data Client orders used `cust:` person keys and GA4 sessions used `cid:` keys. This revision stitches via `dim_person` like the dashboard warehouse SQL.
  - Expected: View exists. `bigquery/validation/11a_credit_view_rowcount.sql` shows `credit_rows` > 0 when `purchase_transaction_ids` > 0.
  - Validation: `11a` then `03_order_credit_integrity.sql` then `11_conversion_lag_distribution.sql`.
  - App code complete: yes (dashboard on-the-fly SQL already uses dim_person; missing/empty view does not 500).

- [ ] **003 dashboard_events lifecycle + retention** — required? yes — priority: P0
  - Reason: View expires 2026-10-11; partitions ~60 days block 60d+ windows.
  - Action: Run `bigquery/migrations/2026_08_18_003_dashboard_events_lifecycle.sql`.
  - Expected: `dashboard_events` has no expiration; `raw_events_full` partition_expiration_days = 400; identity columns on the view.
  - Validation: `bigquery/validation/08_event_retention.sql`
  - App code complete: yes. After this, 60-day window is honest; 90-day stays hidden until retained_days ≥ 90.

- [ ] **004 Shopify history table** — required? no (optional) — priority: P4
  - Reason: Future matured LTV beyond Admin API pagination.
  - Action: Run `bigquery/migrations/2026_08_18_004_shopify_history.sql` when you want a warehouse copy.
  - Expected: Empty `analytics.fct_shopify_orders`.
  - Validation: `SELECT COUNT(*) FROM \`stape-analytics-487802.analytics.fct_shopify_orders\`;`
  - App code complete: table unused by the app yet (Admin API is money truth).

- [x] **Conversion-lag default** — required? done — priority: P1
  - Reason: Choose production window from real lag.
  - Action: Ran `bigquery/validation/11_conversion_lag_distribution.sql` after dim_person 002.
  - Result (2026-08-19): P50=0 P75=0 P90=0 P95=3 P99=69 hours, orders=69. Keep **7d** default.
  - App code complete: yes. Default remains 7 days.

- [ ] **Meta campaign mapping coverage (touch grain)** — required? yes before trusting campaign OUR nCAC — priority: P3
  - Reason: First 05 run used purchase-event URLs. 72 purchases, 39 with fbclid, **0 with utm_campaign on the purchase row** (expected: checkout), **1** Meta campaign fact row in range.
  - Action: Re-run updated `bigquery/validation/05_meta_campaign_mapping_coverage.sql` (measures campaign on credited touches, not checkout URLs).
  - Expected: `orders_with_campaign_on_touch` / `touch_campaign_rate` / `orders_with_meta_paid_touch`.
  - App code complete: yes (`campaign-map.ts` joins only on id/name). UI still says VALIDATION REQUIRED until this re-run.

# Web GTM

- [x] No Web GTM changes required.
  - Stitch-fill for GTM-MVWKFXH2 is already published. Shop Pay still does not run stitch HTML (known). Do not re-import stitch-fill.

# Server GTM

- [x] No Server GTM changes required for this release.
  - Writer GTM-NJ4QCWFK already lands `stape_data.raw_events_full`. Identity columns are consumed; if fill is still empty that is the existing writer gap documented in `bigquery/analytics/GTM_CHANGES.md`, not a new change.

# Shopify

- [ ] None required for pagination (app now requests up to 100 pages / 10,000 orders).
- [ ] Optional: confirm `read_customers` scope if Customers/LTV shows a scope error.

# Meta

- [ ] None. Reuse Flyweel `goodsnova_platform` facts. Do not build a second pipeline.

# Vercel

- [ ] Redeploy after merging this branch to `main` (Cursor cannot publish `main` unless you ask).
- [ ] No new env vars required. Do not set placeholder `GOOGLE_CLOUD_PROJECT` in cloud agent VMs.

# Other

- [ ] Paste touch-grain campaign mapping results from updated `05`; the UI will keep saying VALIDATION REQUIRED for campaign coverage until then. Conversion-lag default is already 7d.
