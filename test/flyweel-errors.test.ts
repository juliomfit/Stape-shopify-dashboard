import assert from "node:assert/strict";
import test from "node:test";
import {
  applyFlyweelValidOptions,
  fetchFlyweelMetricBatches,
  FlyweelMetricQueryError,
  formatExtendedMetricsHealthMessage,
  parseFlyweelInvalidMetricNames,
  parseFlyweelValidMetricOptions,
  payloadLooksLikeError,
  sanitizeFlyweelUserError,
} from "../src/lib/ads/providers/flyweel-errors.ts";
import {
  documentedFlyweelMetaMetricNames,
  groupedFlyweelMetaMetricBatches,
} from "../src/lib/ads/providers/flyweel-catalog.ts";
import { mergeFlyweelMetricRows, normalizeInsightRow } from "../src/lib/ads/providers/normalize.ts";

const PREVIEW_ERROR_TEXT =
  'invalid_metric "unique_reach" for ads. valid_options: spend, impressions, clicks, conversions, cpc, cpm, ctr, reach, cost_per_conversion, conversion_rate, frequency, link_clicks, landing_page_views, add_to_cart, initiate_checkout, purchases, purchase_value, website_purchase_roas';

const PREVIEW_ARRAY = [{ error: PREVIEW_ERROR_TEXT }];

test("array error payload detection uses the Preview invalid_metric shape", () => {
  const detected = payloadLooksLikeError(PREVIEW_ARRAY);
  assert.ok(detected);
  assert.match(detected, /invalid_metric "unique_reach"/);
  assert.equal(
    payloadLooksLikeError({ results: [{ error: PREVIEW_ERROR_TEXT }] }),
    detected,
  );
  assert.equal(
    payloadLooksLikeError({ data: [{ error: PREVIEW_ERROR_TEXT }] }),
    detected,
  );
  assert.ok(
    payloadLooksLikeError({
      content: [{ type: "text", text: JSON.stringify(PREVIEW_ARRAY) }],
    }),
  );
  assert.equal(
    payloadLooksLikeError({
      date: "2026-08-19",
      campaign_id: "c1",
      spend: 12,
      impressions: 400,
    }),
    null,
  );
});

test("extracts valid_options and unique_reach from the live error", () => {
  const options = parseFlyweelValidMetricOptions(PREVIEW_ARRAY);
  assert.ok(options.includes("spend"));
  assert.ok(options.includes("purchases"));
  assert.ok(options.includes("add_to_cart"));
  assert.equal(options.includes("unique_reach"), false);
  assert.equal(options.includes("ads"), false);
  const invalid = parseFlyweelInvalidMetricNames(PREVIEW_ARRAY, [
    "spend",
    "unique_reach",
    "impressions",
  ]);
  assert.deepEqual(invalid, ["unique_reach"]);
  const applied = applyFlyweelValidOptions(
    ["spend", "unique_reach", "add_to_cart", "made_up_metric"],
    options,
  );
  assert.deepEqual(applied.verified, ["spend", "add_to_cart"]);
  assert.ok(applied.unknown.includes("unique_reach"));
  assert.ok(applied.unknown.includes("made_up_metric"));
});

test("unique_reach rejected then remaining metrics retried without binary search", async () => {
  const requested = documentedFlyweelMetaMetricNames();
  assert.ok(requested.includes("unique_reach"));
  const result = await fetchFlyweelMetricBatches({
    batches: groupedFlyweelMetaMetricBatches(requested),
    query: async (batches) => {
      const metrics = batches.flat();
      if (metrics.includes("unique_reach")) {
        throw new FlyweelMetricQueryError(PREVIEW_ERROR_TEXT, PREVIEW_ARRAY, metrics);
      }
      return [
        {
          date: "2026-08-19",
          campaign_id: "c1",
          campaign: "ASC",
          spend: 40,
          impressions: 1000,
          clicks: 12,
        },
      ];
    },
  });
  assert.equal(result.strategy, "valid_options");
  assert.equal(result.queryCalls, 2);
  assert.ok(result.queryCalls <= 3);
  assert.equal(result.accepted.includes("unique_reach"), false);
  assert.ok(result.unknown.includes("unique_reach"));
  assert.ok(result.accepted.includes("spend"));
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].spend, 40);
});

test("valid_options prevents unnecessary binary probe calls", async () => {
  const requested = ["spend", "unique_reach", "not_real_a", "not_real_b", "impressions"];
  const result = await fetchFlyweelMetricBatches({
    batches: [requested],
    query: async (batches) => {
      const metrics = batches.flat();
      if (metrics.some((name) => name.startsWith("not_real") || name === "unique_reach")) {
        throw new FlyweelMetricQueryError(PREVIEW_ERROR_TEXT, PREVIEW_ARRAY, metrics);
      }
      return [{ date: "2026-08-19", campaign_id: "c1", spend: 5, impressions: 50 }];
    },
  });
  assert.equal(result.strategy, "valid_options");
  assert.equal(result.queryCalls, 2);
  assert.equal(result.accepted.includes("not_real_a"), false);
  assert.deepEqual(result.accepted.sort(), ["impressions", "spend"].sort());
});

