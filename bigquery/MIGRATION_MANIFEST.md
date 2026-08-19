# BigQuery migration manifest

Status values: `PREPARED` | `USER MUST RUN` | `USER REPORTED COMPLETE` | `VALIDATION PENDING` | `VALIDATED`

Do not mark `VALIDATED` without production query evidence.

| ID | FILE | PURPOSE | DEPENDENCIES | APP DEPENDENCY | SAFE TO RE-RUN | STATUS |
| --- | --- | --- | --- | --- | --- | --- |
| 001 | `bigquery/migrations/2026_08_18_001_attribution_policy.sql` | Canonical policy settings (7d, Direct/internal noise, credit-only) | analytics dataset | No. Documents windows/weights. | YES | USER MUST RUN |
| 002 | `bigquery/migrations/2026_08_18_002_attribution_credit.sql` | Original credit view (may already be live) | 001, `raw_events_full` | No. Superseded by 005. | YES | USER REPORTED COMPLETE |
| 003 | `bigquery/migrations/2026_08_18_003_dashboard_events_lifecycle.sql` | Recreate `dashboard_events` (coalesce identity); extend `raw_events_full` retention to 400 days | `raw_events_full` | Funnel still reads `dashboard_events`. Canonical attribution stays on `raw_events_full`. | YES | USER MUST RUN |
| 004 | `bigquery/migrations/2026_08_18_004_shopify_history.sql` | Optional Shopify order fact table for future LTV/refund recon | analytics dataset | No. App uses Admin API. | YES | PREPARED |
| 005 | `bigquery/migrations/2026_08_18_005_canonical_attribution_credit_fix.sql` | Forward CREATE OR REPLACE VIEW: session-touch grain, Real Direct, internal noise excluded, credit-only (`event_purchase_value`, not `net_revenue`) | 002 already applied | No. App on-the-fly SQL matches. View is for validation. | YES | USER MUST RUN |

## Execution order (this correctness pass)

1. 001 (if not yet run)
2. 005 (required — 002 is already live; do not roll 002 back)
3. 003 (retention + dashboard_events identity coalesce)
4. 004 (optional; skip unless you want a Shopify BQ mirror)

## Validation pack (after 005)

Run in this order. Nothing is VALIDATED until you paste results.

1. `bigquery/validation/04_attribution_model_parity.sql` — expect `mismatch_count = 0`
2. `bigquery/validation/03_order_credit_integrity.sql`
3. `bigquery/validation/11a_credit_view_rowcount.sql` — `credit_rows` > 0 when purchases > 0
4. `bigquery/validation/11_conversion_lag_distribution.sql` — **re-run**; prior 7d lag used the old grain
5. `bigquery/validation/07_attribution_coverage.sql` — same start/end; warehouse rates vs tracked orders
6. `bigquery/validation/05_meta_campaign_mapping_coverage.sql` — mapping methods, not ad-set/ad
7. `bigquery/validation/06_refund_reconciliation.sql` — will say BQ-only recon cannot complete until Shopify mirror exists
8. `bigquery/validation/08_event_retention.sql` — after 003

Do **not** run `bigquery/analytics/07_dim_attribution_settings.sql`,
`08_fct_attribution.sql`, `02_dim_channel_rules.sql`, `05_fct_touchpoints.sql`,
`06_fct_orders.sql`, `09_marts.sql`, or `14_qa.sql`. They are LEGACY no-ops.
