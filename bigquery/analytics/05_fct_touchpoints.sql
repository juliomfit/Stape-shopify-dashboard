-- LEGACY — DO NOT RUN IN PRODUCTION
-- Old session-touch view that DROPPED real Direct unless a source/click id
-- existed. That contradicts attribution_policy_v1 (Real Direct is eligible).
-- Canonical touchpoints: src/lib/warehouse/sql.ts eligible_session_landing
-- and migration 005.

SELECT
  "DO_NOT_RUN" AS status,
  "bigquery/migrations/2026_08_18_005_canonical_attribution_credit_fix.sql" AS use_instead,
  "LEGACY — DO NOT RUN IN PRODUCTION" AS warning;
