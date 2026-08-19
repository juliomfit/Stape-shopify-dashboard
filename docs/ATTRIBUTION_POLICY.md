# Attribution policy v1

Canonical contract: `src/lib/attribution/policy.ts` (`attribution_policy_v1`).

TypeScript engine: `src/lib/attribution/engine.ts` + `src/lib/attribution/eligibility.ts`.

Runtime journeys: `getCanonicalAttributedOrders()` (`src/lib/warehouse/canonical-orders.ts`).

BigQuery credit view: `bigquery/migrations/2026_08_18_005_canonical_attribution_credit_fix.sql` (forward fix after 002). The view is **credit-only**. Shopify `currentTotalPriceSet` is money truth in the app.

If TypeScript and SQL disagree, tests fail.

## Canonical grain

```
raw_events_full → identity → canonical GA4 sessions → one eligible acquisition
touch per session → orders → attribution_policy_v1 → fractional credit →
Shopify money → channel/campaign metrics
```

Touchpoint id is derived from the canonical session, not `transactionId-index`.
Multiple events in one session (page_view, add_to_cart, begin_checkout, purchase)
collapse to one touch. Checkout must not overwrite a Meta/organic/direct session.

`getAttributionMetrics()` is **legacy event-grain diagnostics** (health / data-quality /
first-touch Stape comparison). It must not power Models, Journeys, Overview
comparison, or the order debugger.

## Direct vs internal noise vs Unknown

| Concept | Meaning | Eligible? |
| --- | --- | --- |
| Real Direct | Storefront session, no external referrer, no paid click id, no attributable source | Yes (FT/LT/linear/position/time-decay). Last Non-Direct skips it when a non-direct exists. |
| Internal noise | `/checkout`, `/checkouts/`, `web-pixels@`, payment-processor referrers, own-domain navigation that is not a new acquisition | **No. Not Direct.** |
| Unknown | No reliable eligible touch | **Never coerced to Direct** |

## Models

| Model | Formula |
| --- | --- |
| First touch | 100% earliest eligible touch (Direct may win). |
| Last touch | 100% latest eligible touch (Direct may win). |
| Last non-direct | 100% latest non-direct. If none, last Direct. |
| Linear | Equal split across **all** eligible touches including Real Direct. |
| Position based | 1 touch = 100%. 2 touches = 50/50. Else 40% first, 40% last, 20% split across middle. |
| Paid only | Equal split among paid touches. If none, unattributed (empty credit, not Direct). |
| Time decay | `weight_i = 2^(-hours_i / 168)` then normalize. Includes Direct. |

Assists: middle touches on a 3+ path. Not Linear.

## Window

Supported: 1 / 7 / 14 / 30 / 60 days. Default **7 days**.

Prior lag (2026-08-19, old touch grain): P90=0h P99=69h n=69. **Re-run query 11 after migration 005** before marking PRODUCTION VERIFIED. Do not auto-promote 14/30.

## Revenue

Shopify `currentTotalPriceSet` = net after refunds/discounts. Event `value` is `event_purchase_value` (QA only). Journeys stay attached when refunds change the net.

## New customers / nCAC / ROAS

- Blended nCAC = total ad spend ÷ Shopify new-customer orders.
- Attributed nCAC = grain spend ÷ fractional new-customer credit (mapping HIGH/PARTIAL only).
- Shopify MER = Shopify revenue ÷ paid spend.
- Our Paid ROAS = paid-channel attributed revenue ÷ paid spend. Do not divide all-channel attributed revenue by paid spend.

## Campaign mapping

Exact campaign ID, then exact unique normalized name, else unmapped. Duplicate names are `ambiguous_name`. No fuzzy match. Campaign is the deepest OUR first-party grain until ad-set/ad IDs exist on touches. Flyweel Campaign → Ad Set → Ad → Creative is **Meta platform** reporting.
