import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const FORBIDDEN = [
  "getSelectedPeriod",
  "getAlignedPeriod",
  "getSelectedRange",
  "cookies(",
  "headers(",
  "readDurableJson",
  "getMetaPaste",
  "getGooglePaste",
  "loadCogsLedger",
  "getPlatformReported",
  "getMetaCredentials",
  "resolveFlyweelApiKey",
  "latestSync",
  "latestSuccessfulSync",
  "loadMetaCache",
  "getCanonicalAttributedOrders(",
  "getShopifyOverviewMetrics(",
  "getStapeFunnelMetrics(",
  "getWarehouseMetrics(",
];

function functionBody(src: string, name: string) {
  const match = src.match(
    new RegExp(`(?:export )?(?:async )?function ${name}\\s*\\(`),
  );
  if (!match || match.index == null) {
    throw new Error(`function ${name} not found`);
  }
  let i = match.index + match[0].length;
  let paren = 1;
  while (i < src.length && paren > 0) {
    if (src[i] === "(") paren += 1;
    else if (src[i] === ")") paren -= 1;
    i += 1;
  }
  while (i < src.length && src[i] !== "{") i += 1;
  if (src[i] !== "{") {
    throw new Error(`function ${name} has no body`);
  }
  const brace = i;
  let depth = 0;
  for (; i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    if (src[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        return src.slice(brace, i + 1);
      }
    }
  }
  throw new Error(`function ${name} is unclosed`);
}

function assertCacheSafe(label: string, body: string) {
  for (const token of FORBIDDEN) {
    assert.equal(
      body.includes(token),
      false,
      `${label} must not access ${token} inside unstable_cache`,
    );
  }
}

test("getCanonicalAttributedOrders resolves cookies outside cache", () => {
  const src = readFileSync("src/lib/warehouse/canonical-orders.ts", "utf8");
  assert.match(src, /export const getCanonicalAttributedOrdersForPeriod/);
  assert.match(
    src,
    /fn:\s*\(\)\s*=>\s*computeCanonicalAttributedOrders\(period, lookbackDays\)/,
  );
  const wrapper = functionBody(src, "getCanonicalAttributedOrders");
  assert.match(wrapper, /getAlignedPeriod/);
  assertCacheSafe(
    "computeCanonicalAttributedOrders",
    functionBody(src, "computeCanonicalAttributedOrders"),
  );
});

test("getWarehouseMetrics never re-resolves period or paste inside cache", () => {
  const src = readFileSync("src/lib/warehouse/get-warehouse-metrics.ts", "utf8");
  const cached = functionBody(src, "loadWarehouseMetrics");
  assert.match(cached, /getCanonicalAttributedOrdersForPeriod/);
  assertCacheSafe("loadWarehouseMetrics", cached);
  const wrapper = functionBody(src, "getWarehouseMetricsForPeriod");
  assert.match(wrapper, /getPlatformReported/);
  assert.match(wrapper, /applyPlatformSpend/);
});

test("getCoreDashboard does not cache cookie-backed paste or COGS", () => {
  const src = readFileSync("src/lib/dashboard/core-metrics.ts", "utf8");
  assert.doesNotMatch(src, /cachedLoad/);
  assert.doesNotMatch(src, /unstable_cache/);
  assert.match(src, /getMetaPaste/);
  assert.match(src, /loadCogsLedger/);
});

test("getPlatformReported does not use unstable_cache", () => {
  const src = readFileSync("src/lib/ads/get-platform-reported.ts", "utf8");
  assert.doesNotMatch(src, /cachedLoad/);
  assert.doesNotMatch(src, /unstable_cache/);
  assert.match(src, /readDurableJson/);
});

test("remaining cached loaders do not touch request APIs", () => {
  const cases: Array<[string, string]> = [
    ["src/lib/shopify/get-overview-metrics.ts", "loadShopifyOverview"],
    ["src/lib/stape/get-funnel-metrics.ts", "loadFunnelMetrics"],
    ["src/lib/shopify/get-customer-metrics.ts", "loadShopifyCustomerMetrics"],
    ["src/lib/ads/meta-query.ts", "queryFacts"],
  ];
  for (const [file, name] of cases) {
    assertCacheSafe(name, functionBody(readFileSync(file, "utf8"), name));
  }
});

test("health is not wrapped in unstable_cache", () => {
  const src = readFileSync("src/lib/platform/health.ts", "utf8");
  assert.doesNotMatch(src, /cachedLoad/);
  assert.doesNotMatch(src, /unstable_cache/);
});
