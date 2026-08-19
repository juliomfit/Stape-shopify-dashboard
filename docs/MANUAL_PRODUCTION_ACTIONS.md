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

- [ ] **002 Attribution credit view** — required? yes for production validation — priority: P0
  - Reason: Warehouse-scale credit matching the TypeScript engine.
  - Action: Re-run `bigquery/migrations/2026_08_18_002_attribution_credit.sql` (CREATE OR REPLACE VIEW). The first version selected `fbc`, which is **not** a column on `raw_events_full` (`Unrecognized name: fbc`). Meta is detected from `fbclid` + URL `fbclid` only.
  - Expected: View `analytics.v_attribution_credit_v1` exists. No `Unrecognized name: fbc`.
  - Validation: `bigquery/validation/03_order_credit_integrity.sql` → zero `orders_credit_ne_1` for models other than paid_only.
  - App code complete: yes (dashboard already computes this on the fly; missing view does not 500).

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

- [ ] **Conversion-lag default** — required? yes before promoting window default — priority: P1
  - Reason: 7-day default is temporary.
  - Action: Re-run `bigquery/validation/11_conversion_lag_distribution.sql` after 002. The first version referenced `order_timestamp` / `touchpoint_timestamp`, which are **not** on the view. Use `hours_to_conversion` (already on `v_attribution_credit_v1`).
  - Expected: P50/P75/P90/P95/P99 hours plus an order count.
  - Validation: same file.
  - App code complete: yes; UI labeled VALIDATION REQUIRED.

- [ ] **Meta campaign mapping coverage** — required? yes before trusting campaign OUR nCAC — priority: P3
  - Reason: UI must not invent coverage %.
  - Action: Run `bigquery/validation/05_meta_campaign_mapping_coverage.sql`.
  - Expected: counts of fbclid / utm_campaign / Meta campaigns. Coverage stays VALIDATION REQUIRED until you record the result.
  - App code complete: yes (`src/lib/attribution/campaign-map.ts` joins only on id/name match).

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

- [ ] Paste validation query results anywhere you want them recorded; the UI will keep saying VALIDATION REQUIRED until then.
