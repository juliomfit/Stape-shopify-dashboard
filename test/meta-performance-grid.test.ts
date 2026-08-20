import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { joinMetaAndOurCampaigns } from "../src/lib/attribution/campaign-map.ts";
import { ALL_CAMPAIGNS_KEY } from "../src/lib/attribution/observed-meta-grain.ts";
import {
  CHILD_UNSUPPORTED_PLATFORM_METRICS,
  COLUMN_PRESETS,
  DEFAULT_CAMPAIGN_COLUMNS,
  MISSING_CAMPAIGN_PLATFORM_SERIES,
  OUR_CHART_DESCRIPTION,
  OUR_CHART_SOURCE,
  PLATFORM_CHART_DESCRIPTION,
  PLATFORM_CHART_SOURCE,
  chartMetricCopy,
  chartMetricsForGrain,
  filterCampaignsByMapping,
  formatCountCell,
  formatFrequencyCell,
  formatMoneyCell,
  formatOrdersCell,
  isChildPlatformMetric,
  isPlatformChartMetric,
  resolvePlatformDailySeries,
  searchCampaignRows,
  sortCampaignRows,
  totalCampaignPerformance,
  visibleCampaignColumns,
  type PlatformDailySeries,
} from "../src/lib/attribution/meta-performance-grid.ts";
import { isMetaStoryAllowed } from "../src/lib/attribution/meta-story-guard.ts";
import { META_STORY_CAMPAIGNS } from "../src/lib/attribution/meta-performance-demo.ts";

function platformSeries(spend: number[]): PlatformDailySeries {
  return {
    spend,
    purchase_value: spend.map(() => 1),
    purchases: spend.map(() => 1),
    roas: spend.map(() => 1),
    cpa: spend.map(() => 1),
    cpm: spend.map(() => 1),
    ctr: spend.map(() => 1),
    cpc: spend.map(() => 1),
    frequency: spend.map(() => 1),
  };
}

test("performance preset is the default campaign column set", () => {
  assert.deepEqual(DEFAULT_CAMPAIGN_COLUMNS, COLUMN_PRESETS.performance);
  assert.ok(DEFAULT_CAMPAIGN_COLUMNS.includes("spend"));
  assert.ok(DEFAULT_CAMPAIGN_COLUMNS.includes("ourRevenue"));
  assert.ok(DEFAULT_CAMPAIGN_COLUMNS.includes("mapping"));
  assert.equal(visibleCampaignColumns(DEFAULT_CAMPAIGN_COLUMNS)[0]?.id, "campaign");
});

test("campaign search matches decoded display names", () => {
  const rows = joinMetaAndOurCampaigns(
    [
      {
        campaign_id: "uuid-1",
        campaign_name: "USA CBO | APRIL 17 | Batch 1-5",
        spend: 100,
        impressions: 10,
        clicks: 2,
        purchases: 1,
        purchase_value: 0,
      },
    ],
    [
      {
        campaign: "USA+CBO+%7C+APRIL+17+%7C+Batch+1-5",
        channel: "Facebook / Meta Ads",
        orders: 8.4,
        revenue: 200,
      },
    ],
  );
  const found = searchCampaignRows(rows, "USA CBO");
  assert.equal(found.length, 1);
  assert.equal(found[0]?.ourOrders, 8.4);
});

test("sort spend descending then ascending", () => {
  const desc = sortCampaignRows(META_STORY_CAMPAIGNS, "spend", "desc");
  assert.equal(desc[0]?.campaignName, "USA CBO | APRIL 17 | Batch 1-5");
  assert.ok((desc[0]?.spend ?? 0) >= (desc[1]?.spend ?? 0));
  const asc = sortCampaignRows(META_STORY_CAMPAIGNS, "spend", "asc");
  assert.ok((asc[0]?.spend ?? 0) <= (asc[1]?.spend ?? 0));
});

