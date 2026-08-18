<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

- Dev server: `npm run dev` binds `--hostname :: --port 3000`. Restart it after switching branches.
- `npm test` uses Node's test runner (`node --experimental-strip-types --test`). Modules under test cannot import `@/` aliases; keep unit tests pointed at self-contained files (see `package.json` `test` script).
- `npm run typecheck` needs `.next` types from a prior `npm run build` (`LayoutProps`). If typecheck fails on generated Next types, build first.
- Attribution Models / Journeys accept `?lookback=7|14|30|90`. That lookback is applied in both the Stape SQL path join and the TypeScript engine. True Performance, Data quality, and other `getAttributionMetrics()` callers stay on the default 7-day window unless they pass `{ lookbackDays }`.
- Do not copy `.env.example` verbatim in this VM: a placeholder `GOOGLE_CLOUD_PROJECT` plus a missing service-account file surfaces as a red Stape error. Leave BigQuery project empty when credentials are not present.
- There is no local `DASHBOARD_PASSWORD` in this environment, so middleware does not gate pages.
- Do not invent Meta campaign-level nCAC, MMM, incrementality, or lifetime LTV. Store-wide nCAC uses Meta spend ÷ Shopify new-customer orders and is labeled as such. Customer cohorts use Shopify `createdAt` month; revenue is the header range, not lifetime spend.
- Web GTM stitch-fill for **GTM-MVWKFXH2 is already published** (Julio). Do not ask to re-import `gtm/import/GTM-MVWKFXH2_stitch-fill.json`. PR #7 only checked those files into git so they match the live container. Shop Pay still does not run the stitch HTML. If `gn_uid` / click IDs are still empty in BigQuery, that is the **server** writer (`GTM-NJ4QCWFK` / `bigquery/analytics/GTM_CHANGES.md`), not a missing web-container publish.
- Click-id fill is **live as of 2026-08-15** on both `Data Client` and `GA4` copies of `page_view` in `raw_events_full`. Day-by-day overlap: Aug 12–14 `fbclid_url_miss` is high (column empty while URL has `fbclid=`); from Aug 15 onward `fbclid_url_miss=0`, `fbclid_url_hit` tracks Meta landings, and `fbclid_cookie_only` is non-zero (first-touch cookie). Dual GA4 + Data Client rows are expected. **No Google Ads account for now** (Julio). Residual `gclid` is not a tracking gap and is not a Google Ads channel Julio operates; it may be leftover tagged URLs or **Shopify Shop campaigns** that can appear on Google via Shopify’s platform. Keep mapping `gclid` (stitch already does) so Shop-on-Google clicks still stitch. Do not build a Google Ads channel around those rows unless Julio starts Google Ads. Paid traffic to diagnose is Meta/`fbclid`. The 7-day 2396 URL vs 1562 column gap is pre-stitch history. Do not ask Julio to re-publish web GTM. Warehouse lookbacks that include Aug 12–14 will still undercount Meta click IDs until that window rolls off.
- Pre-existing lint warnings (`unused totalSpend` on conversions/sales, unused `metrics`/`dimensions` in `flyweel.ts`) are out of scope unless you are already editing those files.
