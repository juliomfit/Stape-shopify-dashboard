# Purpose

Meta **channel** attribution is already valid (Meta Paid → order). Meta **campaign / ad set / ad** attribution is not, because first-party touches do not currently contain deterministic Meta IDs.

Validated production sample (do not rewrite):

- Tracked orders: 73
- OUR Meta-attributed orders: 70
- OUR Meta touches: 80
- Exact campaign ID mapped: 0
- Unique-name mapped: 0
- Unmapped: 80
- Mapping rate: 0%

This document is the Ads Manager handoff so **future** Meta clicks carry:

`gn_meta_campaign_id` → `gn_meta_adset_id` → `gn_meta_ad_id`

Those IDs are the join keys. Names are diagnostic only. Do not fuzzy-match. Do not allocate spend proportionally. Do not invent IDs for the current 80 unmapped historical touches.

Cursor cannot edit live Meta ads.

# MANUAL META UI VERIFICATION REQUIRED

Official Meta help documents **dynamic URL parameters** on the **ad** object. Commonly cited tokens:

- `{{campaign.id}}`
- `{{adset.id}}`
- `{{ad.id}}`
- `{{campaign.name}}` / `{{adset.name}}` / `{{ad.name}}` (optional display)

Cursor has **not** independently verified official token syntax against the current Ads Manager picker. Do not treat this list as production-verified.

Before publishing, Julio must confirm the live Ads Manager builder still lists those tokens:

1. Ads Manager → the **ad** (not campaign, not ad set).
2. **Ad setup → Destination** (or **Tracking**, depending on UI build).
3. Open **URL parameters** (sometimes **Build a URL parameter**).
4. Confirm the dynamic-parameter picker still offers `campaign.id`, `adset.id`, and `ad.id`.
5. If a token does not resolve (it appears literally as `{{campaign.id}}` on the landing URL), stop and do not mass-roll.

`fbclid` is appended by Meta automatically. Do **not** add `fbclid` to this string.

# URL parameter field

Paste at **ad** level:

**Ads Manager → Campaigns → Ads → [open the ad] → Destination → Website URL stays unchanged → URL parameters**

Do **not** paste tokens into the Website URL field. Tokens in Website URL are treated as literal text.

There is no campaign-level or ad-set-level URL-parameter field that reliably cascades. Every ad needs the string (or a bulk edit that writes `url_tags` on each ad).

# Recommended parameter contract

Copy/paste (no leading `?`):

```
utm_source=facebook&utm_medium=cpc&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&gn_meta_campaign_id={{campaign.id}}&gn_meta_adset_id={{adset.id}}&gn_meta_ad_id={{ad.id}}
```

Optional diagnostic names (IDs remain authoritative):

```
utm_source=facebook&utm_medium=cpc&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&gn_meta_campaign_id={{campaign.id}}&gn_meta_adset_id={{adset.id}}&gn_meta_ad_id={{ad.id}}&gn_meta_campaign_name={{campaign.name}}&gn_meta_adset_name={{adset.name}}&gn_meta_ad_name={{ad.name}}
```

IDs are the join keys. Do not put campaign ID into `utm_campaign` and pretend that is typed identity.

# Merge with existing URL parameters

1. Open the ad’s current URL parameters string.
2. Keep any intentional keys you already use (`utm_*`, offer codes, etc.).
3. Add the three `gn_meta_*` ID keys if they are missing.
4. If the same key exists twice, Meta uses the URL-parameters field over Website URL duplicates.
5. Do not delete existing keys unless they are unused junk.
6. Shopify merchants may already see auto-appended `utm_source` / `utm_medium` / campaign / ad IDs. Inspect one live click first. If Meta already appends `campaign_id=` (different name), still add `gn_meta_campaign_id={{campaign.id}}` so GoodsNova has a stable first-party contract.

# Existing ads

Changing URL parameters on a live ad can count as an **ad edit** and may reset learning / require review.

Do **not** mass-change ads through any API. Cursor has no live Meta access.

Prefer:

1. TEST ONE ACTIVE/CONTROLLED AD FIRST
2. Verify the 8-step click test below
3. Then roll to remaining ads

# New ads

Every future ad must inherit this contract. Add the string to the ad template / bulk-create sheet / Ads Manager URL parameters field before publishing.

# Test click (one ad)

1. Click the live/test Meta destination from a clean browser (or Ads Manager preview that actually hits the website URL).
2. Confirm the landing URL contains:
   - `gn_meta_campaign_id=<digits>`
   - `gn_meta_adset_id=<digits>`
   - `gn_meta_ad_id=<digits>`
   - existing `utm_source` / `utm_medium` if you kept them
   - `fbclid` (Meta-appended)
3. Confirm cookies (Application → Cookies on goodsnova.com):
   - **session** `gn_meta_campaign_id` / `gn_meta_adset_id` / `gn_meta_ad_id` match **this** click
   - **first-touch audit** `gn_first_meta_campaign_id` / `gn_first_meta_adset_id` / `gn_first_meta_ad_id` (365d first-write)
   - `gn_uid` still present
   - existing `gn_utm_*` / `gn_fbclid` not overwritten if they already existed
   - If you already had a prior Meta click, first-touch IDs stay the original campaign; session IDs are this ad
4. GTM Preview (`GTM-MVWKFXH2`): stitch tag fires; Event Data / GA4 params include **session** `gn_meta_campaign_id` for this click.
5. Server GTM Preview (`GTM-NJ4QCWFK`): event data includes the same **session** keys after web GTM is published. Map typed BQ `meta_*` from these, never from `gn_first_meta_*`.
6. BigQuery `raw_events_full`: `page_location` contains the three IDs. After migration 006 + sGTM field map, typed columns `meta_campaign_id` / `meta_adset_id` / `meta_ad_id` also fill with **current session / click** identity.
7. Canonical session touch: dashboard `/meta` debugger / OUR order drilldown shows campaign/adset/ad IDs on the Meta touch from `page_location`.
8. Campaign mapping: query `bigquery/validation/14_meta_id_fact_match.sql` — observed IDs exist in Meta facts (`campaign_id_exact_matches` > 0).

If step 2 fails, do not roll out. If step 2 works but 6 fails, the problem is GTM/sGTM, not Ads Manager.

# Expected landing URL (shape)

```
https://goodsnova.com/?utm_source=facebook&utm_medium=cpc&utm_campaign=...&utm_content=...&gn_meta_campaign_id=120...&gn_meta_adset_id=120...&gn_meta_ad_id=120...&fbclid=...
```

# Rollout stages

1. Repository/app support (this branch)
2. BigQuery migration 006 (additive columns)
3. Web GTM **click-by-click in the live workspace** (`docs/GTM_MANUAL_CHANGES.md`). **DO NOT MERGE AN OLD EXPORT OVER A NEWER LIVE CONTAINER.**
4. Server GTM field map (`bigquery/analytics/GTM_CHANGES.md`) — session `gn_meta_*` → typed `meta_*`
5. ONE Meta ad URL-parameter test
6. Validate first live Meta IDs in `raw_events_full` (query 13)
7. Validate canonical touch in the dashboard
8. Validate exact Meta fact match (query 14)
9. Treat campaign OUR attribution as HAS HIGH-ID MAPS only after step 8
10. Roll URL parameters to remaining ads

Do not mark campaign attribution production verified before Stage 8.

# What not to do

- Do not mass-edit ads via API
- Do not overwrite Website URL with the parameter string
- Do not use campaign name as the preferred join once IDs exist
- Do not invent IDs for historical unmapped touches
- Do not change CAPI, event_id, Purchase_New_Customer, or attribution models
