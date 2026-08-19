# Exact sGTM / BigQuery writer changes

Do this in **server GTM** `GTM-NJ4QCWFK` on the tag that writes
`stape_data.raw_events_full`. Additive only. Do not rename or remove
`source_client = {{Client Name}}`.

Do **not** replace Document ID `{{X-Stape-User-Id}}` in Stape Store.

## 1. ALTER TABLE (Editor in BigQuery)

```sql
ALTER TABLE `stape-analytics-487802.stape_data.raw_events_full`
  ADD COLUMN IF NOT EXISTS stape_user_id STRING,
  ADD COLUMN IF NOT EXISTS gn_uid STRING,
  ADD COLUMN IF NOT EXISTS hashed_email STRING,
  ADD COLUMN IF NOT EXISTS shopify_customer_id STRING,
  ADD COLUMN IF NOT EXISTS fbclid STRING,
  ADD COLUMN IF NOT EXISTS ttclid STRING,
  ADD COLUMN IF NOT EXISTS msclkid STRING,
  ADD COLUMN IF NOT EXISTS utm_source STRING,
  ADD COLUMN IF NOT EXISTS utm_medium STRING,
  ADD COLUMN IF NOT EXISTS utm_campaign STRING,
  ADD COLUMN IF NOT EXISTS utm_content STRING,
  ADD COLUMN IF NOT EXISTS utm_term STRING,
  ADD COLUMN IF NOT EXISTS is_new_customer BOOL,
  ADD COLUMN IF NOT EXISTS purchase_count INT64,
  ADD COLUMN IF NOT EXISTS session_count INT64,
  ADD COLUMN IF NOT EXISTS fb_first_click STRING,
  ADD COLUMN IF NOT EXISTS google_first_click STRING,
  ADD COLUMN IF NOT EXISTS meta_campaign_id STRING,
  ADD COLUMN IF NOT EXISTS meta_adset_id STRING,
  ADD COLUMN IF NOT EXISTS meta_ad_id STRING;

-- Optional: keep history longer than 60 days (warehouse lookbacks).
-- ALTER TABLE `stape-analytics-487802.stape_data.raw_events_full`
--   SET OPTIONS (partition_expiration_days = NULL);
```

Do **not** add plaintext `email`.

`user_id` already stores Shopify customer id on Data Client purchases. Still
add `shopify_customer_id` so the mapping is explicit when GA4 also starts
sending it.

## 2. BigQuery tag field map (append)

| BigQuery field | GTM variable / event data | Required |
|---|---|---|
| `stape_user_id` | `{{X-Stape-User-Id}}` (header `X-Stape-User-Id`) | yes |
| `gn_uid` | Event data / cookie `gn_uid` (same value written to cart attributes) | yes |
| `hashed_email` | `{{Hashed - Email}}` SHA-256 hex, lowercased email | yes |
| `shopify_customer_id` | Shopify customer id / existing user_id when known | yes |
| `fbclid` | Event `fbclid` or `{{gn_fbclid}}` | yes |
| `gclid` | Already a column; **populate it** (today 0%) from event or `{{gn_gclid}}` | yes |
| `gbraid` / `wbraid` | Event or `{{gn_gbraid}}` / `{{gn_wbraid}}` | yes |
| `ttclid` / `msclkid` | Event or gn_* equivalents | yes |
| `utm_source` … `utm_term` | Event or `{{gn_utm_*}}` (do not overwrite URL-parsed raw in warehouse) | yes |
| `meta_campaign_id` | Event / **session** cookie `gn_meta_campaign_id` — current click, **not** first-touch `gn_first_meta_*`. Do **not** map into `utm_campaign` | yes (after migration 006) |
| `meta_adset_id` | Event / session cookie `gn_meta_adset_id` | yes (after migration 006) |
| `meta_ad_id` | Event / session cookie `gn_meta_ad_id` | yes (after migration 006) |
| `is_new_customer` | `{{purchase_count}} == 1` (Stape Store email collection) | yes |
| `is_new_customer` | `{{purchase_count}} == 1` (Stape Store email collection) | yes |
| `purchase_count` | Stape Store `purchase_count` | yes |
| `session_count` | Stape Store `session_count` keyed by X-Stape-User-Id | no |
| `fb_first_click` | Stape Store `fb_first_click` | no |
| `google_first_click` | Stape Store `google_first_click` | no |
| `event_id` | Send on **GA4 client** too (today 0%) | yes |

## 2b. Meta identity columns (Phase 2 — PREPARED FOR IMPORT)

After `bigquery/migrations/2026_08_19_006_meta_touch_ids.sql`, map these on the **same** BigQuery writer tag. Do not overload `utm_campaign` / `utm_content`.

Web GTM (`GTM-MVWKFXH2`) must already send **session** `gn_meta_campaign_id` / `gn_meta_adset_id` / `gn_meta_ad_id` on GA4 + Data Tags (`docs/GTM_MANUAL_CHANGES.md`, click-by-click in the live workspace). Adding cookies on web does **not** automatically create BigQuery columns. Do **not** map `gn_first_meta_*` into these typed fields.

`gn_meta_*` cookies / Event Data are the **current active Meta session/click** with a 30-minute inactivity TTL. `gn_first_meta_*` is durable first-touch Shopify audit and must not be mapped into typed `meta_*`.

Same-session canonical ID disagreements are `SESSION_ID_CONFLICT`. Fact-parent disagreements are `META_HIERARCHY_CONFLICT`. Both unmap child Meta grains; channel Meta credit is never lost.

## 3. Recreate `dashboard_events` before 2026-10-11

The live view has `expiration_timestamp`. Recreate without expiry. Keep the
GA4-vs-Data-Client filter. Funnel SQL still nulls fbclid until the column
exists and `src/lib/stape/config.ts` is updated.

## 4. Web GTM (required for fill)

Server BQ already maps `gn_uid` / `gclid` ← `{{gn_gclid}}` / `fbclid` ← `{{gn_fbclid}}`.
Those Event Data keys stay empty until **web** GTM:

1. Setup-tags the stitch HTML before GA4/DT `page_view`
2. Writes first-touch click IDs to `gn_*` cookies (not only localStorage). Meta current-click IDs use `gn_meta_*` with a **30-minute inactivity TTL**; first-touch audit uses `gn_first_meta_*`.
3. Sends `gn_uid` + first-touch params on **all** GA4 events (`ga4 - shared_event_settings`) and all Data Tags. Session `gn_meta_*` (not `gn_first_meta_*`) become typed `meta_*`.

Click-by-click in the live workspace: `docs/GTM_MANUAL_CHANGES.md`. **DO NOT MERGE AN OLD EXPORT OVER A NEWER LIVE CONTAINER.** Do not change warehouse SQL until Query 1 fill jumps.

## 5. What not to change

- Stape Store keys (`X-Stape-User-Id`, hashed email collection)
- Existing `source_client`
- Production pixels / CAPI / Ads tags
- First-touch = Shopify cart `gn_*` / `gn_first_meta_*` (audit only; this feed only fills BQ session `meta_*`)
