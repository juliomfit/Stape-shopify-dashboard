-- LEGACY — DO NOT RUN IN PRODUCTION
-- Old warehouse attribution with a hard-coded 30-day window, last_paid /
-- first_paid / paid_last_click, and Direct excluded from linear when a
-- non-direct touch exists. Superseded by attribution_policy_v1:
--   src/lib/warehouse/sql.ts
--   bigquery/migrations/2026_08_18_005_canonical_attribution_credit_fix.sql
-- Running this would create conflicting views (v_order_touches / fct_attribution).

SELECT
  "DO_NOT_RUN" AS status,
  "bigquery/migrations/2026_08_18_005_canonical_attribution_credit_fix.sql" AS use_instead,
  "LEGACY — DO NOT RUN IN PRODUCTION" AS warning;
