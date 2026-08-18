import assert from "node:assert/strict";
import test from "node:test";
import {
  breakEvenCpa,
  breakEvenRoas,
  contributionMargin,
  ltvToCac,
  newCustomerCac,
  newCustomerRoas,
  profitRoas,
} from "../src/lib/metrics/formulas.ts";

test("new-customer CAC divides spend by new customers, guarded", () => {
  assert.equal(newCustomerCac(800, 32), 25);
  assert.equal(newCustomerCac(800, 0), null);
  assert.equal(newCustomerCac(null, 32), null);
});

test("new-customer ROAS uses spend guard", () => {
  assert.equal(newCustomerRoas(2000, 500), 4);
  assert.equal(newCustomerRoas(2000, 0), null);
  assert.equal(newCustomerRoas(2000, null), null);
});

test("profit ROAS can be negative but never divides by zero", () => {
  assert.equal(profitRoas(300, 100), 3);
  assert.equal(profitRoas(-50, 100), -0.5);
  assert.equal(profitRoas(300, 0), null);
  assert.equal(profitRoas(null, 100), null);
});

test("LTV:CAC guarded against zero/negative CAC", () => {
  assert.equal(ltvToCac(150, 50), 3);
  assert.equal(ltvToCac(150, 0), null);
  assert.equal(ltvToCac(null, 50), null);
});

test("break-even ROAS is the inverse of contribution margin", () => {
  const margin = contributionMargin(40, 100); // 0.4
  assert.equal(margin, 0.4);
  assert.equal(breakEvenRoas(margin), 2.5);
  assert.equal(breakEvenRoas(0), null);
  assert.equal(breakEvenRoas(null), null);
});

test("break-even CPA is contribution dollars per order", () => {
  assert.equal(breakEvenCpa(100, 0.4), 40);
  assert.equal(breakEvenCpa(null, 0.4), null);
  assert.equal(breakEvenCpa(100, 0), null);
});
