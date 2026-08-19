import assert from "node:assert/strict";
import test from "node:test";
import {
  attribute,
  creditByChannel,
  eligibleTouches,
  firstNonDirectTouch,
  lastNonDirectTouch,
  ATTRIBUTION_MODELS,
  type AttributionModel,
  type Touchpoint,
} from "../src/lib/attribution/engine.ts";
import { applyRevenue, orderCreditIntegrity } from "../src/lib/attribution/engine.ts";
import { shopifyMoneyForOrder, newCustomerCredit } from "../src/lib/attribution/shopify-money.ts";
import { blendedNcac, attributedNcac, merRatio, paidRoasCovered, ratio } from "../src/lib/metrics/formulas.ts";

const PAID = new Set(["Google Ads", "Facebook / Meta Ads", "TikTok", "Microsoft Ads"]);

const PURCHASE = Date.UTC(2026, 7, 18, 12, 0, 0);
const HOUR = 60 * 60 * 1000;

function tp(
  id: string,
  channel: string,
  hoursBefore: number,
  opts: { isPaid?: boolean; isDirect?: boolean } = {},
): Touchpoint {
  return {
    id,
    timestamp: PURCHASE - hoursBefore * HOUR,
    channel,
    isPaid: opts.isPaid ?? PAID.has(channel),
    isDirect: opts.isDirect ?? channel === "Direct",
  };
}

const META = (id: string, h: number) =>
  tp(id, "Facebook / Meta Ads", h, { isPaid: true });
const GOOGLE_ORG = (id: string, h: number) => tp(id, "Google Organic", h);
const EMAIL = (id: string, h: number) => tp(id, "Email", h);
const DIRECT = (id: string, h: number) => tp(id, "Direct", h, { isDirect: true });

function weights(touches: Touchpoint[], model: AttributionModel, windowDays = 60) {
  return creditByChannel(attribute(touches, { model, purchaseTs: PURCHASE, windowDays }));
}

function near(a: number, b: number, eps = 1e-9) {
  assert.ok(Math.abs(a - b) < eps, `expected ${b} got ${a}`);
}

const A = [META("s-meta", 240), GOOGLE_ORG("s-org", 120), DIRECT("s-dir", 24)];
const B = [META("s-meta", 48)];
const C = [DIRECT("s-dir", 12)];
const D: Touchpoint[] = [];
const E = [META("s-meta-1", 120), META("s-meta-2", 24)];
const F = [
  META("s-meta", 240),
  GOOGLE_ORG("s-org", 120),
  EMAIL("s-email", 48),
  DIRECT("s-dir", 24),
];
const G = [GOOGLE_ORG("s-org", 72), EMAIL("s-email", 24), DIRECT("s-dir", 2)];
const I = [META("s-one", 10)];
const J = [META("s-a", 48), GOOGLE_ORG("s-b", 2)];

test("golden A Meta → Google Organic → Real Direct", () => {
  assert.deepEqual(weights(A, "first_touch"), { "Facebook / Meta Ads": 1 });
  assert.deepEqual(weights(A, "last_touch"), { Direct: 1 });
  assert.deepEqual(weights(A, "last_non_direct"), { "Google Organic": 1 });
  const linear = weights(A, "linear");
  near(linear["Facebook / Meta Ads"], 1 / 3);
  near(linear["Google Organic"], 1 / 3);
  near(linear.Direct, 1 / 3);
  const pos = weights(A, "position_based");
  near(pos["Facebook / Meta Ads"], 0.4);
  near(pos["Google Organic"], 0.2);
  near(pos.Direct, 0.4);
  assert.deepEqual(weights(A, "paid_only"), { "Facebook / Meta Ads": 1 });
  const decay = weights(A, "time_decay");
  near(decay["Facebook / Meta Ads"], 0.1969008584441233, 1e-9);
  near(decay["Google Organic"], 0.32304947161993885, 1e-9);
  near(decay.Direct, 0.48004966993593784, 1e-9);
});

