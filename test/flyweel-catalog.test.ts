import assert from "node:assert/strict";
import test from "node:test";
import {
  FLYWEEL_BASELINE_METRICS,
  chunkMetrics,
  documentedFlyweelMetaCatalog,
  groupedFlyweelMetaMetricBatches,
  splitMetricBatch,
  unknownMetricsFromError,
} from "../src/lib/ads/providers/flyweel-catalog.ts";
import {
  catalogFromMcpTools,
  coverageFromHealth,
  extractMetricNamesFromSchema,
} from "../src/lib/ads/providers/flyweel-metrics.ts";
import {
  mergeInsightBatches,
  normalizeInsightRow,
  parseMetricScalar,
} from "../src/lib/ads/providers/normalize.ts";
import { FLYWEEL_METRIC_LIMIT } from "../src/lib/ads/providers/config.ts";
import {
  COLUMN_PRESETS,
  CAMPAIGN_COLUMNS,
  CHILD_UNSUPPORTED_PLATFORM_METRICS,
  isChildPlatformMetric,
  pickerColumns,
  totalCampaignPerformance,
} from "../src/lib/attribution/meta-performance-grid.ts";
import { searchMetricDefinitions } from "../src/lib/attribution/meta-metric-defs.ts";
import { joinMetaAndOurCampaigns } from "../src/lib/attribution/campaign-map.ts";

test("metric batches stay at or under the Flyweel 30-metric limit", () => {
  const names = documentedFlyweelMetaCatalog().map((item) => item.name);
  const batches = groupedFlyweelMetaMetricBatches(names, FLYWEEL_METRIC_LIMIT);
  assert.ok(batches.length >= 2);
  for (const batch of batches) {
    assert.ok(batch.length <= FLYWEEL_METRIC_LIMIT);
  }
  assert.equal(chunkMetrics(names, 30).every((batch) => batch.length <= 30), true);
  assert.ok(names.length > FLYWEEL_BASELINE_METRICS.length);
});

test("MCP schema enum is preferred when query_metrics exposes metrics", () => {
  const names = extractMetricNamesFromSchema({
    type: "object",
    properties: {
      queries: {
        type: "array",
        items: {
          properties: {
            metrics: { type: "array", items: { enum: ["spend", "impressions", "purchases"] } },
          },
        },
      },
    },
  });
  assert.deepEqual(names, ["spend", "impressions", "purchases"]);
  const catalog = catalogFromMcpTools([
    {
      name: "query_metrics",
      inputSchema: {
        type: "object",
        properties: {
          metrics: { type: "array", items: { enum: ["spend", "impressions", "clicks", "conversions", "cpc", "cpm", "ctr", "reach", "cost_per_conversion", "conversion_rate", "purchases"] } },
        },
      },
    },
  ]);
  assert.ok(catalog);
  assert.ok(catalog.some((item) => item.name === "purchases"));
});

test("multi-batch Flyweel rows merge into one campaign/day fact", () => {
  const delivery = normalizeInsightRow(
    { date: "2026-08-14", campaign_id: "c1", campaign: "ASC", spend: 40, impressions: 1000 },
    { accountId: "209273195421975", provider: "flyweel" },
  );
  const commerce = normalizeInsightRow(
    {
      date: "2026-08-14",
      campaign_id: "c1",
      campaign: "ASC",
      purchases: 3,
      purchase_value: 90,
      add_to_cart: 12,
      initiate_checkout: 5,
      landing_page_views: 80,
      link_clicks: 25,
    },
    { accountId: "209273195421975", provider: "flyweel" },
  );
  const video = normalizeInsightRow(
    {
      date: "2026-08-14",
      campaign_id: "c1",
      video_p25_watched_actions: 9,
      quality_ranking: "ABOVE_AVERAGE",
    },
    { accountId: "209273195421975", provider: "flyweel" },
  );
  const merged = mergeInsightBatches([[delivery], [commerce], [video]]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].spend, 40);
  assert.equal(merged[0].impressions, 1000);
  assert.equal(merged[0].purchases, 3);
  assert.equal(merged[0].purchaseValue, 90);
  assert.equal(merged[0].addToCart, 12);
  assert.equal(merged[0].initiateCheckout, 5);
  assert.equal(merged[0].landingPageViews, 80);
  assert.equal(merged[0].linkClicks, 25);
  assert.equal(merged[0].videoP25, 9);
  assert.equal(merged[0].qualityRanking, "ABOVE_AVERAGE");
  assert.equal(merged[0].costPerAddToCart, 40 / 12);
  assert.equal(merged[0].costPerCheckout, 40 / 5);
  assert.equal(merged[0].costPerPurchase, 40 / 3);
  assert.equal(merged[0].roas, 90 / 40);
});

