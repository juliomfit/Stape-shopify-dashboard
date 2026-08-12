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
6. Create `.env.local` in the project root:

```bash
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_CLIENT_ID=your-client-id
SHOPIFY_CLIENT_SECRET=your-client-secret
```

7. Restart `npm run dev`.

The Overview and Sales pages will then show last-30-day revenue, orders, and top products. Conversion Rate and Traffic stay empty until Stape is connected.

Never commit `.env.local`. It contains secrets.

## Project structure

- `src/app/(dashboard)` — dashboard pages
- `src/components/layout` — sidebar, header, and shared layout pieces
- `src/lib/shopify` — Shopify connection and metrics
- `src/lib/stape` — Stape types and client (not connected yet)
