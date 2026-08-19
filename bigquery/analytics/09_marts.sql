-- LEGACY — DO NOT RUN IN PRODUCTION
-- Old marts (customer_journey, last_paid / first_paid channel credit).
-- Canonical models are the seven in attribution_policy_v1. App journeys:
-- getCanonicalAttributedOrders(). Credit view: migration 005.

SELECT
  "DO_NOT_RUN" AS status,
  "src/lib/warehouse/canonical-orders.ts" AS use_instead,
  "LEGACY — DO NOT RUN IN PRODUCTION" AS warning;
