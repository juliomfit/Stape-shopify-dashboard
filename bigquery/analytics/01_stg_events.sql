-- LEGACY — DO NOT RUN IN PRODUCTION
-- Pre-policy_v1 staging sketch. Canonical events for attribution are read
-- on-the-fly from stape_data.raw_events_full in src/lib/warehouse/sql.ts.

SELECT
  "DO_NOT_RUN" AS status,
  "src/lib/warehouse/sql.ts" AS use_instead,
  "LEGACY — DO NOT RUN IN PRODUCTION" AS warning;
