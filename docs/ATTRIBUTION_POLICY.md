# Attribution policy v1

Canonical contract: `src/lib/attribution/policy.ts` (`attribution_policy_v1`).

TypeScript engine: `src/lib/attribution/engine.ts` (debugger, fixtures, unit tests).

BigQuery production math: `src/lib/warehouse/get-warehouse-metrics.ts` and `bigquery/migrations/2026_08_18_002_attribution_credit.sql`.

If they disagree, tests fail.

## Unknown ≠ Direct

Missing tracking stays **Unknown** or **Unattributed**. It is never silently converted to Direct.

Direct is a real touch when the visit has no external referrer / self-referral / checkout noise.

## Eligible touches

In window, at or before purchase, de-duplicated by touchpoint id.

Checkout / `web-pixels@` paths classify as Direct (payment-domain noise).

Self-referral (referrer host = landing host) is Direct.

Dual GA4 + Data Client purchase copies collapse to one canonical `transaction_id`.

## Models

| Model | Formula |
| --- | --- |
| First touch | 100% earliest eligible touch (Direct may win). |
| Last touch | 100% latest eligible touch (Direct may win). |
| Last non-direct | 100% latest non-direct. If none, last Direct. |
| Linear | Equal split across **all** eligible touches including Direct. |
| Position based | 1 touch = 100%. 2 touches = 50/50. Else 40% first, 40% last, 20% split across middle. Index order, not hours-to-conversion. |
| Paid only | Equal split among paid touches. If none, unattributed (empty credit, not Direct). |
| Time decay | `weight_i = 2^(-hours_i / 168)` then normalize. Includes Direct. |

Assists (warehouse panel): touches that are neither first nor last on a 3+ touch path. Equal split among those middle touches. This is **not** Linear.

## Window

Supported in the app: 1 / 7 / 14 / 30 / 60 days.

Default: **7 days**. Validated 2026-08-19 (`bigquery/validation/11_conversion_lag_distribution.sql`): P50/P75/P90 = 0h, P95 = 3h, P99 = 69h, n = 69. Sub-hour conversions show as 0h (`TIMESTAMP_DIFF` hour grain).

90-day is hidden until `raw_events_full` retention covers it.

## Revenue

Shopify `currentTotalPriceSet` = net after refunds/discounts. Journeys stay attached; financial credit uses that net.

## New customers

Shopify `customer.numberOfOrders <= 1`. Fractional new-customer credit = touch weight × 1 under MTA.

Blended nCAC = total ad spend ÷ Shopify new-customer orders.

Attributed nCAC = grain spend ÷ fractional new-customer credit. Never mixed.

## MER

MER = Shopify revenue ÷ ad spend (e.g. 2.5).

Marketing cost ratio = ad spend ÷ Shopify revenue (e.g. 40%). Formerly mislabeled MER.
