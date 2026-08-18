import assert from "node:assert/strict";
import test from "node:test";
import {
  attribute,
  attributeAllModels,
  creditByChannel,
  eligibleTouches,
  ATTRIBUTION_MODELS,
  type Touchpoint,
} from "../src/lib/attribution/engine.ts";

const PURCHASE = Date.UTC(2026, 7, 18, 12, 0, 0); // fixed order time
const HOUR = 60 * 60 * 1000;

let counter = 0;
function tp(
  channel: string,
  hoursBefore: number,
  opts: { isPaid?: boolean; isDirect?: boolean; id?: string } = {},
): Touchpoint {
  counter += 1;
  return {
    id: opts.id ?? `t${counter}`,
    timestamp: PURCHASE - hoursBefore * HOUR,
    channel,
    isPaid: opts.isPaid ?? false,
    isDirect: opts.isDirect ?? channel === "Direct",
  };
}

const META = (h: number, id?: string) => tp("Meta Paid", h, { isPaid: true, id });
const GOOGLE_ORG = (h: number, id?: string) => tp("Organic Search", h, { id });
const EMAIL = (h: number, id?: string) => tp("Email", h, { id });
const DIRECT = (h: number, id?: string) => tp("Direct", h, { isDirect: true, id });

function channelWeights(touchpoints: Touchpoint[], model: (typeof ATTRIBUTION_MODELS)[number]) {
  return creditByChannel(attribute(touchpoints, { model, purchaseTs: PURCHASE }));
}

function near(a: number, b: number, eps = 1e-9) {
  return Math.abs(a - b) < eps;
}

test("first touch credits the earliest eligible touch (Direct eligible)", () => {
  const journey = [META(240), GOOGLE_ORG(120), DIRECT(24)];
  assert.deepEqual(channelWeights(journey, "first_touch"), { "Meta Paid": 1 });
});

test("last touch credits the latest touch even if Direct", () => {
  const journey = [META(240), GOOGLE_ORG(120), DIRECT(24)];
  assert.deepEqual(channelWeights(journey, "last_touch"), { Direct: 1 });
});

test("last non-direct skips Direct when a non-direct touch exists", () => {
  const journey = [META(240), GOOGLE_ORG(120), DIRECT(24)];
  assert.deepEqual(channelWeights(journey, "last_non_direct"), { "Organic Search": 1 });
});

test("last non-direct falls back to Direct when every touch is Direct", () => {
  const journey = [DIRECT(48), DIRECT(2)];
  assert.deepEqual(channelWeights(journey, "last_non_direct"), { Direct: 1 });
});

test("linear splits equally across non-direct touches; Direct excluded", () => {
  const journey = [META(240), GOOGLE_ORG(120), DIRECT(24)];
  const weights = channelWeights(journey, "linear");
  assert.ok(near(weights["Meta Paid"], 0.5));
  assert.ok(near(weights["Organic Search"], 0.5));
  assert.equal(weights["Direct"], undefined);
});

test("linear falls back to Direct-only when all touches are Direct", () => {
  const weights = channelWeights([DIRECT(48), DIRECT(2)], "linear");
  assert.ok(near(weights["Direct"], 1));
});

test("linear rolls repeated channel touches up correctly", () => {
  const journey = [META(240), META(120), GOOGLE_ORG(24)];
  const weights = channelWeights(journey, "linear");
  assert.ok(near(weights["Meta Paid"], 2 / 3));
  assert.ok(near(weights["Organic Search"], 1 / 3));
});

test("position based: 40/20/40 across three marketing touches (Direct excluded from middle)", () => {
  const journey = [META(240), DIRECT(150), GOOGLE_ORG(120), EMAIL(24)];
  const credits = attribute(journey, { model: "position_based", purchaseTs: PURCHASE });
  const byChannel = creditByChannel(credits);
  assert.ok(near(byChannel["Meta Paid"], 0.4));
  assert.ok(near(byChannel["Organic Search"], 0.2));
  assert.ok(near(byChannel["Email"], 0.4));
  assert.equal(byChannel["Direct"], undefined);
});

test("position based: single touch is 100%", () => {
  assert.deepEqual(channelWeights([META(10)], "position_based"), { "Meta Paid": 1 });
});

