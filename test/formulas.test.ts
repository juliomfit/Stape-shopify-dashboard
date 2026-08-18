import assert from "node:assert/strict";
import test from "node:test";
import {
  blendedCpa,
  contributionProfit,
  coverageRatio,
  marketingCostRatio,
  merRatio,
  platformRoas,
  ratio,
  blendedNcac,
  attributedNcac,
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
