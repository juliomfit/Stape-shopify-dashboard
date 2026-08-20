import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { joinMetaAndOurCampaigns } from "../src/lib/attribution/campaign-map.ts";
import {
  CHILD_UNSUPPORTED_PLATFORM_METRICS,
  COLUMN_PRESETS,
  DEFAULT_CAMPAIGN_COLUMNS,
  chartMetricsForGrain,
  filterCampaignsByMapping,
  formatMoneyCell,
  formatOrdersCell,
  isChildPlatformMetric,
  searchCampaignRows,
  sortCampaignRows,
  totalCampaignPerformance,
  visibleCampaignColumns,
} from "../src/lib/attribution/meta-performance-grid.ts";
import { META_STORY_CAMPAIGNS } from "../src/lib/attribution/meta-performance-demo.ts";

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
  }
  assert.match(readFileSync("src/app/(dashboard)/meta/story/page.tsx", "utf8"), /meta-performance-demo/);
});
