# Page source matrix

Header date cookie `dashboard_range` (America/Los_Angeles) is the period on every nav page. `getAlignedPeriod()` === `getSelectedPeriod()`.

| Page | Route | Primary source | Spend / CPA |
|---|---|---|---|
| Overview | `/` | Shopify Admin + Stape BQ (`stape_data`) + `getPlatformReported` | Blended = Meta warehouse (`goodsnova_platform.meta_campaign_insights_daily`) + Google paste. Missing = —. Not gn_*. |
| Sales | `/sales` | Shopify Admin orders + gn_* cart attributes | Same blended spend as Overview. First-touch is gn_*. |
| Meta Ads | `/meta` | Warehouse campaign facts (Flyweel ingest). Charts never call Flyweel on GET. | Platform Ads Manager matching. Same Meta dollars as Overview Meta. |
| Creatives | `/meta/creatives` | Campaign warehouse fallback; Graph thumbnails if stored | Campaign CPA from warehouse. No Flyweel thumbnails. |
| Traffic | `/traffic` | Stape BQ sessions. Raw source list from first-hit `utm_source` / click id / referrer, plus channel buckets. | No ad spend. Same session definition as Overview. |
| Conversions | `/conversions` | Shopify + Stape funnel from `getCoreDashboard` | Blended CPA same formula as Overview. |
| True Performance | `/attribution` | Shopify gn_* first-touch. Source tab = raw `utm_source` (Sendvio, Klaviyo, or any new tag). Channel Email is a bucket. | Spend labeled platform/paste. Channel ROAS = gn_* revenue ÷ platform spend. Never Ads Manager attribution. |
| Warehouse | `/warehouse` | Stape `raw_events_full` click models | Platform Meta/Google spend cards share `getPlatformReported`. Models are not gn_*. |
| Products | `/products` | Shopify line items | No invented COGS. |
| Customers | `/customers` | Shopify customers on orders in range | Shopify period cookie. |
| Data health | `/health` | Sync runs + Overview + warehouse facts | Explains — vs $0 and Shopify vs Stape capture. |
| Integrations | `/integrations` | Connection status | Flyweel key / Graph OAuth. No `connect_ad_platform`. |
| Ask AI | `/ai` | Same loaders as pages (`getCoreDashboard`, `getMetaClaimed`, `getCampaignFacts`) | Must not contradict cards. |
| Data quality | `/data-quality` | Truncation, BQ table, paste coverage | Explains gaps other pages show as —. |

## Hard rules

- First-touch / True Performance = storefront `gn_*` (and warehouse click models). Never Meta Ads Manager.
- Meta / Creatives = platform-attributed Flyweel → GoodsNova backend → `goodsnova_platform`.
- Today $0 after a successful sync is Flyweel lag, not a missing dataset.
- Google Ads is paste, not a live API.
- Production: https://stape-shopify-dashboard.vercel.app — use `/meta` there, not git preview URLs.
