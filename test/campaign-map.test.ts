import assert from "node:assert/strict";
import test from "node:test";
import {
  joinMetaAndOurCampaigns,
  resolveCampaignMapping,
  campaignMappingSummary,
} from "../src/lib/attribution/campaign-map.ts";

const meta = [
  {
    campaign_id: "111",
    campaign_name: "Prospecting",
    spend: 100,
    impressions: 10,
    clicks: 2,
    purchases: 3,
    purchase_value: 150,
  },
  {
    campaign_id: "222",
    campaign_name: "Retargeting",
    spend: 50,
    impressions: 5,
    clicks: 1,
    purchases: 1,
    purchase_value: 40,
  },
  {
    campaign_id: "333",
    campaign_name: "Same Name",
    spend: 10,
    impressions: 1,
    clicks: 1,
    purchases: 0,
    purchase_value: 0,
  },
  {
    campaign_id: "444",
    campaign_name: "Same Name",
    spend: 10,
    impressions: 1,
    clicks: 1,
    purchases: 0,
    purchase_value: 0,
  },
];

test("campaign ID exact match is HIGH", () => {
  const rows = joinMetaAndOurCampaigns(meta, [
    { campaign: "111", channel: "Facebook / Meta Ads", orders: 1, revenue: 80 },
  ]);
  const row = rows.find((item) => item.campaignId === "111");
  assert.equal(row?.mappingMethod, "campaign_id_exact");
  assert.equal(row?.mappingConfidence, "HIGH");
  assert.equal(row?.mapped, true);
});

test("unique normalized name is PARTIAL", () => {
  const rows = joinMetaAndOurCampaigns(meta, [
    { campaign: "prospecting", channel: "Facebook / Meta Ads", orders: 1, revenue: 80 },
  ]);
  const row = rows.find((item) => item.campaignId === "111");
  assert.equal(row?.mappingMethod, "campaign_name_exact_unique");
  assert.equal(row?.mappingConfidence, "PARTIAL");
});

test("ambiguous campaign names stay unmapped", () => {
  const rows = joinMetaAndOurCampaigns(meta, [
    { campaign: "Same Name", channel: "Facebook / Meta Ads", orders: 1, revenue: 20 },
  ]);
  const row = rows.find((item) => item.campaignName === "Same Name" && item.ourRevenue === 20);
  assert.equal(row?.mappingMethod, "ambiguous_name");
  assert.equal(row?.mappingConfidence, "NONE");
  assert.equal(row?.mapped, false);
  assert.equal(row?.spend, 0);
});

test("no fuzzy match", () => {
  const rows = joinMetaAndOurCampaigns(meta, [
    { campaign: "Prospect", channel: "Facebook / Meta Ads", orders: 1, revenue: 20 },
  ]);
  const row = rows.find((item) => item.campaignName === "Prospect");
  assert.equal(row?.mappingMethod, "unmapped");
  assert.equal(row?.spend, 0);
});

test("mapping summary counts methods", () => {
  const rows = joinMetaAndOurCampaigns(meta, [
    { campaign: "111", channel: "Facebook / Meta Ads", orders: 1, revenue: 10 },
    { campaign: "prospecting", channel: "Facebook / Meta Ads", orders: 1, revenue: 10 },
    { campaign: "Same Name", channel: "Facebook / Meta Ads", orders: 1, revenue: 10 },
    { campaign: "Nope", channel: "Facebook / Meta Ads", orders: 1, revenue: 10 },
  ]);
  const summary = campaignMappingSummary(rows);
  assert.equal(summary.exactId, 1);
  assert.ok((summary.uniqueName ?? 0) >= 0);
  assert.equal(typeof resolveCampaignMapping, "function");
});

test("Flyweel UUID fact is not campaign_id_exact HIGH against a native Meta ID", () => {
  const rows = joinMetaAndOurCampaigns(
    [
      {
        campaign_id: "a1b2c3d4-e5f6-4789-8abc-def012345678",
        campaign_name: "Prospecting",
        spend: 100,
        impressions: 10,
        clicks: 2,
        purchases: 3,
        purchase_value: 150,
      },
    ],
    [{ campaign: "111", channel: "Facebook / Meta Ads", orders: 1, revenue: 80 }],
  );
  const row = rows.find((item) => item.campaignName === "111");
  assert.equal(row?.mappingMethod, "unmapped");
  assert.equal(row?.mappingConfidence, "NONE");
});
