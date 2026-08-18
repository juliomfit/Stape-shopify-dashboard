import assert from "node:assert/strict";
import test from "node:test";
import { identityEvidence } from "../src/lib/attribution/identity.ts";
import { joinMetaAndOurCampaigns } from "../src/lib/attribution/campaign-map.ts";
import { attributionCoverage } from "../src/lib/attribution/coverage.ts";
import { rollupLtvCohorts } from "../src/lib/shopify/ltv.ts";
import { merRatio, marketingCostRatio } from "../src/lib/metrics/formulas.ts";
import { POLICY_RULES } from "../src/lib/attribution/policy.ts";

test("identity confidence is deterministic", () => {
  const high = identityEvidence({
    gnUid: "gn_abc123456",
    transactionId: "1001",
    shopifyCustomerId: "gid",
  });
  assert.equal(high.confidence, "high");
  const low = identityEvidence({ personKey: "cid:anon", clientId: "cid:anon" });
  assert.equal(low.confidence, "low");
  assert.equal(high.fields.find((field) => field.key === "hashed_email")?.display, null);
});

test("campaign join never allocates unmapped OUR revenue onto Meta spend", () => {
  const rows = joinMetaAndOurCampaigns(
    [
      {
        campaign_id: "1",
        campaign_name: "Prospecting",
        spend: 100,
        impressions: 10,
        clicks: 2,
        purchases: 3,
        purchase_value: 150,
      },
    ],
    [{ campaign: "Other UTM", channel: "Facebook / Meta Ads", orders: 1, revenue: 40 }],
  );
  const unmapped = rows.find((row) => row.campaignName === "Other UTM");
  const meta = rows.find((row) => row.campaignName === "Prospecting");
  assert.equal(unmapped?.mapped, false);
  assert.equal(unmapped?.spend, 0);
  assert.equal(meta?.ourRevenue, 0);
});

test("coverage does not coerce unattributed into Direct", () => {
  const snap = attributionCoverage({
    shopifyOrders: 10,
    trackedPurchases: 8,
    identityMatched: 5,
    journeyMatched: 6,
    attributedOrders: 7,
  });
  assert.equal(snap.unattributedOrders, 3);
});

test("LTV marks immature windows and uses first purchase", () => {
  const now = Date.UTC(2026, 7, 18);
  const rows = rollupLtvCohorts(
    [
      {
        createdAt: "2026-08-01T12:00:00.000Z",
        amount: 50,
        customerId: "c1",
        firstTouchChannel: "Facebook / Meta Ads",
        firstProductTitle: "Serum",
      },
      {
        createdAt: "2026-08-10T12:00:00.000Z",
        amount: 30,
        customerId: "c1",
        firstTouchChannel: "Facebook / Meta Ads",
        firstProductTitle: "Serum",
      },
    ],
    now,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].customers, 1);
  assert.equal(rows[0].firstOrderRevenue, 50);
  assert.equal(rows[0].ltv[30], 80);
  assert.equal(rows[0].mature[365], false);
});

test("policy forbids calling spend/revenue MER", () => {
  assert.equal(merRatio(40_000, 100_000), 2.5);
  assert.equal(marketingCostRatio(40_000, 100_000), 0.4);
  assert.match(POLICY_RULES.unknownIsNotDirect, /Unknown/);
});
