-- LEGACY — DO NOT RUN IN PRODUCTION
-- QA against the old analytics.fct_* / last_paid views.
-- Canonical validation pack: bigquery/validation/03, 04, 05, 06, 07, 11, 11a.

SELECT
  "DO_NOT_RUN" AS status,
  "bigquery/validation/" AS use_instead,
  "LEGACY — DO NOT RUN IN PRODUCTION" AS warning;
