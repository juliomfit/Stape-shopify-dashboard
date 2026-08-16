import assert from "node:assert/strict";
import test from "node:test";
import { gnCampaignExactMatch } from "../src/lib/shopify/gn-campaign.ts";

test("gn_* campaign match is exact name only", () => {
  const orders = [
    { firstTouch: { utmCampaign: "USA CBO | APRIL 17 | Batch 1-5" }, amount: 40 },
    { firstTouch: { utmCampaign: "other" }, amount: 10 },
  ];
  const hit = gnCampaignExactMatch("USA CBO | APRIL 17 | Batch 1-5", orders);
  assert.equal(hit.matched, true);
  assert.equal(hit.orders, 1);
  assert.equal(hit.revenue, 40);
  const miss = gnCampaignExactMatch("USA CBO", orders);
  assert.equal(miss.matched, false);
  assert.equal(miss.orders, 0);
});
