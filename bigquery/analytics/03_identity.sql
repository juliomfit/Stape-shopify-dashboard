-- LEGACY — DO NOT RUN IN PRODUCTION
-- Pre-policy_v1 identity sketch. Canonical identity is dim_person in
-- src/lib/warehouse/sql.ts and migration 005 (cust:/email:/gn:/stape:/cid:).

SELECT
  "DO_NOT_RUN" AS status,
  "src/lib/warehouse/sql.ts dim_person" AS use_instead,
  "LEGACY — DO NOT RUN IN PRODUCTION" AS warning;
