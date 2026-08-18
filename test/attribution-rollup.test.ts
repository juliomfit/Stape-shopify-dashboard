import assert from "node:assert/strict";
import test from "node:test";
import {
  attributeOrdersByChannel,
  compareModels,
  type OrderInput,
  type Touchpoint,
} from "../src/lib/attribution/engine.ts";

const PURCHASE = Date.UTC(2026, 7, 18, 12);
const DAY = 24 * 60 * 60 * 1000;

function touch(id: string, daysBefore: number, channel: string, paid = false, direct = false): Touchpoint {
  return {
    id,
    timestamp: PURCHASE - daysBefore * DAY,
    channel,
    isPaid: paid,
    isDirect: direct,
  };
}

// Order A: Meta -> Google Organic -> purchase ($100)
// Order B: Meta -> purchase ($50)
const orders: OrderInput[] = [
  {
    id: "A",
    revenue: 100,
    purchaseTs: PURCHASE,
    touchpoints: [
      touch("a1", 5, "Meta Paid", true),
      touch("a2", 2, "Organic Search"),
    ],
  },
  {
    id: "B",
    revenue: 50,
    purchaseTs: PURCHASE,
    touchpoints: [touch("b1", 3, "Meta Paid", true)],
  },
];

function near(a: number, b: number, eps = 1e-9) {
  return Math.abs(a - b) < eps;
}

test("first touch rollup credits earliest channel per order", () => {
  const byChannel = attributeOrdersByChannel(orders, { model: "first_touch" });
  // A first touch = Meta ($100), B first touch = Meta ($50) => Meta $150 / 2 orders
  assert.ok(near(byChannel["Meta Paid"].revenue, 150));
  assert.ok(near(byChannel["Meta Paid"].orders, 2));
  assert.equal(byChannel["Organic Search"], undefined);
});

test("last non-direct rollup credits last marketing channel per order", () => {
  const byChannel = attributeOrdersByChannel(orders, { model: "last_non_direct" });
  // A last non-direct = Organic ($100), B = Meta ($50)
  assert.ok(near(byChannel["Organic Search"].revenue, 100));
  assert.ok(near(byChannel["Meta Paid"].revenue, 50));
});

test("linear rollup splits fractional revenue and orders", () => {
  const byChannel = attributeOrdersByChannel(orders, { model: "linear" });
  // A linear: Meta 50 + Google 50; B linear: Meta 50
  assert.ok(near(byChannel["Meta Paid"].revenue, 100)); // 50 (A) + 50 (B)
  assert.ok(near(byChannel["Organic Search"].revenue, 50));
  assert.ok(near(byChannel["Meta Paid"].orders, 1.5)); // 0.5 + 1
  assert.ok(near(byChannel["Organic Search"].orders, 0.5));
});

test("compareModels builds a channel x model matrix with totals", () => {
  const comparison = compareModels(orders, ["first_touch", "last_non_direct", "linear"]);
  assert.deepEqual(comparison.models, ["first_touch", "last_non_direct", "linear"]);
  assert.ok(comparison.channels.includes("Meta Paid"));
  assert.ok(comparison.channels.includes("Organic Search"));
  // Total attributed revenue per model equals the total order revenue ($150).
  for (const model of comparison.models) {
    assert.ok(
      near(comparison.totalsByModel[model].revenue, 150),
      `${model} total revenue`,
    );
    assert.ok(near(comparison.totalsByModel[model].orders, 2), `${model} total orders`);
  }
  // Channels ordered by descending revenue under the first model (first_touch => Meta first).
  assert.equal(comparison.channels[0], "Meta Paid");
});

test("compareModels tolerates orders with no eligible touches", () => {
  const empty: OrderInput[] = [{ id: "z", revenue: 40, purchaseTs: PURCHASE, touchpoints: [] }];
  const comparison = compareModels(empty, ["linear"]);
  assert.deepEqual(comparison.channels, []);
  assert.ok(near(comparison.totalsByModel.linear.revenue, 0));
});
