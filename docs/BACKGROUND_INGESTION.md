# Background ingestion and dashboard reads

GoodsNova Analytics is a **read-optimized product**. Provider work is background-only.

```
PROVIDERS (Meta / Shopify / GA4 / Stape events)
        ↓
BACKGROUND INGESTION (Vercel Cron + POST /api/meta/refresh after())
        ↓
BIGQUERY prepared facts
        ↓
NEXT.JS DATA CACHE (tagged ~45s, last-known-good fallback)
        ↓
DASHBOARD RENDER
```

Dashboard pages never sit above Flyweel, Shopify Admin synchronization, or GA4 Data API pulls.

## Source schedules

Production freshness uses **independent** jobs. `source=all` is admin-only (`GET /api/cron/sync?source=all`).

| Job | Path | Cron (UTC) | maxDuration | What it does |
|---|---|---|---|---|
| Meta | `/api/cron/meta` | `0 14 * * *` | 300s | Incremental Flyweel campaign insights (today + yesterday) |
| Shopify | `/api/cron/shopify` | `0 15 * * *` | 120s | Incremental MERGE into `analytics.fct_shopify_orders` (3-day overlap) |
| GA4 | `/api/cron/ga4` | `0 16 * * *` | 60s | Data API pull when `GA4_PROPERTY_ID` is set |
| Stape | `/api/cron/stape` | `0 17 * * *` | 60s | Health/freshness only — events already stream into BigQuery |
| Daily recon | `/api/cron/daily` | `0 18 * * *` | 300s | Parallel Meta + Shopify 30-day overlap + GA4/Stape if configured |

Stape is **not** an event backfill. Do not "sync" `raw_events_full` on a timer.

**Verified deploy limitation:** the connected Vercel Git integration rejected sub-daily expressions (`*/5`, hourly) at deploy time and linked the Hobby cron docs. Production freshness is therefore independent **daily** jobs, staggered by hour (Hobby may invoke anywhere inside the hour). Manual `POST /api/meta/refresh` still returns HTTP 202 immediately. Do not put `*/5` back in `vercel.json` until a Pro (or otherwise sub-daily) Vercel project actually accepts that deploy.

Google Ads has no cron: the API is not wired.

## Read architecture

Normal page loads:

1. Period from cookies (outside `unstable_cache`)
2. Tagged loaders: Shopify overview, Stape funnel, Meta campaign facts, canonical orders
3. Assemble KPIs in `getCoreDashboardForPeriod` (not Data-Cache wrapped — paste/COGS use cookie `durable-json`)
4. If a live read fails, `cachedLoad` returns in-memory last-known-good

`getCanonicalAttributedOrders()` remains the only attribution definition. Overview cards use that result plus Shopify/Meta facts. Do not add a second warehouse attribution math layer.

## Shopify pipeline

Canonical mirror: **`analytics.fct_shopify_orders`** (migration 004 + additive 008). Do not create a competing order fact table.

1. Webhook `POST /api/shopify/webhooks` HMAC-verifies, GraphQL-fetches that order, MERGE, invalidates Shopify cache
2. Incremental cron: created_at window + updated_at overlap (refunds on older orders)
3. Coverage checkpoint (`analytics.shopify_ingest_coverage`) advances only after a non-truncated created_at window. Cookie durable-json is **not** used for this checkpoint — Vercel cron cookies never reach dashboard readers.
4. Reads query `fct_shopify_orders` for the header range. Existing fact rows are served even before the coverage checkpoint is written. Admin GraphQL is the fallback only when the table is missing, the query fails, or the range is empty **and** uncovered.
5. Production must not crash if the table is missing.

Financial truth: `currentTotalPriceSet` net of refunds. New-customer truth: Shopify `numberOfOrders <= 1`. Guest: no customer.

## Meta pipeline

1. Manual: `POST /api/meta/refresh` → validate → `after(runScheduledSync("meta"))` → **HTTP 202** `{ ok, message: "Meta refresh started" }`
2. Worker: `POST /api/meta/sync` still awaits the job (backfill / ops)
3. Cron: `/api/cron/meta` awaits the worker (the cron **is** the worker)
4. Overlap: `findActiveSyncRun("meta")` + cookie lock (not a distributed lock) → HTTP 409 `Meta sync already running`
5. Persist campaign facts only. Flyweel adset/ad grains are unsupported. Campaign-shaped rows cannot populate child tables.

## Cache behavior

| Source success | Tags expired |
|---|---|
| Meta | `meta`, `dashboard-core`, `health`, `attribution` |
| Shopify | `shopify`, `dashboard-core`, `health`, `attribution` |
| Stape | `stape`, `warehouse`, `dashboard-core`, `health` |
| GA4 | `ga4`, `health` |

Hard expire (`{ expire: 0 }`) on manual refresh. SWR (`"max"`) on cron.

## Manual refresh

Target enqueue time: **< 1 second**. The browser must not wait 90s for Flyweel.

Keep inFlight UI, pending, HTTP 409, recent-running guard, stale-running detection.

Header poller (`/api/freshness` every 45s) calls `router.refresh()` when `version` changes. The JSON path does not query Flyweel or heavy analytics. If Meta or Shopify has never succeeded and BigQuery is ready, the handler may enqueue a first fill with `after()` so Hobby daily crons are not the only way to populate an empty warehouse after deploy.

Public `GET /api/build` returns the deployed git SHA without login. Operator `GET /api/cron/status` (bearer `CRON_SECRET`) returns Shopify warehouse census + sync timestamps.

## Failure behavior

- Failed current refresh must not erase last-known-good dashboard data
- Do not advance Shopify coverage or Meta checkpoints on failed jobs
- MERGE by `order_id` is idempotent
- Stale `sync_runs.status=running` older than the source window is not "syncing"

## Freshness states

`fresh` | `syncing` | `delayed` | `stale` | `unavailable`

Provider health (Flyweel connected, campaign facts present) is **not** the same as data freshness. Campaign reporting can be healthy/partial when adset/ad native IDs are unavailable.

## Vercel configuration

- `vercel.json` lists the five crons above
- `CRON_SECRET` bearer auth on cron routes
- Refresh + Meta cron `maxDuration = 300`
- Next.js 16.3 `after()` from `next/server` for post-response work
- Cookie `durable-json` is not a distributed lock

## BigQuery objects

| Object | Role |
|---|---|
| `goodsnova_platform.meta_campaign_insights_daily` | Meta campaign spend / platform purchases |
| `goodsnova_platform.sync_runs` | Sync state |
| `analytics.fct_shopify_orders` | Prepared Shopify orders |
| `analytics.shopify_ingest_coverage` | Shopify warehouse date-coverage checkpoint (cron → dashboard) |
| `stape_data.raw_events_full` | Tracking evidence (continuous) |
| Canonical attribution | Computed in app from events + Shopify money |

## Performance targets (warm)

| Surface | Preferred |
|---|---|
| Overview | ≤ 1.5s |
| Sales | ≤ 1.5s |
| Meta | ≤ 2s |
| Attribution Overview | ≤ 2.5s |
| Journeys | ≤ 3s |
| Manual refresh enqueue | < 1s |

Do not raise HTTP timeouts to hide page latency. A slow provider job is acceptable; a slow dashboard page is not.