test("totals use aggregate formulas, not averaged row rates", () => {
  const totals = totalCampaignPerformance(META_STORY_CAMPAIGNS);
  const spend = META_STORY_CAMPAIGNS.reduce((sum, row) => sum + row.spend, 0);
  const clicks = META_STORY_CAMPAIGNS.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = META_STORY_CAMPAIGNS.reduce((sum, row) => sum + row.impressions, 0);
  const ourRevenue = META_STORY_CAMPAIGNS.reduce((sum, row) => sum + row.ourRevenue, 0);
  const ourOrders = META_STORY_CAMPAIGNS.reduce((sum, row) => sum + row.ourOrders, 0);
  assert.equal(totals.spend, spend);
  assert.equal(totals.clicks, clicks);
  assert.equal(totals.ctr, clicks / impressions);
  assert.notEqual(
    totals.ctr,
    META_STORY_CAMPAIGNS.reduce((sum, row) => sum + (row.ctr ?? 0), 0) / META_STORY_CAMPAIGNS.length,
  );
  assert.equal(totals.ourRoas, ourRevenue / spend);
  assert.equal(totals.ourOrders, ourOrders);
});

test("unavailable platform metrics render em dash, measured zero renders $0.00", () => {
  assert.equal(formatMoneyCell(0, true, "USD"), "$0.00");
  assert.equal(formatMoneyCell(0, false, "USD"), "—");
  assert.equal(formatOrdersCell(8.4), "8.4");
  assert.notEqual(formatOrdersCell(8.4), "8");
});

test("child grains do not support Flyweel platform metrics", () => {
  for (const id of CHILD_UNSUPPORTED_PLATFORM_METRICS) {
    assert.equal(isChildPlatformMetric(id), true);
  }
  const child = chartMetricsForGrain("adsets").map((row) => row.id);
  assert.deepEqual(child, [
    "ourRevenue",
    "attributedOrders",
    "newCustomerRevenue",
    "newCustomerCredit",
  ]);
  assert.equal(child.includes("spend"), false);
  assert.ok(chartMetricsForGrain("campaigns").some((row) => row.id === "spend"));
});

test("mapping filter does not split the performance table", () => {
  const all = filterCampaignsByMapping(META_STORY_CAMPAIGNS, "all");
  assert.equal(all.length, 3);
  const named = filterCampaignsByMapping(META_STORY_CAMPAIGNS, "name_match");
  assert.equal(named.length, 2);
  const needs = filterCampaignsByMapping(META_STORY_CAMPAIGNS, "needs_mapping");
  assert.equal(needs.length, 1);
  assert.equal(needs[0]?.mappingMethod, "unmapped");
});

test("join preserves reach and link clicks from campaign facts", () => {
  const rows = joinMetaAndOurCampaigns(
    [
      {
        campaign_id: "111",
        campaign_name: "Prospecting",
        spend: 100,
        impressions: 1000,
        clicks: 50,
        purchases: 2,
        purchase_value: 0,
        reach: 800,
        inline_link_clicks: 40,
      },
    ],
    [{ campaign: "111", channel: "Facebook / Meta Ads", orders: 1.5, revenue: 80 }],
  );
  const row = rows.find((item) => item.campaignId === "111");
  assert.equal(row?.reach, 800);
  assert.equal(row?.linkClicks, 40);
  assert.equal(row?.ourOrders, 1.5);
  assert.equal(row?.platformPresent, true);
  assert.equal(row?.frequency, 1000 / 800);
});

test("demo fixture is not imported by production loaders", () => {
  const loaders = [
    "src/lib/ads/meta-query.ts",
    "src/lib/warehouse/canonical-orders.ts",
    "src/lib/warehouse/get-warehouse-metrics.ts",
    "src/lib/cache/server-data.ts",
    "src/app/(dashboard)/meta/page.tsx",
  ];
  for (const file of loaders) {
    const src = readFileSync(file, "utf8");
    assert.doesNotMatch(src, /meta-performance-demo/);
    assert.doesNotMatch(src, /META_STORY_/);
  }
  assert.match(readFileSync("src/app/(dashboard)/meta/story/page.tsx", "utf8"), /meta-performance-demo/);
});