test("golden B Meta → internal checkout noise excluded → purchase is one Meta touch", () => {
  for (const model of ATTRIBUTION_MODELS) {
    assert.deepEqual(weights(B, model), { "Facebook / Meta Ads": 1 }, model);
  }
});

test("golden C Direct only", () => {
  for (const model of ATTRIBUTION_MODELS) {
    if (model === "paid_only") {
      assert.deepEqual(weights(C, model), {});
    } else {
      assert.deepEqual(weights(C, model), { Direct: 1 }, model);
    }
  }
});

test("golden D unknown / no touch stays unattributed, never Direct", () => {
  for (const model of ATTRIBUTION_MODELS) {
    assert.deepEqual(weights(D, model), {});
  }
});

test("golden E Meta → Meta retargeting", () => {
  assert.deepEqual(weights(E, "first_touch"), { "Facebook / Meta Ads": 1 });
  assert.deepEqual(weights(E, "last_touch"), { "Facebook / Meta Ads": 1 });
  near(weights(E, "linear")["Facebook / Meta Ads"], 1);
  near(weights(E, "position_based")["Facebook / Meta Ads"], 1);
});

test("golden F Meta → Organic → Email → Direct", () => {
  const eligible = eligibleTouches(F, PURCHASE, 60);
  assert.equal(firstNonDirectTouch(eligible)?.channel, "Facebook / Meta Ads");
  assert.equal(lastNonDirectTouch(eligible)?.channel, "Email");
  assert.deepEqual(weights(F, "first_touch"), { "Facebook / Meta Ads": 1 });
  assert.deepEqual(weights(F, "last_touch"), { Direct: 1 });
  assert.deepEqual(weights(F, "last_non_direct"), { Email: 1 });
  const linear = weights(F, "linear");
  near(linear["Facebook / Meta Ads"], 0.25);
  near(linear["Google Organic"], 0.25);
  near(linear.Email, 0.25);
  near(linear.Direct, 0.25);
  const pos = weights(F, "position_based");
  near(pos["Facebook / Meta Ads"], 0.4);
  near(pos["Google Organic"], 0.1);
  near(pos.Email, 0.1);
  near(pos.Direct, 0.4);
  assert.deepEqual(weights(F, "paid_only"), { "Facebook / Meta Ads": 1 });
});

test("golden K same-timestamp Meta + Email: first=Meta, last=Email, one 100% winner", () => {
  const ts = PURCHASE - 24 * HOUR;
  const K: Touchpoint[] = [
    {
      id: "s-a-meta",
      timestamp: ts,
      channel: "Facebook / Meta Ads",
      isPaid: true,
      isDirect: false,
    },
    {
      id: "s-b-email",
      timestamp: ts,
      channel: "Email",
      isPaid: false,
      isDirect: false,
    },
  ];
  assert.deepEqual(weights(K, "first_touch"), { "Facebook / Meta Ads": 1 });
  assert.deepEqual(weights(K, "last_touch"), { Email: 1 });
  assert.deepEqual(weights(K, "last_non_direct"), { Email: 1 });
  near(weights(K, "linear")["Facebook / Meta Ads"], 0.5);
  near(weights(K, "linear").Email, 0.5);
  assert.equal(attribute(K, { model: "first_touch", purchaseTs: PURCHASE, windowDays: 60 }).length, 1);
  assert.equal(attribute(K, { model: "last_touch", purchaseTs: PURCHASE, windowDays: 60 }).length, 1);
});

test("golden G paid-only with no paid touches is empty, not Direct", () => {
  assert.deepEqual(weights(G, "paid_only"), {});
  assert.deepEqual(weights(G, "last_touch"), { Direct: 1 });
  assert.deepEqual(weights(G, "last_non_direct"), { Email: 1 });
});

