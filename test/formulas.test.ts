import assert from "node:assert/strict";
import test from "node:test";
import {
  blendedCpa,
  contributionProfit,
  coverageRatio,
  marketingCostRatio,
  merRatio,
  platformRoas,
  paidRoas,
  paidRoasCovered,
  ratio,
  blendedNcac,
  attributedNcac,
  metaFrequency,
} from "../src/lib/metrics/formulas.ts";

test("missing spend is null not zero", () => {
  assert.equal(ratio(100, null), null);
  assert.equal(merRatio(null, 500), null);
  assert.equal(blendedCpa(null, 10), null);
  assert.equal(platformRoas(50, 0), null);
});

test("blended ROAS and MER are the same ratio; marketing cost ratio is the inverse", () => {
  assert.equal(ratio(200, 50), 4);
  assert.equal(merRatio(50, 200), 4);
  assert.equal(marketingCostRatio(50, 200), 0.25);
});

test("nCAC definitions stay separate", () => {
  assert.equal(blendedNcac(400, 10), 40);
  assert.equal(attributedNcac(200, 2.5), 80);
  assert.equal(attributedNcac(200, 0), null);
  assert.equal(blendedNcac(null, 10), null);
});

test("contribution profit is not net profit with invented COGS", () => {
  assert.equal(
    contributionProfit({
      totalRevenue: 100,
      processingFees: 3,
      refundFees: 0,
      adSpend: 20,
    }),
    77,
  );
  assert.equal(
    contributionProfit({
      totalRevenue: 100,
      processingFees: 0,
      refundFees: 0,
      adSpend: null,
    }),
    null,
  );
});

test("contribution profit subtracts supplied COGS only", () => {
  assert.equal(
    contributionProfit({
      totalRevenue: 100,
      processingFees: 3,
      refundFees: 0,
      adSpend: 20,
      cogs: 10,
    }),
    67,
  );
});

test("coverage does not divide by zero", () => {
  assert.equal(coverageRatio(10, 0), null);
  assert.equal(coverageRatio(9, 10), 0.9);
});

test("Meta frequency is impressions divided by reach", () => {
  assert.equal(metaFrequency(1000, 250), 4);
  assert.equal(metaFrequency(0, 250), 0);
  assert.equal(metaFrequency(1000, 0), 0);
  assert.equal(metaFrequency(1000, Number.NaN), 0);
  assert.equal(metaFrequency(Number.POSITIVE_INFINITY, 10), 0);
});

test("Our Paid ROAS only includes paid channels that have a spend source", () => {
  const attributedByChannel = [
    { channel: "Facebook / Meta Ads", revenue: 100 },
    { channel: "Google Ads", revenue: 50 },
    { channel: "TikTok", revenue: 20 },
    { channel: "Microsoft Ads", revenue: 10 },
    { channel: "Email", revenue: 40 },
  ];
  const metaOnly = paidRoasCovered({
    attributedByChannel,
    spendByChannel: {
      "Facebook / Meta Ads": 25,
      "Google Ads": null,
      TikTok: null,
      "Microsoft Ads": undefined,
    },
  });
  assert.equal(metaOnly.revenue, 100);
  assert.equal(metaOnly.spend, 25);
  assert.equal(paidRoas(attributedByChannel, {
    "Facebook / Meta Ads": 25,
    "Google Ads": null,
    TikTok: null,
    "Microsoft Ads": null,
  }), 4);

  const inflatedIfUnfiltered = 100 + 50 + 20 + 10;
  assert.notEqual(metaOnly.revenue, inflatedIfUnfiltered);

  const metaAndGoogle = paidRoasCovered({
    attributedByChannel,
    spendByChannel: {
      "Facebook / Meta Ads": 25,
      "Google Ads": 10,
      TikTok: null,
      "Microsoft Ads": null,
    },
  });
  assert.equal(metaAndGoogle.revenue, 150);
  assert.equal(metaAndGoogle.spend, 35);

  assert.equal(
    paidRoas(attributedByChannel, {
      "Facebook / Meta Ads": null,
      "Google Ads": null,
      TikTok: null,
      "Microsoft Ads": null,
    }),
    null,
  );
});
