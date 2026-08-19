# Web GTM manual changes — Meta identity (PREPARED FOR IMPORT)

Cursor cannot publish GTM. This is **not live**.

Web container: **GTM-MVWKFXH2** (`Goodsnova CDN Web`).

The stitch-fill workspace is already published. This pass only extends the **existing** Custom HTML tag and adds three cookie variables + GA4/DT params. Do not rebuild the container.

## Exact tag changed

Name: `[Shopify] Stitching -> Order Attributes (gn_uid + first-touch)`

Action: replace the Custom HTML with `gtm/web/stitch-gn-first-touch.html`.

No new tags. No trigger changes. Keep:

- Initialization - All Pages (`init - all pages`)
- DOM Ready (`dom - page_view`)
- Priority 999
- Setup Tag on every `[Stape] GA4 - *` and `[Stape] DT - *`

## Code change (behavior)

Captures first-write (does not overwrite existing `gn_first_touch_v1`):

- `gn_meta_campaign_id`
- `gn_meta_adset_id`
- `gn_meta_ad_id`
- optional names `gn_meta_campaign_name` / `gn_meta_adset_name` / `gn_meta_ad_name`

Mirrors IDs into first-party cookies (365d, SameSite=Lax, first-write only) and Shopify cart attributes with the same keys.

Does not break `gn_uid`, UTMs, `fbclid`, `gclid`, or existing cart attributes.

IDs that are not 1–32 digits are dropped.

## Variable changes

Add 1st Party Cookie variables (decode = false):

| Variable name | Cookie name |
|---|---|
| `cookie gn_meta_campaign_id` | `gn_meta_campaign_id` |
| `cookie gn_meta_adset_id` | `gn_meta_adset_id` |
| `cookie gn_meta_ad_id` | `gn_meta_ad_id` |

## GA4 shared event settings

Variable **ga4 - shared_event_settings** — append (do not remove existing rows):

| Parameter | Value |
|---|---|
| `gn_meta_campaign_id` | `{{cookie gn_meta_campaign_id}}` |
| `gn_meta_adset_id` | `{{cookie gn_meta_adset_id}}` |
| `gn_meta_ad_id` | `{{cookie gn_meta_ad_id}}` |

Do **not** put these IDs into `utm_campaign` / `utm_content`.

## Data Tags

On each `[Stape] DT - *` tag `custom_data`, append the same three `gn_meta_*` rows (transformation none / store none).

## Import procedure (Option A)

File: `gtm/import/GTM-MVWKFXH2_meta-ids.json` (PREPARED FOR IMPORT).

1. Tag Manager → GTM-MVWKFXH2 → Admin → Import Container.
2. Workspace: **New** (name it `meta ids`).
3. Merge → Overwrite conflicting tags, triggers, and variables.
4. Confirm it updates the stitch tag, `ga4 - shared_event_settings`, DT custom_data, and the three new cookie variables.
5. Do **not** overwrite the entire container.
6. Preview → then Publish only after Preview passes.

If GTM warns the live version is newer than this export, still Merge, then spot-check tags edited after the stitch-fill publish.

## Option B — click-by-click

1. Open the existing stitch tag. Replace HTML with `gtm/web/stitch-gn-first-touch.html`.
2. Create the three cookie variables.
3. Append the three GA4 params.
4. Append the three DT rows.

## Preview validation

1. `https://goodsnova.com/?utm_source=facebook&utm_medium=cpc&gn_meta_campaign_id=111&gn_meta_adset_id=222&gn_meta_ad_id=333&fbclid=TESTFBCLID`
2. Initialization: stitch fires. Cookies `gn_meta_campaign_id=111`, `gn_meta_adset_id=222`, `gn_meta_ad_id=333` exist. `gn_uid` still exists.
3. Reload **without** query params: cookies still hold first-touch IDs (not overwritten).
4. Second URL with different IDs: first-touch localStorage / cookies stay `111/222/333`.
5. GA4 `page_view` event params include `gn_meta_campaign_id=111`.
6. Shopify cart attributes (Network `cart/update.js` or cart page) include `gn_meta_campaign_id`.

## Regression risks

- Shop Pay still does not run this HTML.
- First-write cookies: returning visitors without Meta IDs in first-touch will not pick up IDs from a later click into first-touch storage. Canonical attribution still uses the **session landing URL**, so later Meta sessions are fine.
- Do not publish if stitch no longer fires on Initialization.

## Server GTM

Web sending `gn_meta_*` event params does **not** automatically create BigQuery columns. See `bigquery/analytics/GTM_CHANGES.md` and migration 006. Warehouse SQL already extracts IDs from `page_location` without those columns.
