-- LEGACY — DO NOT RUN IN PRODUCTION
-- Pre-policy_v1 session sketch. Canonical sessions/touches are in
-- src/lib/warehouse/sql.ts (GA4-client only, one eligible acquisition touch).

SELECT
  "DO_NOT_RUN" AS status,
  "src/lib/warehouse/sql.ts sessions / eligible_session_landing" AS use_instead,
  "LEGACY — DO NOT RUN IN PRODUCTION" AS warning;
