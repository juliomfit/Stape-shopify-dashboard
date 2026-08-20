import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  CACHE_TAGS,
  DASHBOARD_CACHE_SECONDS,
  revalidateProfile,
  tagsForMutation,
  tagsForSource,
} from "../src/lib/cache/tags.ts";

test("ordinary navigation cache remains 45 seconds", () => {
  assert.equal(DASHBOARD_CACHE_SECONDS, 45);
  const serverData = readFileSync("src/lib/cache/server-data.ts", "utf8");
  assert.match(serverData, /revalidate:\s*DASHBOARD_CACHE_SECONDS/);
});

test("hard invalidation expires immediately; SWR uses max", () => {
  assert.deepEqual(revalidateProfile("hard"), { expire: 0 });
  assert.equal(revalidateProfile("swr"), "max");
});

test("COGS mutation expires cogs only, not Shopify Meta or Stape", () => {
  const tags = tagsForMutation("cogs");
  assert.deepEqual([...tags], [CACHE_TAGS.cogs]);
  assert.equal(tags.includes(CACHE_TAGS.shopify), false);
  assert.equal(tags.includes(CACHE_TAGS.meta), false);
  assert.equal(tags.includes(CACHE_TAGS.stape), false);
  assert.equal(tags.includes(CACHE_TAGS.warehouse), false);
});

test("paste mutation expires paste only, not Shopify Stape or Meta facts", () => {
  const tags = tagsForMutation("paste");
  assert.deepEqual([...tags], [CACHE_TAGS.paste]);
  assert.equal(tags.includes(CACHE_TAGS.shopify), false);
  assert.equal(tags.includes(CACHE_TAGS.stape), false);
  assert.equal(tags.includes(CACHE_TAGS.meta), false);
});

test("credential mutation expires core and health, not Shopify or Stape", () => {
  const tags = tagsForMutation("credentials");
  assert.ok(tags.includes(CACHE_TAGS.dashboardCore));
  assert.ok(tags.includes(CACHE_TAGS.health));
  assert.equal(tags.includes(CACHE_TAGS.shopify), false);
  assert.equal(tags.includes(CACHE_TAGS.stape), false);
  assert.equal(tags.includes(CACHE_TAGS.meta), false);
});

test("core dashboard is not wrapped in unstable_cache", () => {
  const core = readFileSync("src/lib/dashboard/core-metrics.ts", "utf8");
  assert.doesNotMatch(core, /cachedLoad/);
  assert.doesNotMatch(core, /unstable_cache/);
});

test("Route Handler invalidation uses revalidateTag profile, never updateTag", () => {
  const invalidate = readFileSync("src/lib/cache/invalidate.ts", "utf8");
  assert.match(invalidate, /revalidateTag\(tag, profile\)/);
  assert.match(invalidate, /options\.mode \?\? "hard"/);
  assert.match(invalidate, /function updateCachedMutation/);
  assert.match(invalidate, /updateTag\(tag\)/);
  const syncRoute = readFileSync("src/app/api/meta/sync/route.ts", "utf8");
  assert.match(syncRoute, /invalidateCachedSources\("meta", \{ mode: "hard" \}\)/);
  assert.match(syncRoute, /invalidation: "hard"/);
  assert.doesNotMatch(syncRoute, /updateTag/);
  assert.doesNotMatch(syncRoute, /revalidateTag\([^)]*"max"\)/);
});

test("explicit Refresh defaults to hard; cron uses SWR", () => {
  const orchestrator = readFileSync("src/lib/platform/orchestrator.ts", "utf8");
  assert.match(orchestrator, /options\.invalidation \?\? "hard"/);
  assert.match(orchestrator, /invalidate\("shopify", invalidation\)/);
  assert.match(orchestrator, /invalidate\("meta", invalidation\)/);
  const cron = readFileSync("src/app/api/cron/sync/route.ts", "utf8");
  assert.match(cron, /invalidation:\s*"swr"/);
  const metaCron = readFileSync("src/app/api/cron/meta/route.ts", "utf8");
  assert.match(metaCron, /handleSourceCron\(request, "meta"\)/);
  const actions = readFileSync("src/lib/platform/actions.ts", "utf8");
  assert.match(actions, /runScheduledSync\(source, \{ invalidation: "hard" \}\)/);
  assert.match(actions, /updateCachedMutation\("cogs"\)/);
  const webhooks = readFileSync("src/app/api/shopify/webhooks/route.ts", "utf8");
  assert.match(webhooks, /invalidateCachedSources\("shopify", \{ mode: "hard" \}\)/);
});

test("Meta refresh still does not invalidate Shopify", () => {
  const tags = tagsForSource("meta");
  assert.ok(tags.includes(CACHE_TAGS.meta));
  assert.ok(tags.includes(CACHE_TAGS.dashboardCore));
  assert.ok(tags.includes(CACHE_TAGS.attribution));
  assert.equal(tags.includes(CACHE_TAGS.shopify), false);
  assert.equal(tags.includes(CACHE_TAGS.warehouse), false);
});

test("Shopify refresh invalidates overview and attribution, not Meta facts", () => {
  const tags = tagsForSource("shopify");
  assert.ok(tags.includes(CACHE_TAGS.shopify));
  assert.ok(tags.includes(CACHE_TAGS.dashboardCore));
  assert.ok(tags.includes(CACHE_TAGS.attribution));
  assert.equal(tags.includes(CACHE_TAGS.meta), false);
});