test("platform chart copy is Flyweel date, OUR copy is purchase-day attribution", () => {
  for (const id of ["spend", "metaRevenue", "metaRoas", "purchases", "cpa"] as const) {
    assert.equal(isPlatformChartMetric(id), true);
    const copy = chartMetricCopy(id);
    assert.equal(copy.source, PLATFORM_CHART_SOURCE);
    assert.equal(copy.description, PLATFORM_CHART_DESCRIPTION);
    assert.doesNotMatch(copy.source, /GoodsNova/);
    assert.doesNotMatch(copy.description, /purchase day/);
    assert.doesNotMatch(copy.description, /attribution/i);
  }
  for (const id of [
    "ourRevenue",
    "ourRoas",
    "attributedOrders",
    "newCustomerRevenue",
    "newCustomerCredit",
  ] as const) {
    assert.equal(isPlatformChartMetric(id), false);
    const copy = chartMetricCopy(id);
    assert.equal(copy.source, OUR_CHART_SOURCE);
    assert.equal(copy.description, OUR_CHART_DESCRIPTION);
  }
});

test("missing per-campaign platform series never falls back to account totals", () => {
  const account = platformSeries([999, 888, 777]);
  const campaignA = platformSeries([10, 20, 30]);
  const byCampaign = { "camp-a": campaignA };
  const all = resolvePlatformDailySeries({
    entityKey: ALL_CAMPAIGNS_KEY,
    allCampaignsKey: ALL_CAMPAIGNS_KEY,
    platformDaily: account,
    platformDailyByCampaign: byCampaign,
  });
  assert.equal(all, account);
  assert.deepEqual(all?.spend, [999, 888, 777]);

  const matched = resolvePlatformDailySeries({
    entityKey: "camp-a",
    allCampaignsKey: ALL_CAMPAIGNS_KEY,
    platformDaily: account,
    platformDailyByCampaign: byCampaign,
  });
  assert.equal(matched, campaignA);
  assert.deepEqual(matched?.spend, [10, 20, 30]);

  const missing = resolvePlatformDailySeries({
    entityKey: "our-only-campaign",
    allCampaignsKey: ALL_CAMPAIGNS_KEY,
    platformDaily: account,
    platformDailyByCampaign: byCampaign,
  });
  assert.equal(missing, null);
  assert.notEqual(missing, account);
  assert.notDeepEqual(missing?.spend, account.spend);

  const workspace = readFileSync("src/components/dashboard/MetaPerformanceWorkspace.tsx", "utf8");
  assert.equal(MISSING_CAMPAIGN_PLATFORM_SERIES, "No platform series available for this campaign");
  assert.match(workspace, /resolvePlatformDailySeries/);
  assert.match(workspace, /MISSING_CAMPAIGN_PLATFORM_SERIES/);
  assert.doesNotMatch(workspace, /\?\? platformDaily/);
  assert.doesNotMatch(
    workspace,
    /GoodsNova first-party attribution\. Same existing credit grouped by purchase day/,
  );
});

test("total row Reach and Frequency are unavailable, not summed campaign reach", () => {
  const totals = totalCampaignPerformance(META_STORY_CAMPAIGNS);
  const summedReach = META_STORY_CAMPAIGNS.reduce((sum, row) => sum + row.reach, 0);
  assert.ok(summedReach > 0);
  assert.ok((META_STORY_CAMPAIGNS[0]?.reach ?? 0) > 0);
  assert.equal(totals.reach, null);
  assert.equal(totals.frequency, null);
  assert.notEqual(totals.reach, summedReach);
  assert.equal(formatCountCell(totals.reach, false), "—");
  assert.equal(formatFrequencyCell(totals.frequency, false), "—");
  assert.equal(totals.spend, META_STORY_CAMPAIGNS.reduce((sum, row) => sum + row.spend, 0));
  assert.equal(
    totals.impressions,
    META_STORY_CAMPAIGNS.reduce((sum, row) => sum + row.impressions, 0),
  );
});

test("story fixtures are blocked in Vercel Production and allowed in Preview", () => {
  assert.equal(isMetaStoryAllowed("production"), false);
  assert.equal(isMetaStoryAllowed("preview"), true);
  assert.equal(isMetaStoryAllowed("development"), true);
  assert.equal(isMetaStoryAllowed(undefined), true);
  const story = readFileSync("src/app/(dashboard)/meta/story/page.tsx", "utf8");
  const campaignStory = readFileSync("src/app/(dashboard)/meta/story/campaign/page.tsx", "utf8");
  for (const src of [story, campaignStory]) {
    assert.match(src, /isMetaStoryAllowed/);
    assert.match(src, /VERCEL_ENV/);
    assert.match(src, /notFound/);
  }
});
