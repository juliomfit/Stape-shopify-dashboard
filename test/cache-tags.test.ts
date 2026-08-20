import assert from "node:assert/strict";
import test from "node:test";
import { CACHE_TAGS, tagsForSource } from "../src/lib/cache/tags.ts";

test("Meta refresh does not invalidate Shopify", () => {
  const tags = tagsForSource("meta");
  assert.ok(tags.includes(CACHE_TAGS.meta));
  assert.ok(tags.includes(CACHE_TAGS.dashboardCore));
  assert.equal(tags.includes(CACHE_TAGS.shopify), false);
  assert.equal(tags.includes(CACHE_TAGS.warehouse), false);
});

test("Shopify refresh invalidates Shopify and core, not Meta warehouse facts", () => {
  const tags = tagsForSource("shopify");
  assert.ok(tags.includes(CACHE_TAGS.shopify));
  assert.ok(tags.includes(CACHE_TAGS.dashboardCore));
  assert.equal(tags.includes(CACHE_TAGS.meta), false);
});

test("Google Ads refresh does not clear Shopify", () => {
  const tags = tagsForSource("google_ads");
  assert.equal(tags.includes(CACHE_TAGS.shopify), false);
  assert.ok(tags.includes(CACHE_TAGS.dashboardCore));
});

test("refresh all covers every dashboard cache tag", () => {
  const tags = new Set(tagsForSource("all"));
  for (const tag of Object.values(CACHE_TAGS)) {
    assert.ok(tags.has(tag), tag);
  }
});