test("generic conversions are not Purchases", () => {
  const row = normalizeInsightRow(
    { date: "2026-08-14", campaign_id: "c1", conversions: 8, spend: 20 },
    { accountId: "9", provider: "flyweel" },
  );
  assert.equal(row.conversions, 8);
  assert.equal(row.purchases, null);
  const purchased = normalizeInsightRow(
    { date: "2026-08-14", campaign_id: "c1", purchases: 2, conversions: 8 },
    { accountId: "9", provider: "flyweel" },
  );
  assert.equal(purchased.purchases, 2);
  assert.equal(purchased.conversions, 8);
});

test("funnel aliases parse without inventing zeros for missing fields", () => {
  const row = normalizeInsightRow(
    {
      date: "2026-08-14",
      campaign_id: "c1",
      add_to_cart: 4,
      initiate_checkout: 1,
      purchase_value: 50,
      link_clicks: 11,
    },
    { accountId: "9", provider: "flyweel" },
  );
  assert.equal(row.addToCart, 4);
  assert.equal(row.initiateCheckout, 1);
  assert.equal(row.purchaseValue, 50);
  assert.equal(row.linkClicks, 11);
  assert.equal(row.landingPageViews, null);
  assert.equal(row.purchases, null);
});

test("text ranking values are not coerced to 0", () => {
  assert.equal(parseMetricScalar("ABOVE_AVERAGE"), "ABOVE_AVERAGE");
  const row = normalizeInsightRow(
    { date: "2026-08-14", campaign_id: "c1", quality_ranking: "ABOVE_AVERAGE", spend: 5 },
    { accountId: "9", provider: "flyweel" },
  );
  assert.equal(row.qualityRanking, "ABOVE_AVERAGE");
  assert.notEqual(row.qualityRanking, 0);
});

test("unsupported optional metric isolation keeps remaining metrics", () => {
  const requested = ["spend", "not_a_real_metric", "impressions"];
  const unknown = unknownMetricsFromError('Unknown metric "not_a_real_metric"', requested);
  assert.deepEqual(unknown, ["not_a_real_metric"]);
  const [left, right] = splitMetricBatch(requested);
  assert.equal(left.length + right.length, requested.length);
  assert.equal(
    coverageFromHealth({
      requested,
      accepted: ["spend", "impressions"],
      unknown: ["not_a_real_metric"],
      baseline: FLYWEEL_BASELINE_METRICS,
    }),
    "partial",
  );
});

test("totals derive cost and ROAS from aggregates, not averaged ratios", () => {
  const rows = joinMetaAndOurCampaigns(
    [
      {
        campaign_id: "a",
        campaign_name: "A",
        spend: 100,
        impressions: 1000,
        clicks: 10,
        purchases: 2,
        purchase_value: 80,
        add_to_cart: 8,
        initiate_checkout: 4,
      },
      {
        campaign_id: "b",
        campaign_name: "B",
        spend: 50,
        impressions: 500,
        clicks: 5,
        purchases: 1,
        purchase_value: 40,
        add_to_cart: 2,
        initiate_checkout: 1,
      },
    ],
    [],
  );
  const totals = totalCampaignPerformance(rows);
  assert.equal(totals.spend, 150);
  assert.equal(totals.addToCart, 10);
  assert.equal(totals.initiateCheckout, 5);
  assert.equal(totals.purchases, 3);
  assert.equal(totals.costAtc, 150 / 10);
  assert.equal(totals.costCheckout, 150 / 5);
  assert.equal(totals.cpa, 150 / 3);
  assert.equal(totals.metaRoas, 120 / 150);
  assert.equal(totals.reach, null);
  assert.equal(totals.frequency, null);
});

test("column search and Funnel preset are registry-driven", () => {
  const checkout = searchMetricDefinitions("checkout");
  assert.ok(checkout.some((item) => item.id === "initiateCheckout"));
  assert.ok(checkout.some((item) => item.id === "costCheckout"));
  const video = searchMetricDefinitions("video");
  assert.ok(video.some((item) => item.id.startsWith("video")));
  assert.ok(COLUMN_PRESETS.funnel.includes("landingPageViews"));
  assert.ok(COLUMN_PRESETS.funnel.includes("addToCart"));
  assert.ok(COLUMN_PRESETS.funnel.includes("initiateCheckout"));
  assert.ok(COLUMN_PRESETS.creative.includes("videoP25"));
  assert.ok(COLUMN_PRESETS.performance.includes("ourRevenue"));
  assert.ok(pickerColumns("Funnel", "").some((item) => item.id === "addToCart"));
  assert.ok(CAMPAIGN_COLUMNS.some((item) => item.id === "conversions"));
});

test("child grains still have no Meta platform metrics", () => {
  for (const id of CHILD_UNSUPPORTED_PLATFORM_METRICS) {
    assert.equal(isChildPlatformMetric(id), true);
  }
  assert.ok(CHILD_UNSUPPORTED_PLATFORM_METRICS.includes("addToCart"));
  assert.ok(CHILD_UNSUPPORTED_PLATFORM_METRICS.includes("initiateCheckout"));
  assert.ok(CHILD_UNSUPPORTED_PLATFORM_METRICS.includes("videoP25"));
});
