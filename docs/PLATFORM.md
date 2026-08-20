# GoodsNova platform layer

Sources still stay labeled. This layer does **not** replace First-touch (`gn_*`),
Shopify Attribution, or the Stape warehouse click models.

Page-by-page sources: `docs/SOURCE_MATRIX.md`.

```
Meta / Shopify / Google paste / GA4 Data API / Stape BQ
        → ingestion (cron + Refresh buttons)
        → goodsnova_platform (raw/normalized) + local cache
        → semantic formulas (src/lib/metrics/formulas.ts)
        → dashboard
        → optional GPT tools
```

## BigQuery

Run `bigquery/platform/00_schema.sql` as an Editor.

Grant the dashboard service account **BigQuery Data Editor** + **Job User** on
`goodsnova_platform` (Viewer is enough for Stape reads, not for Meta writes).

If INSERT fails, sync still stores `secrets/meta-insights-cache.json` (localhost)
or a cookie payload (Vercel, size-limited) and records `sync_runs` locally.

```
Flyweel (Meta OAuth inside Flyweel)
        → GoodsNova backend (FLYWEEL_API_KEY)
        → goodsnova_platform BigQuery
        → semantic formulas
        → dashboard / optional GPT tools
```

Cursor's Flyweel MCP OAuth session is **not** production auth. Vercel must have `FLYWEEL_API_KEY`.

## Flyweel production setup

1. In Flyweel, connect Meta Ads (Facebook OAuth) and select the GoodsNova ad account.
2. Settings → API & MCP → generate `fwl_…` key.
   Ignore Claude / Cursor / VS Code mcp.json. That is editor chat, not GoodsNova.
3. Set on Vercel (server only, never `NEXT_PUBLIC_`, never commit to git):
   - `FLYWEEL_API_KEY`
   - `FLYWEEL_META_ACCOUNT_ID` (numeric act id, not the display name)
   - optional `FLYWEEL_MCP_URL` (default `https://api.flyweel.co/functions/v1/mcp-server/mcp`)
   - `FLYWEEL_INGEST_LEVELS=all` does **not** enable ad set/ad facts. Flyweel `query_metrics` ads dimensions are campaign-grain only (`channel`, `account`, `campaign`, `campaign_id`, `campaign_status`, `objective`, `currency`, `date`, `week`, `month`). Production `campaign_id` values are Flyweel UUIDs, not Meta `{{campaign.id}}`. Do not populate `meta_adset_insights_daily` / `meta_ad_insights_daily` from campaign rows.
4. Run `bigquery/platform/00_schema.sql` and `01_flyweel.sql`.
5. Press **Refresh Meta**. Dashboard reads BigQuery/cache only.

If `FLYWEEL_API_KEY` is missing, ingest falls back to Meta Graph OAuth/token when those exist.

Read-only: GoodsNova never calls `connect_ad_platform`. `select_ad_accounts` runs only when `FLYWEEL_SELECT_ON_REFRESH=1` (off by default). Meta is never paused, edited, or created from this app.

Query limits: Flyweel `query_metrics` caps at 500 rows. Incremental Refresh Meta queries **today and yesterday as separate Flyweel days**, campaign grain, and keeps rows with spend. A 7-day date×campaign query hits the 500-row cap and fills with $0 campaigns — do not use that shape. `src/lib/ads/providers/chunk.ts` still splits long Graph ranges.

Hobby cron remains daily (`0 15 * * *` UTC). Use Refresh Meta for on-demand. `POST /api/meta/sync` `maxDuration` is **300s**. Verify the deployed Production runtime accepts maxDuration=300. Skip BigQuery DELETE while the streaming buffer is hot. Vercel cookie `durable-json` is not a global lock; warehouse `sync_runs` is the concurrency guard.

## Meta setup

1. Preferred: Flyweel key as above.
2. Fallback: Meta Developers → app → Marketing API.
2. Add Facebook Login. Valid OAuth redirect:
   `https://YOUR_DOMAIN/api/meta/callback`
   (also `META_REDIRECT_URI` / `META_OAUTH_REDIRECT_URI`).
3. Permissions: `ads_read` (and `ads_management` if the app already requested it).
4. Set `META_APP_ID`, `META_APP_SECRET` on Vercel.
5. Set `CRON_SECRET`. Vercel Cron calls `/api/cron/sync` daily at 15:00 UTC
   (Hobby cannot run hourly crons). Pro can change `vercel.json` to `0 * * * *`.
   Vercel sends `Authorization: Bearer CRON_SECRET`.
6. Integrations → Log in with Facebook → pick ad account → **Refresh Meta**.
7. First backfill: Integrations date pickers, max 93 Pacific days.

Hourly Meta refresh is **not** an 8-day lookback. Incremental ingest is Pacific **today + yesterday**. Vercel **Hobby** cron is **once per day**
(`0 15 * * *` UTC). Use Refresh Meta anytime.

Overview / First-touch / Warehouse **Meta spend** reads `meta_campaign_insights_daily` (same as `/meta`) when warehouse rows or a successful sync exist. Google paste is labeled separately. Paste does **not** override warehouse Meta.

## Google Ads / GA4

Google Ads API is not wired (needs a developer token). Paste totals remain the
source. Cron records health only.

GA4 Data API runs when `GA4_PROPERTY_ID` is set and the service account can read
that property (Analyst via Admin API if the GA4 UI rejects the service account email).
Enable **Google Analytics Data API** on the GCP project that owns `GOOGLE_SERVICE_ACCOUNT_JSON`
(the project id in the Refresh GA4 error URL). Optional `GA4_STREAM_ID` filters web-only.
sGTM BigQuery remains the event warehouse. First-touch stays `gn_*`.

Refresh GA4 uses the **header date range** (max 93 Pacific days) and writes
`raw_ga4_metrics`, `raw_ga4_sources`, `raw_ga4_breakdowns`. Pages read BigQuery only.

## Shopify

Live Admin API is unchanged. Optional webhook URL:

`https://YOUR_DOMAIN/api/shopify/webhooks`

HMAC: `SHOPIFY_WEBHOOK_SECRET` or `SHOPIFY_CLIENT_SECRET`.
Topics: `orders/create`, `orders/updated`, `orders/cancelled`, `refunds/create`.

## GPT

Set `OPENAI_API_KEY`. Tools call the same importers and metric formulas.
GPT cannot pause ads, change budgets, or delete data.

## Troubleshooting

| Symptom | Check |
|---|---|
| Connect button missing | `META_APP_ID` + `META_APP_SECRET` |
| OAuth error | Redirect URI exact match, app mode, ads_read |
| Sync running forever | Lock TTL 12 minutes in `secrets/sync-locks.json` |
| BQ insert errors | Dataset exists, SA is Data Editor |
| Cron 401 | `CRON_SECRET` on Production |
| AI disabled | Expected without `OPENAI_API_KEY` |