test("baseline fallback remains operational when no verified extended metrics remain", async () => {
  const result = await fetchFlyweelMetricBatches({
    batches: [["unique_reach", "not_a_metric"]],
    query: async (batches) => {
      const metrics = batches.flat();
      if (metrics.includes("unique_reach") || metrics.includes("not_a_metric")) {
        throw new FlyweelMetricQueryError(
          'invalid_metric "unique_reach" for ads. valid_options: spend, impressions, clicks, conversions, cpc, cpm, ctr, reach, cost_per_conversion, conversion_rate',
          null,
          metrics,
        );
      }
      return [{ date: "2026-08-19", campaign_id: "c1", spend: 9, impressions: 90, clicks: 3 }];
    },
  });
  assert.equal(result.strategy, "baseline");
  assert.ok(result.accepted.includes("spend"));
  assert.equal(result.rows[0].spend, 9);
});

test("three raw metric batches merge into one campaign/day before normalize", () => {
  const merged = mergeFlyweelMetricRows(
    [
      { date: "2026-08-14", campaign_id: "c1", campaign: "ASC", spend: 100, impressions: 1000, clicks: 20 },
      {
        date: "2026-08-14",
        campaign_id: "c1",
        add_to_cart: 20,
        initiate_checkout: 7,
        purchases: 5,
        purchase_value: 250,
      },
      {
        date: "2026-08-14",
        campaign_id: "c1",
        video_p25_watched_actions: 9,
        video_thruplay_watched_actions: 4,
      },
    ],
    "209273195421975",
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].spend, 100);
  assert.equal(merged[0].clicks, 20);
  assert.equal(merged[0].add_to_cart, 20);
  assert.equal(merged[0].initiate_checkout, 7);
  assert.equal(merged[0].purchases, 5);
  assert.equal(merged[0].purchase_value, 250);
  assert.equal(merged[0].video_thruplay_watched_actions, 4);
  const row = normalizeInsightRow(merged[0], { accountId: "209273195421975", provider: "flyweel" });
  assert.equal(row.spend, 100);
  assert.equal(row.clicks, 20);
  assert.equal(row.addToCart, 20);
  assert.equal(row.initiateCheckout, 7);
  assert.equal(row.purchases, 5);
  assert.equal(row.purchaseValue, 250);
  assert.equal(row.videoP25, 9);
  assert.equal(row.extended.video_thruplay_watched_actions, 4);
  assert.equal(row.landingPageViews, null);
});

test("missing optional metric is not measured zero", () => {
  const merged = mergeFlyweelMetricRows(
    [
      { date: "2026-08-14", campaign_id: "c1", spend: 40, impressions: 800 },
      { date: "2026-08-14", campaign_id: "c1", add_to_cart: 0 },
    ],
    "9",
  );
  const row = normalizeInsightRow(merged[0], { accountId: "9", provider: "flyweel" });
  assert.equal(row.spend, 40);
  assert.equal(row.addToCart, 0);
  assert.equal(row.purchases, null);
  assert.equal(row.initiateCheckout, null);
});

test("generic conversions never become purchases after raw merge", () => {
  const merged = mergeFlyweelMetricRows(
    [
      { date: "2026-08-14", campaign_id: "c1", spend: 20, conversions: 8 },
      { date: "2026-08-14", campaign_id: "c1", add_to_cart: 3 },
    ],
    "9",
  );
  const row = normalizeInsightRow(merged[0], { accountId: "9", provider: "flyweel" });
  assert.equal(row.conversions, 8);
  assert.equal(row.purchases, null);
  assert.equal(row.addToCart, 3);
});

test("user-facing health copy stays concise", () => {
  const dumped = sanitizeFlyweelUserError(
    `Flyweel returned 0 campaign rows after parsing. Last metrics payload: ${JSON.stringify(PREVIEW_ARRAY)}`,
  );
  assert.equal(dumped.includes("invalid_metric"), false);
  assert.equal(dumped.includes("unique_reach"), false);
  assert.match(dumped, /Extended Meta metrics partially supported/);
  const partial = formatExtendedMetricsHealthMessage({
    coverage: "partial",
    candidateCount: 75,
    acceptedCount: 18,
    unknownCount: 57,
  });
  assert.equal(
    partial,
    "Extended Meta metrics partially supported. 18 of 75 candidate metrics accepted. 57 unsupported metrics skipped.",
  );
});