test("7-day window excludes 240h Meta; remaining Organic + Direct stay", () => {
  assert.deepEqual(weights(A, "first_touch", 7), { "Google Organic": 1 });
  assert.deepEqual(weights(A, "last_touch", 7), { Direct: 1 });
  assert.deepEqual(weights(A, "last_non_direct", 7), { "Google Organic": 1 });
});

test("golden I one touch and J two touches", () => {
  for (const model of ATTRIBUTION_MODELS) {
    assert.deepEqual(weights(I, model), { "Facebook / Meta Ads": 1 }, model);
  }
  assert.deepEqual(weights(J, "first_touch"), { "Facebook / Meta Ads": 1 });
  assert.deepEqual(weights(J, "last_touch"), { "Google Organic": 1 });
  near(weights(J, "linear")["Facebook / Meta Ads"], 0.5);
  near(weights(J, "linear")["Google Organic"], 0.5);
  near(weights(J, "position_based")["Facebook / Meta Ads"], 0.5);
  near(weights(J, "position_based")["Google Organic"], 0.5);
});

test("Shopify money replaces event value; full and partial refunds keep the journey", () => {
  const eventValue = 100;
  const credits = attribute(A, {
    model: "linear",
    purchaseTs: PURCHASE,
    windowDays: 60,
  });
  const unmatched = shopifyMoneyForOrder({
    transactionId: "1001",
    eventPurchaseValue: eventValue,
  });
  assert.equal(unmatched.moneySource, "unmatched");
  assert.equal(unmatched.shopifyNetRevenue, null);

  const fullRefund = shopifyMoneyForOrder({
    transactionId: "1001",
    eventPurchaseValue: eventValue,
    shopifyOrder: { amount: 0, isNew: true, refunded: 100, legacyId: "1001" },
  });
  assert.equal(fullRefund.moneySource, "shopify");
  assert.equal(fullRefund.shopifyNetRevenue, 0);
  const fullMoney = applyRevenue(credits, fullRefund.shopifyNetRevenue ?? 0);
  assert.equal(fullMoney.reduce((sum, row) => sum + row.attributedRevenue, 0), 0);
  assert.equal(credits.length, 3);

  const partial = shopifyMoneyForOrder({
    transactionId: "1001",
    eventPurchaseValue: eventValue,
    shopifyOrder: { amount: 40, isNew: true, refunded: 60, legacyId: "1001" },
  });
  assert.equal(partial.shopifyNetRevenue, 40);
  const integrity = orderCreditIntegrity(credits, 40);
  assert.equal(integrity.ok, true);
  near(integrity.attributedRevenue, 40);
});

test("fractional new-customer credit is unrounded weight", () => {
  assert.equal(newCustomerCredit(true, 1 / 3), 1 / 3);
  assert.equal(newCustomerCredit(false, 1), 0);
  assert.equal(newCustomerCredit(null, 1), 0);
});

test("Our Paid ROAS uses only paid attributed revenue covered by spend; blended nCAC stays store-wide", () => {
  const shopifyRevenue = 1000;
  const spend = 100;
  const covered = paidRoasCovered({
    attributedByChannel: [
      { channel: "Facebook / Meta Ads", revenue: 250 },
      { channel: "Google Ads", revenue: 80 },
      { channel: "TikTok", revenue: 40 },
      { channel: "Microsoft Ads", revenue: 15 },
    ],
    spendByChannel: {
      "Facebook / Meta Ads": spend,
      "Google Ads": null,
      TikTok: null,
      "Microsoft Ads": null,
    },
  });
  assert.equal(covered.revenue, 250);
  assert.equal(covered.spend, 100);
  assert.equal(merRatio(spend, shopifyRevenue), 10);
  assert.equal(ratio(covered.revenue, covered.spend), 2.5);
  assert.equal(blendedNcac(400, 10), 40);
  assert.equal(attributedNcac(200, 2.5), 80);
});
