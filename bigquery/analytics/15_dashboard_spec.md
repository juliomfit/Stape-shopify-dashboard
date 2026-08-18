# Dashboard specification — Warehouse Attribution

Path: `/warehouse`

This page is **not** First-touch (`gn_*`). First-touch stays Shopify `gn_*`
first-touch. This page is warehouse observed-click models (`attribution_policy_v1`).

## Controls (do not change Shopify order totals)

- Header date range (Pacific) — order window
- Attribution model: First Touch, Last Touch, Last Non-Direct, Last Paid,
  Linear, Position Based, Time Decay, First Paid
- Lookback: 1 / 7 / 14 / 30 / 60 days in the app (90-day hidden until `raw_events_full` retention covers it; see `attribution_policy_v1`)
- Optional: channel, confidence

Changing model reallocates `credit` / `attributed_revenue` only.

## Overview KPIs

From `fct_orders` (canonical, model-invariant):

- Revenue, Orders, AOV
- New / Returning when `is_new_customer` exists; else Shopify join on `legacyId`

From `fct_attribution` (selected model):

- Attributed revenue / orders
- Attribution coverage % (orders with a credited non-unknown touch)
- High-confidence attribution %
- Direct % / Unknown %

## Charts / tables

- Top acquiring channels = first_touch (always shown)
- Top closing = last_non_direct
- Top assisting = linear minus first and last
- Cross-channel journeys from `customer_journey`
- Time / sessions / touches to conversion
- Platform compare: warehouse_* vs platform_reported_* (paste/API). Never mixed.

## Attribution quality (required)

`/warehouse` health panel and Data quality page:

- % orders with transaction_id, person_id, hashed_email, gn_uid, stape_user_id
- % paid sessions with click IDs
- % Meta sessions with fbclid; % Google with gclid/gbraid/wbraid
- % purchases with a pre-purchase session
- % revenue high-confidence vs unattributed
- duplicate purchase event count
- identity collision count
- late events

Until GTM appends identity columns, gn_uid / hashed_email / stape_user_id
rates are **0% in BigQuery**. Shopify `gn_uid` on the order is shown separately
as storefront identity, not as a BQ column.
