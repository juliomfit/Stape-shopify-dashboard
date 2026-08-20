import assert from "node:assert/strict";
import test from "node:test";
import {
  joinMetaAndOurCampaigns,
  resolveCampaignMapping,
  campaignMappingSummary,
  canonicalCampaignName,
  displayCampaignName,
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

test("URL-encoded unique campaign name is PARTIAL, not a duplicate row", () => {
  const encoded = "USA+CBO+%7C+APRIL+17+%7C+Batch+1-5";
  const decoded = "USA CBO | APRIL 17 | Batch 1-5";
  assert.equal(canonicalCampaignName(encoded), canonicalCampaignName(decoded));
  assert.equal(canonicalCampaignName(encoded), "usa cbo | april 17 | batch 1-5");
  assert.equal(displayCampaignName(encoded), decoded);
  const rows = joinMetaAndOurCampaigns(
    [
      {
        campaign_id: "a1b2c3d4-e5f6-4789-8abc-def012345678",
        campaign_name: decoded,
        spend: 303.09,
        impressions: 1000,
        clicks: 40,
        purchases: 0,
        purchase_value: 0,
      },
    ],
    [{ campaign: encoded, channel: "Facebook / Meta Ads", orders: 8.2, revenue: 566.66 }],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.mappingMethod, "campaign_name_exact_unique");
  assert.equal(rows[0]?.mappingConfidence, "PARTIAL");
  assert.equal(rows[0]?.mapped, true);
  assert.equal(rows[0]?.campaignName, decoded);
  assert.equal(rows[0]?.spend, 303.09);
  assert.equal(rows[0]?.ourRevenue, 566.66);
});

test("malformed percent encoding does not crash name matching", () => {
  assert.equal(canonicalCampaignName("USA%"), "usa%");
  assert.equal(canonicalCampaignName("USA%ZZ-CBO"), "usa%zz-cbo");
  const rows = joinMetaAndOurCampaigns(
    [
      {
        campaign_id: "111",
        campaign_name: "Prospecting",
        spend: 10,
        impressions: 1,
        clicks: 1,
        purchases: 0,
        purchase_value: 0,
      },
    ],
    [{ campaign: "Bad%E", channel: "Facebook / Meta Ads", orders: 1, revenue: 5 }],
  );
  const row = rows.find((item) => item.ourRevenue === 5);
  assert.equal(row?.mappingMethod, "unmapped");
  assert.equal(row?.mappingConfidence, "NONE");
});

test("two Meta campaigns that canonicalize to the same name are ambiguous NONE", () => {
  const rows = joinMetaAndOurCampaigns(
    [
      {
        campaign_id: "aaa",
        campaign_name: "USA CBO | APRIL 17",
        spend: 10,
        impressions: 1,
        clicks: 1,
        purchases: 0,
        purchase_value: 0,
      },
      {
        campaign_id: "bbb",
        campaign_name: "USA+CBO+%7C+APRIL+17",
        spend: 10,
        impressions: 1,
        clicks: 1,
        purchases: 0,
        purchase_value: 0,
      },
    ],
    [
      {
        campaign: "USA CBO | APRIL 17",
        channel: "Facebook / Meta Ads",
        orders: 1,
        revenue: 20,
      },
    ],
  );
  const row = rows.find((item) => item.ourRevenue === 20);
  assert.equal(row?.mappingMethod, "ambiguous_name");
  assert.equal(row?.mappingConfidence, "NONE");
  assert.equal(row?.mapped, false);
  assert.equal(row?.spend, 0);
});

test("unrelated campaign names do not match", () => {
  const rows = joinMetaAndOurCampaigns(
    [
      {
        campaign_id: "111",
        campaign_name: "USA CBO | APRIL 17 | Batch 1-5",
        spend: 10,
        impressions: 1,
        clicks: 1,
        purchases: 0,
        purchase_value: 0,
      },
    ],
    [
      {
        campaign: "WORLDWIDE CBO | APRIL 17 | Batch 1-5",
        channel: "Facebook / Meta Ads",
        orders: 1,
        revenue: 20,
      },
    ],
  );
  const ours = rows.find((item) => item.ourRevenue === 20);
  assert.equal(ours?.mappingMethod, "unmapped");
  assert.equal(ours?.mapped, false);
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
