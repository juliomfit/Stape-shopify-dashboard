# Web GTM manual changes — Meta identity (click-by-click in the LIVE workspace)

Cursor cannot publish GTM. This is **not live**. Cursor only has a repository export, which may be older than the published container.

**PRIMARY procedure: click-by-click modifications in the CURRENT LIVE GTM workspace.**

**DO NOT MERGE AN OLD EXPORT OVER A NEWER LIVE CONTAINER.**

Do not import `gtm/import/GTM-MVWKFXH2_meta-ids.json` as the default path. That file is an optional convenience only after Julio exports a **fresh** live workspace and compares it to the patched file. If the live container is newer than the repo export, importing/overwrite will destroy later live edits.

Web container: **GTM-MVWKFXH2** (`Goodsnova CDN Web`).

The stitch-fill workspace is already published. This pass only extends the **existing** Custom HTML tag and cookie / GA4 / DT wiring. Do not rebuild the container.

## Semantics (do not mix these)

Landing URL query params stay:

- `gn_meta_campaign_id` / `gn_meta_adset_id` / `gn_meta_ad_id` — this click

Durable FIRST TOUCH / Shopify audit (365-day first-write, never overwrite):

- `gn_first_meta_campaign_id` / `gn_first_meta_adset_id` / `gn_first_meta_ad_id`

Current session / click (`gn_session_meta_v1` + `gn_meta_*` cookies) with a **30-minute inactivity TTL**:

- cookies `gn_meta_campaign_id` / `gn_meta_adset_id` / `gn_meta_ad_id`
- stored object includes the IDs plus `last_seen`
- new landing `gn_meta_*` replaces IDs and resets `last_seen`
- later pages without `gn_meta_*` and age ≤ 30 minutes keep IDs and refresh `last_seen`
- inactivity > 30 minutes clears `gn_session_meta_v1` and expires the three `gn_meta_*` cookies
- `gn_first_meta_*` is unchanged

GA4 / Data Tags / typed BigQuery `meta_campaign_id` / `meta_adset_id` / `meta_ad_id` must send the **current session** cookies, not first-touch cookies.

Canonical attribution still extracts IDs from `page_location`. That path is valid and must keep working. Same-session landing disagreements are `SESSION_ID_CONFLICT` (unmapped at child Meta grains, channel credit kept). Fact-parent disagreements are `META_HIERARCHY_CONFLICT`.

## Exact tag changed

Name: `[Shopify] Stitching -> Order Attributes (gn_uid + first-touch)`

Action: replace the Custom HTML with `gtm/web/stitch-gn-first-touch.html`.

No new tags. No trigger changes. Keep:

- Initialization - All Pages (`init - all pages`)
- DOM Ready (`dom - page_view`)
- Priority 999
- Setup Tag on every `[Stape] GA4 - *` and `[Stape] DT - *`

## PRIMARY — click-by-click in the live workspace

1. Tag Manager → **GTM-MVWKFXH2** → open the **currently published / current live workspace**. Do not start from an old export.
2. Open tag `[Shopify] Stitching -> Order Attributes (gn_uid + first-touch)`.
3. Replace Custom HTML with the contents of `gtm/web/stitch-gn-first-touch.html`.
4. Create 1st Party Cookie variables if missing (decode = false):

| Variable name | Cookie name | Lifetime |
|---|---|---|
| `cookie gn_meta_campaign_id` | `gn_meta_campaign_id` | **30-minute inactivity TTL** (current click) |
| `cookie gn_meta_adset_id` | `gn_meta_adset_id` | **30-minute inactivity TTL** (current click) |
| `cookie gn_meta_ad_id` | `gn_meta_ad_id` | **30-minute inactivity TTL** (current click) |

Do **not** map `gn_first_meta_*` into GA4 `meta_*` / `gn_meta_*` event params.

5. Variable **ga4 - shared_event_settings** — append (do not remove existing rows):

| Parameter | Value |
|---|---|
| `gn_meta_campaign_id` | `{{cookie gn_meta_campaign_id}}` |
| `gn_meta_adset_id` | `{{cookie gn_meta_adset_id}}` |
| `gn_meta_ad_id` | `{{cookie gn_meta_ad_id}}` |

Do **not** put these IDs into `utm_campaign` / `utm_content`.

6. On each `[Stape] DT - *` tag `custom_data`, append the same three `gn_meta_*` rows (transformation none / store none).
7. Preview (below) then Publish only after Preview passes.

## Optional convenience import (not primary)

File: `gtm/import/GTM-MVWKFXH2_meta-ids.json`.

Use only after:

1. Admin → Export Container from the **current live** workspace.
2. Diff that fresh export against the patched file (stitch HTML, the three cookie variables, GA4 shared settings, DT custom_data).
3. If they diverge, prefer the click-by-click steps. Do not overwrite live tags you did not inspect.

**DO NOT MERGE AN OLD EXPORT OVER A NEWER LIVE CONTAINER.**

If you still import: Workspace = New, Merge, and only overwrite the stitch tag / cookie variables / GA4+DT params listed above. Never overwrite the entire container.

## Preview validation

1. `https://goodsnova.com/?utm_source=facebook&utm_medium=cpc&gn_meta_campaign_id=111&gn_meta_adset_id=222&gn_meta_ad_id=333&fbclid=TESTFBCLID`
2. Initialization: stitch fires. Session cookies `gn_meta_campaign_id=111` (and adset/ad) exist. First-touch cookies `gn_first_meta_campaign_id=111` exist. `gn_uid` still exists.
3. Same tab, second URL `...?gn_meta_campaign_id=999&gn_meta_adset_id=888&gn_meta_ad_id=777`:
   - session cookies become `999/888/777`
   - first-touch cookies stay `111/222/333`
   - GA4 `page_view` params are `gn_meta_campaign_id=999` (current session)
4. Reload **without** query params in the same tab within 30 minutes: session cookies still `999/888/777` (`last_seen` refreshed).
5. After **>30 minutes inactivity** without new `gn_meta_*`: `gn_session_meta_v1` is cleared; `gn_meta_*` cookies expire; `gn_first_meta_*` still `111/222/333`.
6. Shopify cart attributes (Network `cart/update.js`) include `gn_first_meta_campaign_id=111`, not the converting campaign.
7. `gn_uid` / existing `gn_utm_*` / `gn_fbclid` first-touch cookies are not overwritten.

## Regression risks

- Shop Pay still does not run this HTML.
- First-touch storage does not pick up a later Meta click. Canonical attribution uses the **session landing URL**, so later Meta sessions are still attributed from that click's `page_location`.
- Do not publish if stitch no longer fires on Initialization.

## Server GTM

Web sending `gn_meta_*` event params does **not** automatically create BigQuery columns. See `bigquery/analytics/GTM_CHANGES.md` and migration 006. Warehouse SQL already extracts IDs from `page_location` without those columns.

Typed `meta_*` columns are **CURRENT SESSION / CLICK identity**. Map them from Event Data `gn_meta_*` (session cookies), never from `gn_first_meta_*`.
