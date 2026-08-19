-- LEGACY — DO NOT RUN IN PRODUCTION
-- Historical optional views on stape_shopify_dashboard.stape_events.
-- Canonical attribution uses stape_data.raw_events_full +
-- bigquery/migrations/2026_08_18_005_canonical_attribution_credit_fix.sql.

SELECT
  "DO_NOT_RUN" AS status,
  "bigquery/migrations/2026_08_18_005_canonical_attribution_credit_fix.sql" AS use_instead,
  "LEGACY — DO NOT RUN IN PRODUCTION" AS warning;
