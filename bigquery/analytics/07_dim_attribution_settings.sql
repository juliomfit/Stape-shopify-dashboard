-- LEGACY — DO NOT RUN IN PRODUCTION
-- This file previously CREATE OR REPLACE TABLE + INSERT of conflicting
-- 30-day / 28/90-day / logic_version v1 settings into
-- analytics.dim_attribution_settings. Running it would overwrite
-- attribution_policy_v1 (migration 001).
-- Canonical settings: bigquery/migrations/2026_08_18_001_attribution_policy.sql

SELECT
  "DO_NOT_RUN" AS status,
  "bigquery/migrations/2026_08_18_001_attribution_policy.sql" AS use_instead,
  "LEGACY — DO NOT RUN IN PRODUCTION" AS warning;
