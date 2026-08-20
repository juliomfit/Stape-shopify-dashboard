# Flyweel Meta metric historical backfill

Old `meta_campaign_insights_daily` rows were ingested with the 10-metric Flyweel baseline. They do **not** already contain extended funnel/video/quality fields.

After this deploy:

1. Confirm Preview can Refresh Meta (campaign grain).
2. `ensurePlatformTables()` adds nullable columns (`conversions`, `unique_ctr`, `outbound_clicks`, `extended_metrics`). Migration `007` is the same ALTER for operators who prefer SQL.
3. Run a controlled backfill for the dashboard ranges you care about (Today through 30d / this month). The app already exposes this:

```http
POST /api/meta/sync
{ "startDate": "2026-07-22", "endDate": "2026-08-20" }
```

Limit: **93 Pacific days per request**. For longer history, run adjacent windows.

`replaceDateWindow` deletes then re-inserts that account/date slice, so backfilled days get the new first-class fields plus `extended_metrics` JSON. Dates you do not backfill keep historical baseline rows; new columns stay NULL (`—` in the grid).

Do not invent Meta Platform values from Shopify, GA4, or GoodsNova attribution while backfilling.
