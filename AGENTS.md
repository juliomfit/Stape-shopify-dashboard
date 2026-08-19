<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

- Dev server: `npm run dev` binds `--hostname :: --port 3000`. Restart it after switching branches.
- `npm test` uses Node's test runner (`node --experimental-strip-types --test`). Modules under test cannot import `@/` aliases; keep unit tests pointed at self-contained files (see `package.json` `test` script).
- `npm run typecheck` needs `.next` types from a prior `npm run build` (`LayoutProps`). If typecheck fails on generated Next types, build first.
- Attribution Models / Journeys / Attribution Overview accept `?lookback=1|7|14|30|60` and (where relevant) `?model=`. Default window is **7 days** (validated 2026-08-19: P90=0h, P99=69h, n=69). 90-day is hidden until raw_events_full retention covers it.
- First-touch (cart gn_*) is `/attribution`. Multi-touch OUR attribution is `/attribution/overview`. Warehouse QA is `/warehouse`.
- MER = Shopify revenue ÷ ad spend. Marketing cost ratio = spend ÷ revenue. Unknown ≠ Direct. Assists = middle touches, not Linear.
- Do not invent Meta campaign-level nCAC. Campaign OUR revenue joins only on campaign id/name match. Purchase-event grain 2026-08-01–19: 39/72 purchases had fbclid; **0/72 had utm_campaign on the purchase URL** (checkout pages). Re-run `bigquery/validation/05_meta_campaign_mapping_coverage.sql` for touch-grain campaign rates. UI mapping chip stays VALIDATION REQUIRED until that touch-grain rate is recorded. Only 1 Meta campaign fact row in that range — do not invent campaign nCAC from that.
- Customer first-purchase LTV uses Shopify orders loaded for the header range (up to 10k). Immature windows are labeled. Range-based `createdAt` cohorts remain labeled as range, not LTV.
- Web GTM stitch-fill for **GTM-MVWKFXH2 is already published** (Julio). Do not ask to re-import `gtm/import/GTM-MVWKFXH2_stitch-fill.json`. Shop Pay still does not run the stitch HTML. If `gn_uid` / click IDs are still empty in BigQuery, that is the **server** writer (`GTM-NJ4QCWFK` / `bigquery/analytics/GTM_CHANGES.md`), not a missing web-container publish.
- Click-id fill is **live as of 2026-08-15** on both `Data Client` and `GA4` copies of `page_view` in `raw_events_full`. Dual GA4 + Data Client rows are expected. **`fbc` / `fbp` are not columns** on `raw_events_full` — Meta is `fbclid` + URL `fbclid`. Selecting `fbc` yields `Unrecognized name: fbc`. **No Google Ads account for now**. Residual `gclid` may be leftover URLs or Shopify Shop campaigns. Keep mapping `gclid`. Do not build a Google Ads product. Paid traffic to diagnose is Meta/`fbclid`.
- Do not copy `.env.example` verbatim in this VM: a placeholder `GOOGLE_CLOUD_PROJECT` plus a missing service-account file surfaces as a red Stape error. Leave BigQuery project empty when credentials are not present.
- There is no local `DASHBOARD_PASSWORD` in this environment, so middleware does not gate pages.
- Pre-existing lint warnings (`unused totalSpend` on conversions/sales, unused `metrics`/`dimensions` in `flyweel.ts`) are out of scope unless you are already editing those files.
