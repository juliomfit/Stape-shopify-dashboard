import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { META_SYNC_ALREADY_RUNNING } from "../src/lib/platform/sync-run-state.ts";

test("manual Meta refresh enqueues via after() and returns 202", () => {
  const route = readFileSync("src/app/api/meta/refresh/route.ts", "utf8");
  assert.match(route, /export const maxDuration = 300/);
  assert.match(route, /from "next\/server"/);
  assert.match(route, /after\(async \(\) => \{/);
  assert.match(route, /plan\.execute\(\)/);
  assert.match(route, /status: 202/);
  const worker = readFileSync("src/app/api/meta/sync/route.ts", "utf8");
  assert.match(worker, /export const maxDuration = 300/);
  assert.match(worker, /runScheduledSync/);
});

test("overlapping refresh is rejected before after() schedules work", () => {
  const enqueue = readFileSync("src/lib/platform/enqueue-refresh.ts", "utf8");
  assert.match(enqueue, /findActiveSyncRun/);
  assert.match(enqueue, /status: 409/);
  assert.match(enqueue, /META_SYNC_ALREADY_RUNNING/);
  assert.equal(META_SYNC_ALREADY_RUNNING, "Meta sync already running");
});

test("background Meta cron actually runs provider ingestion", () => {
  const metaCron = readFileSync("src/app/api/cron/meta/route.ts", "utf8");
  assert.match(metaCron, /handleSourceCron\(request, "meta"\)/);
  const handler = readFileSync("src/lib/cron/handler.ts", "utf8");
  assert.match(handler, /runScheduledSync\(source/);
  const orchestrator = readFileSync("src/lib/platform/orchestrator.ts", "utf8");
  assert.match(orchestrator, /if \(source === "meta"\)/);
  assert.match(orchestrator, /syncMetaHourly/);
  const ingest = readFileSync("src/lib/ads/meta-ingest.ts", "utf8");
  assert.match(ingest, /provider\.getInsights/);
});

test("source-specific cron jobs do not execute all other sources sequentially", () => {
  for (const file of [
    "src/app/api/cron/meta/route.ts",
    "src/app/api/cron/shopify/route.ts",
    "src/app/api/cron/ga4/route.ts",
    "src/app/api/cron/stape/route.ts",
  ]) {
    const src = readFileSync(file, "utf8");
    assert.doesNotMatch(src, /"all"/);
    assert.doesNotMatch(src, /runScheduledSync\("all"/);
  }
  const daily = readFileSync("src/lib/platform/orchestrator.ts", "utf8");
  assert.match(daily, /export async function runDailyReconciliation/);
  assert.match(daily, /Promise\.allSettled/);
  const allBranch = daily.slice(daily.indexOf('if (source === "all")'));
  assert.match(allBranch, /const meta = await runScheduledSync\("meta"/);
});

test("Shopify background job writes the prepared warehouse instead of only warming Admin cache", () => {
  const orchestrator = readFileSync("src/lib/platform/orchestrator.ts", "utf8");
  assert.match(orchestrator, /ingestShopifyIncremental/);
  assert.match(orchestrator, /shopifyLookbackDays/);
  const ingest = readFileSync("src/lib/shopify/ingest.ts", "utf8");
  assert.match(ingest, /mergeShopifyOrderRecords/);
  assert.match(ingest, /expandShopifyWarehouseCoverage/);
  const warehouse = readFileSync("src/lib/shopify/warehouse.ts", "utf8");
  assert.match(warehouse, /MERGE /);
  assert.match(warehouse, /fct_shopify_orders/);
  assert.match(warehouse, /CREATE TABLE IF NOT EXISTS/);
  assert.match(warehouse, /shopify_ingest_coverage/);
  assert.doesNotMatch(warehouse, /writeDurableJson/);
});

test("freshness endpoint is a lightweight version check", () => {
  const src = readFileSync("src/app/api/freshness/route.ts", "utf8");
  assert.match(src, /getFreshnessSnapshot/);
  assert.match(src, /firstFillSourcesFromSnapshot/);
  assert.match(src, /after\(/);
  assert.doesNotMatch(src, /getInsights/);
  assert.doesNotMatch(src, /query_metrics/);
  assert.doesNotMatch(src, /getCanonicalAttributedOrders/);
  assert.doesNotMatch(src, /ingestShopifyIncremental/);
  const badge = readFileSync("src/components/dashboard/FreshnessBadge.tsx", "utf8");
  assert.match(badge, /\/api\/freshness/);
  assert.match(badge, /router\.refresh\(\)/);
});

test("public build SHA is ungated and cron status stays behind CRON_SECRET", () => {
  const proxy = readFileSync("src/proxy.ts", "utf8");
  assert.match(proxy, /pathname === "\/api\/build"/);
  const build = readFileSync("src/app/api/build/route.ts", "utf8");
  assert.match(build, /publicBuildInfo/);
  assert.match(build, /getPreparedServing/);
  assert.doesNotMatch(build, /dashboardPassword/);
  assert.doesNotMatch(build, /rowCount/);
  const prepared = readFileSync("src/lib/platform/prepared-serving.ts", "utf8");
  assert.match(prepared, /Booleans only/);
  const status = readFileSync("src/app/api/cron/status/route.ts", "utf8");
  assert.match(status, /cronAuthorized/);
  assert.match(status, /getIngestStatus/);
  const vercel = readFileSync("vercel.json", "utf8");
  assert.doesNotMatch(vercel, /\/api\/cron\/status/);
  assert.doesNotMatch(vercel, /\/api\/build/);
  assert.match(vercel, /\/api\/cron\/evening/);
});
