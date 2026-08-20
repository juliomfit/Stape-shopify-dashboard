import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const PROVIDER_INGEST = [
  "getInsights(",
  "meta-ingest",
  "query_metrics",
  "runScheduledSync",
  "syncMetaHourly",
  "ingestShopifyIncremental",
  "FlyweelMetaAdsProvider",
];

function assertNoProviderIngest(label: string, src: string) {
  for (const token of PROVIDER_INGEST) {
    assert.equal(src.includes(token), false, `${label} must not ${token} on the read path`);
  }
}

test("Overview page read path does not call Flyweel or provider ingest", () => {
  assertNoProviderIngest("overview page", readFileSync("src/app/(dashboard)/page.tsx", "utf8"));
  assertNoProviderIngest("core metrics", readFileSync("src/lib/dashboard/core-metrics.ts", "utf8"));
});

test("Meta page read path does not call Flyweel ingest", () => {
  const src = readFileSync("src/app/(dashboard)/meta/page.tsx", "utf8");
  assertNoProviderIngest("meta page", src);
  assert.match(src, /getCampaignFacts/);
});

test("Attribution pages load platform spend in parallel with warehouse reads", () => {
  const overview = readFileSync("src/app/(dashboard)/attribution/overview/page.tsx", "utf8");
  assert.match(overview, /getPlatformReported\(period\)/);
  assert.match(overview, /Promise\.all\(\[/);
  const afterAll = overview.slice(overview.indexOf("Promise.all"));
  assert.doesNotMatch(afterAll.slice(0, 400), /const platform = await getPlatformReported/);
  const models = readFileSync("src/app/(dashboard)/attribution-models/page.tsx", "utf8");
  assert.match(models, /getPlatformReported\(period\)/);
  const campaign = readFileSync("src/app/(dashboard)/meta/[campaignId]/page.tsx", "utf8");
  assert.match(campaign, /getCanonicalAttributedOrders/);
  assert.match(campaign, /Promise\.all\(/);
});

test("Attribution normal page reads do not call provider ingestion", () => {
  assertNoProviderIngest(
    "attribution overview",
    readFileSync("src/app/(dashboard)/attribution/overview/page.tsx", "utf8"),
  );
  assertNoProviderIngest(
    "attribution models",
    readFileSync("src/app/(dashboard)/attribution-models/page.tsx", "utf8"),
  );
  assertNoProviderIngest(
    "canonical orders",
    readFileSync("src/lib/warehouse/canonical-orders.ts", "utf8"),
  );
});

test("Sales read uses prepared Shopify overview, not a live ingest job", () => {
  const src = readFileSync("src/app/(dashboard)/sales/page.tsx", "utf8");
  assertNoProviderIngest("sales page", src);
  assert.match(src, /getCoreDashboard/);
  const overview = readFileSync("src/lib/shopify/get-overview-metrics.ts", "utf8");
  assert.match(overview, /loadShopifyOverviewFromWarehouse/);
  assert.match(overview, /fetchShopifyOrderRecords/);
});

test("Customers page loads independent Shopify read models in parallel", () => {
  const src = readFileSync("src/app/(dashboard)/customers/page.tsx", "utf8");
  assert.match(src, /Promise\.all\(\[/);
  assert.match(src, /getShopifyCustomerMetrics\(\)/);
  assert.match(src, /getShopifyOverviewMetrics\(\)/);
});

test("last-known-good cache fallback remains in the read path", () => {
  const src = readFileSync("src/lib/cache/server-data.ts", "utf8");
  assert.match(src, /lastGood/);
  assert.match(src, /stale-fallback/);
});

test("provider failure does not persist empty Meta facts", () => {
  const src = readFileSync("src/lib/ads/meta-ingest.ts", "utf8");
  assert.match(src, /persistMetaWarehouse/);
  const persistIndex = src.indexOf("persistMetaWarehouse");
  const catchIndex = src.lastIndexOf("} catch");
  assert.ok(persistIndex > 0);
  assert.ok(catchIndex > persistIndex);
});

test("Overview stays product-focused; engineering health lives on /health", () => {
  const overview = readFileSync("src/app/(dashboard)/page.tsx", "utf8");
  assert.doesNotMatch(overview, /DataHealthStrip/);
  assert.doesNotMatch(overview, /NeedsAttention/);
  const health = readFileSync("src/app/(dashboard)/health/page.tsx", "utf8");
  assert.match(health, /DataHealthStrip/);
  assert.match(health, /NeedsAttention/);
  assert.match(health, /RefreshControls/);
});
