# Shopify + Stape Analytics Dashboard

A Next.js dashboard for Shopify store data and Stape server-side tracking.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Connect Shopify

You need a Shopify Admin API connection. Shopify no longer shows a copy-paste token in Admin. Create a small app, then put three values in `.env.local`.

1. Open the [Shopify Dev Dashboard](https://dev.shopify.com/dashboard/).
2. Create an app named `Stape Shopify Dashboard`.
3. Create a version:
   - App URL: `https://shopify.dev/apps/default-app-home`
   - Scopes: `read_orders`, `read_products`, `read_customers`
   - Release the version
4. Install the app on your store.
5. Copy **Client ID** and **Client secret** from Settings.
6. Add these to `.env.local`:

```bash
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_CLIENT_ID=your-client-id
SHOPIFY_CLIENT_SECRET=your-client-secret
```

7. Restart `npm run dev`.

## Connect Stape (via BigQuery)

This dashboard reads the **existing** Stape pipeline in BigQuery, not a new empty table.

Live data lives in project `stape-analytics-487802`:

| Dataset / table | What it is |
|---|---|
| `stape_data.raw_events` | High volume, but only `event_name`, `client_id`, `transaction_id`, `value`, `currency` (no dates or URLs) |
| `stape_data.raw_events_full` | Full events including `page_location`, `purchase`, `begin_checkout` |
| `stape_data.dashboard_events` | Clean view over `raw_events_full` (dedupes GA4 vs Data Client). **This is what the dashboard uses.** |
| `stape_data.daily_funnel` | Daily funnel totals |
| `stape_shopify_dashboard.stape_events` | Newer test table. Schema is fine, but it only has recent `page_view` / `view_item` / `add_to_cart` test hits |

### 1. Service account key

1. Google Cloud Console → IAM & Admin → Service accounts
2. Create a service account (or reuse one Stape already uses)
3. Give it **BigQuery Data Viewer** and **BigQuery Job User**
4. Create a JSON key
5. Save it as `secrets/gcp-service-account.json` in this project (do not commit it)

### 2. Add BigQuery settings to `.env.local`

```bash
GOOGLE_CLOUD_PROJECT=stape-analytics-487802
BIGQUERY_DATASET=stape_data
BIGQUERY_TABLE=dashboard_events
BIGQUERY_LOCATION=US
GOOGLE_APPLICATION_CREDENTIALS=secrets/gcp-service-account.json
```

Restart `npm run dev`. Overview, Traffic, Conversions, and Attribution read `dashboard_events`.

## True Performance (first-touch + spend)

True Performance uses Shopify `gn_*` cart attributes as first-touch. Stape is shown as a comparison only.

### Meta spend

Facebook will not let this localhost dashboard log in the way Triple Whale does until your app appeal is approved. Until then, paste Ads Manager Amount spent or upload a Campaigns CSV. After the app is live, add `META_APP_ID` and `META_APP_SECRET` and use **Log in with Facebook**.

1. True Performance → set Today / Yesterday / 7d / 30d.
2. Ads Manager → Campaigns → same dates (Pacific time).
3. Type Amount spent, or Export CSV and upload it.
4. Press **Save Meta totals** or **Import CSV**.

Each date range is stored separately. Do not invent numbers.

Google spend is still pasted for the same date range:

```bash
GOOGLE_ADS_SPEND=
GOOGLE_ADS_PURCHASES=
GOOGLE_ADS_REVENUE=
```

ROAS stays **—** until spend is present.

Keep this on localhost until the product is in final form.

## Warehouse attribution

`/warehouse` is multi-model observed-click attribution from `raw_events_full`. It does **not** replace True Performance (`gn_*`).

SQL to create the `analytics` dataset (needs BigQuery Editor) lives in `bigquery/analytics/`. The app service account is read-only, so the page runs the same logic as SELECT until those views exist. Required sGTM column appends: `bigquery/analytics/GTM_CHANGES.md`.

Optional: `bigquery/create_stape_events.sql` and `bigquery/attribution_views.sql` are only for the separate test dataset.

Never commit `.env.local` or `secrets/`.

## Project structure

- `src/app/(dashboard)` — dashboard pages
- `src/components/layout` — sidebar, header, and shared layout pieces
- `src/lib/shopify` — Shopify connection and metrics
- `src/lib/stape` — Stape / BigQuery connection, traffic, and attribution
- `bigquery/` — SQL to create the events table and optional attribution views
