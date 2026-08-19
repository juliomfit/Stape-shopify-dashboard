# Web GTM: stitch before page_view + send gn_* on GA4

Web container: **GTM-MVWKFXH2** (`Goodsnova CDN Web`).
Server BQ map already reads `{{gn_uid}}` / `{{gn_gclid}}` / `{{gn_fbclid}}` Event Data.
No server-container overwrite is required if web sends those param names.

Do this in a **new workspace**, Preview on `goodsnova.com`, then Publish.

## Why

1. Stitch HTML, GA4 `page_view`, and DT `page_view` all fired on **DOM Ready** with no Setup Tag. First hit often had empty `gn_uid`.
2. First-touch click IDs lived in `localStorage` + cart attributes only. Server BQ `gclid`/`fbclid` stayed empty.
3. `ga4 - shared_event_settings` only extra stitch field was `gn_uid`. Other GA4 events did not send first-touch params.

## Option A — import the patched JSON (fast)

File: `gtm/import/GTM-MVWKFXH2_stitch-fill.json` (built from the 2026-08-14 workspace export).

1. Tag Manager → GTM-MVWKFXH2 → **Admin → Import Container**.
2. Choose that JSON.
3. Workspace: **New** (name it `stitch fill`).
4. Import option: **Merge** → **Overwrite conflicting tags, triggers, and variables**.
5. Confirm it updates:
   - `[Shopify] Stitching -> Order Attributes (gn_uid + first-touch)`
   - `ga4 - shared_event_settings`
   - every `[Stape] GA4 - *` and `[Stape] DT - *` tag
   - new `cookie gn_*` variables
   - new trigger `init - all pages`
6. **Do not** choose Overwrite the entire container.
7. Preview → Publish.

If GTM warns about a newer live version than this export, still Merge; then spot-check any tags you edited after 2026-08-14 20:11 UTC.

## Option B — click-by-click (no import)

### 1. Custom HTML (existing tag)

Open **[Shopify] Stitching -> Order Attributes (gn_uid + first-touch)**.

Replace the script with `gtm/web/stitch-gn-first-touch.html`.

The only behavior change vs live: after first-touch is in `localStorage`, it also writes **first-touch-only** cookies (`gn_gclid`, `gn_fbclid`, `gn_gbraid`, `gn_wbraid`, `gn_msclkid`, `gn_ttclid`, `gn_utm_*`). Existing cookies are not overwritten. Returning visitors who already have `gn_first_touch_v1` get cookies on the next hit.

Triggers:

- Keep **dom - page_view** (DOM Ready) so `/cart/update.js` can retry when Shopify is ready.
- Add **Initialization - All Pages**. Create trigger type **Initialization**, name `init - all pages`.
- Tag priority: **999**.
- Tag firing: Once per event.

### 2. Setup Tag (required)

On **every** `[Stape] GA4 - *` and `[Stape] DT - *` tag (including `_Config`, `page_view`, `view_item`, `purchase`):

Advanced settings → Tag sequencing → **Fire a setup tag** before this tag:

- Setup tag: `[Shopify] Stitching -> Order Attributes (gn_uid + first-touch)`
- **Do not** stop firing if setup fails

This is what fixes empty `gn_uid` on the first `page_view`.

### 3. First-party cookie variables

Type **1st Party Cookie**, decode = false:

| Variable name | Cookie name |
|---|---|
| `cookie gn_uid` | `gn_uid` (already exists) |
| `cookie gn_gclid` | `gn_gclid` |
| `cookie gn_gbraid` | `gn_gbraid` |
| `cookie gn_wbraid` | `gn_wbraid` |
| `cookie gn_msclkid` | `gn_msclkid` |
| `cookie gn_fbclid` | `gn_fbclid` |
| `cookie gn_ttclid` | `gn_ttclid` |
| `cookie gn_utm_source` | `gn_utm_source` |
| `cookie gn_utm_medium` | `gn_utm_medium` |
| `cookie gn_utm_campaign` | `gn_utm_campaign` |
| `cookie gn_utm_content` | `gn_utm_content` |
| `cookie gn_utm_term` | `gn_utm_term` |

### 4. GA4 shared event settings

