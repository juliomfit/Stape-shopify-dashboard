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
  ADD COLUMN IF NOT EXISTS google_first_click STRING;

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
| `is_new_customer` | `{{purchase_count}} == 1` (Stape Store email collection) | yes |
| `purchase_count` | Stape Store `purchase_count` | yes |
| `session_count` | Stape Store `session_count` keyed by X-Stape-User-Id | no |
| `fb_first_click` | Stape Store `fb_first_click` | no |
| `google_first_click` | Stape Store `google_first_click` | no |
| `event_id` | Send on **GA4 client** too (today 0%) | yes |

## 3. Recreate `dashboard_events` before 2026-10-11

The live view has `expiration_timestamp`. Recreate without expiry. Keep the
GA4-vs-Data-Client filter. Funnel SQL still nulls fbclid until the column
exists and `src/lib/stape/config.ts` is updated.

## 4. What not to change

- Web GTM `gn_uid` cookie and cart-attribute writer
- Stape Store keys (`X-Stape-User-Id`, hashed email collection)
- Existing `source_client`
- Production pixels / CAPI / Ads tags
