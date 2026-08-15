# GoodsNova platform layer

Sources still stay labeled. This layer does **not** replace True Performance (`gn_*`),
Shopify Attribution, or the Stape warehouse click models.

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

## Meta setup

1. Meta Developers → app → Marketing API.
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

Hourly Meta refresh upserts **today + previous 7 days** (8 Pacific days) when you
press Refresh or when cron runs. Vercel **Hobby** cron is **once per day**
(`0 15 * * *` UTC). Use Refresh Meta anytime.

Paste/CSV on True Performance still wins for **blended** Overview spend when present.

## Google Ads / GA4

Google Ads API is not wired (needs a developer token). Paste totals remain the
source. Cron records health only.

GA4 Data API runs when `GA4_PROPERTY_ID` is set and the service account can read
that property. sGTM BigQuery remains the event warehouse.

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