Variable **ga4 - shared_event_settings** → Event Parameters. Keep existing rows. Add:

| Parameter | Value |
|---|---|
| `gn_uid` | `{{cookie gn_uid}}` (already there) |
| `gn_gclid` | `{{cookie gn_gclid}}` |
| `gn_gbraid` | `{{cookie gn_gbraid}}` |
| `gn_wbraid` | `{{cookie gn_wbraid}}` |
| `gn_msclkid` | `{{cookie gn_msclkid}}` |
| `gn_fbclid` | `{{cookie gn_fbclid}}` |
| `gn_ttclid` | `{{cookie gn_ttclid}}` |
| `gn_utm_source` | `{{cookie gn_utm_source}}` |
| `gn_utm_medium` | `{{cookie gn_utm_medium}}` |
| `gn_utm_campaign` | `{{cookie gn_utm_campaign}}` |
| `gn_utm_content` | `{{cookie gn_utm_content}}` |
| `gn_utm_term` | `{{cookie gn_utm_term}}` |
| `user_id` | `{{dlv - user_data.customer_id}}` |

Do **not** also send raw `gclid` / `fbclid` as GA4 params; server BQ already maps `gclid` ← `{{gn_gclid}}`.

Every `[Stape] GA4 - *` event tag already uses `{{ga4 - shared_event_settings}}`. Confirm `_Config` does too if it should.

### 5. Data Tags `custom_data`

On each `[Stape] DT - *` tag, append the same `gn_*` rows (name / value / transformation none / store none). `gn_uid` is already on all seven DT tags; add the click-id and UTM cookies.

## Preview checks

1. Open `https://goodsnova.com/?gclid=TESTGCLID&fbclid=TESTFBCLID` in GTM Preview.
2. Initialization: stitch tag fires, cookies `gn_uid`, `gn_gclid`, `gn_fbclid` exist.
3. DOM Ready `page_view`: GA4 and DT fire **after** stitch (setup tag). Event params include `gn_uid` and `gn_gclid=TESTGCLID`.
4. Server Preview / BQ (allow a few minutes): that `page_view` row has `gn_uid` and `gclid`.
5. Repeat without query params: `gclid` should still be the **first-touch** cookie, not empty.

Shop Pay still will not run this HTML. That gap is unchanged.

## Meta identity (Phase 2) — PREPARED FOR IMPORT

Do not re-import `GTM-MVWKFXH2_stitch-fill.json`. For `gn_meta_campaign_id` / `gn_meta_adset_id` / `gn_meta_ad_id`:

- Import file: `gtm/import/GTM-MVWKFXH2_meta-ids.json`
- Exact steps: `docs/GTM_MANUAL_CHANGES.md`
- Ads Manager URL contract: `docs/META_ATTRIBUTION_SETUP.md`

This is not live until Julio imports + Preview + Publish.

## After publish: Query 1 (Pacific day)

Use **2026** dates, not 2024.

```sql
DECLARE d DATE DEFAULT DATE('2026-08-15');  -- change to the Pacific day after publish

SELECT
  event_name,
  source_client,
  COUNT(*) AS rows,
  COUNTIF(gn_uid IS NOT NULL AND gn_uid != '') / COUNT(*) AS gn_uid_pct,
  COUNTIF(gclid IS NOT NULL AND gclid != '') / COUNT(*) AS gclid_pct,
  COUNTIF(fbclid IS NOT NULL AND fbclid != '') / COUNT(*) AS fbclid_pct,
  COUNTIF(
    page_location LIKE '%gclid=%' OR page_location LIKE '%fbclid=%'
  ) / COUNT(*) AS landing_clickid_in_url_pct
FROM `stape-analytics-487802.stape_data.raw_events_full`
WHERE DATE(timestamp, 'America/Los_Angeles') = d
  AND event_name IN ('page_view', 'purchase', 'view_item')
GROUP BY 1, 2
ORDER BY 1, 2;
```

Expect after a full day of post-publish traffic:

- GA4 `page_view` `gn_uid_pct` well above the old ~22%.
- `gclid` / `fbclid` columns filling on landings that had those params (and on later events via first-touch cookies).
- Dual `purchase` rows (GA4 + Data Client) still count as **two copies of one order**.
