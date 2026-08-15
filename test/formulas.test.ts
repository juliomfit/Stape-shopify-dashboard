import assert from "node:assert/strict";
import test from "node:test";
import {
  blendedCpa,
  contributionProfit,
  coverageRatio,
  merRatio,
  platformRoas,
  ratio,
} from "../src/lib/metrics/formulas.ts";

test("missing spend is null not zero", () => {
  assert.equal(ratio(100, null), null);
  assert.equal(merRatio(null, 500), null);
  assert.equal(blendedCpa(null, 10), null);
  assert.equal(platformRoas(50, 0), null);
});

test("blended ROAS and MER inverses", () => {
  assert.equal(ratio(200, 50), 4);
  assert.equal(merRatio(50, 200), 0.25);
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

test("coverage does not divide by zero", () => {
  assert.equal(coverageRatio(10, 0), null);
  assert.equal(coverageRatio(9, 10), 0.9);
});
