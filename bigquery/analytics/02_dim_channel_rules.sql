-- LEGACY — DO NOT RUN IN PRODUCTION
-- Historical dim_channel_rules + v_channel_classified with a different
-- Direct/paid taxonomy than attribution_policy_v1.
-- Canonical channel CASE: src/lib/stape/channel-sql.ts (CHANNEL_SQL) used by
-- src/lib/warehouse/sql.ts and
-- bigquery/migrations/2026_08_18_005_canonical_attribution_credit_fix.sql.

SELECT
  "DO_NOT_RUN" AS status,
  "src/lib/stape/channel-sql.ts CHANNEL_SQL" AS use_instead,
  "LEGACY — DO NOT RUN IN PRODUCTION" AS warning;
