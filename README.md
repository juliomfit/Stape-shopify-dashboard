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
   - Scopes: `read_orders`, `read_products`
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

This dashboard reads first-party Stape events from a **new** BigQuery table, so Facebook and Google traffic stay clean and separate from older tables.

### 1. Create the table

In Google Cloud Console → BigQuery, run `bigquery/create_stape_events.sql`.

That creates dataset `stape_shopify_dashboard` and table `stape_events`.

### 2. Create a service account key

1. Google Cloud Console → IAM & Admin → Service accounts
2. Create a service account (or reuse one Stape already uses)
3. Give it **BigQuery Data Viewer** and **BigQuery Job User**
4. Create a JSON key
5. Save it as `secrets/gcp-service-account.json` in this project (do not commit it)

### 3. Add BigQuery settings to `.env.local`

```bash
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
BIGQUERY_DATASET=stape_shopify_dashboard
BIGQUERY_TABLE=stape_events
BIGQUERY_LOCATION=US
GOOGLE_APPLICATION_CREDENTIALS=secrets/gcp-service-account.json
```

### 4. Send Stape events into that table

In Stape / server GTM:

1. Enable the **Google Service Account** power-up and upload a key that can write to BigQuery (**BigQuery Data Editor**)
2. Add the **Write to BigQuery** tag
3. Point it at project / `stape_shopify_dashboard` / `stape_events`
4. Use **Custom Data** (or All Event Data if names already match) for:
   `timestamp`, `event_name`, `event_id`, `client_id`, `ga_session_id`, `page_location`, `page_referrer`, `gclid`, `fbclid`, `fbp`, `fbc`
5. Enable **Add Event Timestamp**
6. Trigger on all events (or at least `page_view` and `purchase`)
7. Publish the container

Restart `npm run dev`. Overview and Traffic will show sessions once rows appear in the table.

Never commit `.env.local` or `secrets/`.

## Project structure

- `src/app/(dashboard)` — dashboard pages
- `src/components/layout` — sidebar, header, and shared layout pieces
- `src/lib/shopify` — Shopify connection and metrics
- `src/lib/stape` — Stape / BigQuery connection and traffic metrics
- `bigquery/` — SQL to create the new events table
