# BigQuery migration manifest

Status values: `PREPARED` | `USER MUST RUN` | `USER REPORTED COMPLETE` | `VALIDATION PENDING` | `VALIDATED`

Do not mark `VALIDATED` without production query evidence.

| ID | FILE | PURPOSE | DEPENDENCIES | APP DEPENDENCY | SAFE TO RE-RUN | STATUS |
| --- | --- | --- | --- | --- | --- | --- |
| 001 | `bigquery/migrations/2026_08_18_001_attribution_policy.sql` | Canonical policy settings | analytics dataset | No. Documents windows/weights. | YES | USER MUST RUN |
| 002 | `bigquery/migrations/2026_08_18_002_attribution_credit.sql` | Order credit view matching TypeScript engine | 001, `raw_events_full` | No. App computes the same math in warehouse SQL. View is for validation/marts. | YES | USER REPORTED COMPLETE |
| 003 | `bigquery/migrations/2026_08_18_003_dashboard_events_lifecycle.sql` | Recreate `dashboard_events` without expiry; extend `raw_events_full` retention to 400 days | `raw_events_full` | Recommended. Funnel still reads `dashboard_events`. 60d windows need retention. | YES | USER MUST RUN |
| 004 | `bigquery/migrations/2026_08_18_004_shopify_history.sql` | Optional Shopify order fact table for future matured LTV backfill | analytics dataset | No. App uses Admin API (now paginated to 10k orders). | YES | PREPARED |

## Execution order

1. 001
2. 002
3. 003
4. 004 (optional)

## Validation pack

Run after 002/003:

1. `bigquery/validation/08_event_retention.sql`
2. `bigquery/validation/01_shopify_vs_bigquery_orders.sql`
3. `bigquery/validation/02_identity_coverage.sql`
4. `bigquery/validation/03_order_credit_integrity.sql`
5. `bigquery/validation/11a_credit_view_rowcount.sql`
6. `bigquery/validation/11_conversion_lag_distribution.sql`
7. `bigquery/validation/05_meta_campaign_mapping_coverage.sql`

Conversion lag (query 11, 2026-08-19): P50/P75/P90=0h, P95=3h, P99=69h, n=69. Production default **7d** is validated.

Campaign mapping: purchase-event grain 2026-08-01–19 is 39/72 fbclid, 0/72 utm_campaign on checkout URLs, 1 Meta campaign fact row. Re-run updated `05` for touch-grain rates. UI must not invent a live campaign-coverage %.