test("position based: two touches split 50/50", () => {
  const weights = channelWeights([META(48), EMAIL(2)], "position_based");
  assert.ok(near(weights["Meta Paid"], 0.5));
  assert.ok(near(weights["Email"], 0.5));
});

test("paid only credits paid touches; empty when none are paid", () => {
  assert.deepEqual(
    channelWeights([META(48), GOOGLE_ORG(24), EMAIL(2)], "paid_only"),
    { "Meta Paid": 1 },
  );
  assert.deepEqual(channelWeights([GOOGLE_ORG(24), EMAIL(2)], "paid_only"), {});
});

test("time decay gives more credit to touches closer to purchase and sums to 1", () => {
  const credits = attribute([META(100), EMAIL(1)], {
    model: "time_decay",
    purchaseTs: PURCHASE,
  });
  const byChannel = creditByChannel(credits);
  assert.ok(byChannel["Email"] > byChannel["Meta Paid"]);
  assert.ok(near(byChannel["Email"] + byChannel["Meta Paid"], 1));
});

test("one-touch journey gives 100% to that touch across every model", () => {
  const journey = [META(12)];
  for (const model of ATTRIBUTION_MODELS) {
    assert.deepEqual(channelWeights(journey, model), { "Meta Paid": 1 }, model);
  }
});

test("two-touch journey behaves per model", () => {
  const journey = [META(48), EMAIL(2)];
  assert.deepEqual(channelWeights(journey, "first_touch"), { "Meta Paid": 1 });
  assert.deepEqual(channelWeights(journey, "last_touch"), { Email: 1 });
  assert.deepEqual(channelWeights(journey, "last_non_direct"), { Email: 1 });
});

test("duplicate touchpoint ids are de-duplicated (earliest wins)", () => {
  const journey = [META(240, "A"), META(120, "A"), GOOGLE_ORG(24, "B")];
  assert.equal(eligibleTouches(journey, PURCHASE).length, 2);
  const weights = channelWeights(journey, "linear");
  assert.ok(near(weights["Meta Paid"], 0.5));
  assert.ok(near(weights["Organic Search"], 0.5));
});

test("empty journey returns no credit (order without a known session)", () => {
  assert.deepEqual(attribute([], { model: "linear", purchaseTs: PURCHASE }), []);
  assert.deepEqual(creditByChannel([]), {});
});

test("attribution window excludes touches older than the window", () => {
  const journey = [META(40 * 24), GOOGLE_ORG(5 * 24)]; // 40d and 5d before
  assert.deepEqual(
    creditByChannel(
      attribute(journey, { model: "first_touch", purchaseTs: PURCHASE, windowDays: 30 }),
    ),
    { "Organic Search": 1 },
  );
  assert.deepEqual(
    creditByChannel(
      attribute(journey, { model: "first_touch", purchaseTs: PURCHASE, windowDays: 60 }),
    ),
    { "Meta Paid": 1 },
  );
});

test("touch exactly at purchase is included; a touch after purchase is excluded", () => {
  const atPurchase: Touchpoint = {
    id: "x",
    timestamp: PURCHASE,
    channel: "Email",
    isPaid: false,
    isDirect: false,
  };
  const afterPurchase: Touchpoint = {
    id: "y",
    timestamp: PURCHASE + HOUR,
    channel: "Meta Paid",
    isPaid: true,
    isDirect: false,
  };
  const eligible = eligibleTouches([atPurchase, afterPurchase], PURCHASE);
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].id, "x");
});

test("no model ever returns NaN/Infinity and weights sum to 1 when touches exist", () => {
  const journey = [META(240), GOOGLE_ORG(120), DIRECT(24), EMAIL(2)];
  const all = attributeAllModels(journey, { purchaseTs: PURCHASE });
  for (const model of ATTRIBUTION_MODELS) {
    const credits = all[model];
    const total = credits.reduce((sum, c) => sum + c.weight, 0);
    for (const c of credits) {
      assert.ok(Number.isFinite(c.weight), `${model} weight finite`);
    }
    // paid_only can be empty (no paid touch); every other model has ≥1 touch here.
    if (credits.length > 0) {
      assert.ok(near(total, 1, 1e-9), `${model} sums to 1 (got ${total})`);
    }
  }
});
