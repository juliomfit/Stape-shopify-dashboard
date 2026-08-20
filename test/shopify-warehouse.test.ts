import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { overviewFromRecords, recordToOrderPoint } from "../src/lib/shopify/order-record.ts";
import { mergeCoverageRange, warehouseCoversPeriod, warehouseReadDecision } from "../src/lib/shopify/coverage.ts";
import { shopifyHealthMessage, shopifyHealthStatus } from "../src/lib/platform/shopify-health.ts";
import { EMPTY_FIRST_TOUCH } from "../src/lib/shopify/first-touch.ts";
import type { ShopifyOrderRecord } from "../src/lib/shopify/order-record.ts";

function sample(overrides: Partial<ShopifyOrderRecord> = {}): ShopifyOrderRecord {
  return {
    orderGid: "gid://shopify/Order/1",
    orderId: "1",
    orderName: "#1001",
    createdAt: "2026-08-20T17:00:00.000Z",
    orderDate: "2026-08-20",
    financialStatus: "PAID",
    currency: "USD",
    netRevenue: 80,
    gross: 100,
    subtotal: 90,
    discounts: 10,
    shipping: 5,
    tax: 0,
    refunded: 20,
    processingFees: 2.4,
    refundFees: null,
    customerId: "c1",
    customerDisplayName: "Ada",
    customerCreatedAt: "2026-01-01T00:00:00.000Z",
    customerOrderNumber: 1,
    isNew: true,
    isGuest: false,
    firstTouch: { ...EMPTY_FIRST_TOUCH, uid: "gn" },
    firstTouchChannel: "Unknown",
    firstProductTitle: "InstaFrame",
    gnUid: "gn",
    customAttributes: [],
    lineItems: [
      {
        productId: "p1",
        title: "InstaFrame",
        quantity: 1,
        originalTotal: 100,
        discountedTotal: 90,
      },
    ],
    itemCount: 1,
    shopName: "GoodsNova",
    ...overrides,
  };
}

test("Shopify overview keeps currentTotalPriceSet as net revenue after refunds", () => {
  const overview = overviewFromRecords({
    records: [sample()],
    periodLabel: "Today",
    startMs: Date.parse("2026-08-20T07:00:00.000Z"),
    endMs: Date.parse("2026-08-21T07:00:00.000Z"),
    shopName: "GoodsNova",
    truncated: false,
    reportedOrderCount: 1,
  });
  assert.equal(overview.revenue?.amount, 80);
  assert.equal(overview.orders, 1);
  assert.equal(overview.newCustomerOrders, 1);
  assert.equal(overview.newCustomerRevenue, 80);
  assert.equal(overview.orderPoints[0].refunded, 20);
  assert.equal(overview.orderPoints[0].amount, 80);
  assert.equal(overview.readSource, "admin");
});

test("warehouse overview loader tags prepared reads as warehouse", () => {
  const warehouse = readFileSync("src/lib/shopify/warehouse.ts", "utf8");
  assert.match(warehouse, /readSource: "warehouse"/);
  assert.match(warehouse, /summarizeShopifyWarehouse/);
  const overview = readFileSync("src/lib/shopify/get-overview-metrics.ts", "utf8");
  assert.match(overview, /readSource: "admin"/);
  assert.match(overview, /readSource: "none"/);
});

test("refunded net revenue is never fabricated as $0 when the paid total remains", () => {
  const point = recordToOrderPoint(sample({ netRevenue: 12.34, refunded: 87.66 }));
  assert.equal(point.amount, 12.34);
  assert.equal(point.refunded, 87.66);
  assert.notEqual(point.amount, 0);
});

test("coverage range merge is inclusive and does not use cookies", () => {
  const merged = mergeCoverageRange(
    { minDate: "2026-08-10", maxDate: "2026-08-18", populatedAt: "old" },
    "2026-08-16",
    "2026-08-20",
    "2026-08-20T12:00:00.000Z",
  );
  assert.equal(merged.minDate, "2026-08-10");
  assert.equal(merged.maxDate, "2026-08-20");
  assert.equal(warehouseCoversPeriod(merged, "2026-08-10", "2026-08-20"), true);
  assert.equal(warehouseCoversPeriod(merged, "2026-08-01", "2026-08-20"), false);
});

test("warehouse rows for the period are served even without a coverage checkpoint", () => {
  const empty = { minDate: null, maxDate: null, populatedAt: null };
  assert.equal(
    warehouseReadDecision({
      coverage: empty,
      startDate: "2026-08-10",
      endDate: "2026-08-20",
      rowCount: 4,
    }),
    "use",
  );
  assert.equal(
    warehouseReadDecision({
      coverage: empty,
      startDate: "2026-08-10",
      endDate: "2026-08-20",
      rowCount: 0,
    }),
    "fallback",
  );
  assert.equal(
    warehouseReadDecision({
      coverage: { minDate: "2026-08-01", maxDate: "2026-08-20", populatedAt: "x" },
      startDate: "2026-08-10",
      endDate: "2026-08-20",
      rowCount: 0,
    }),
    "empty-covered",
  );
});

test("Health distinguishes warehouse serving from Admin fallback", () => {
  assert.equal(
    shopifyHealthStatus({ configured: true, syncing: false, readSource: "warehouse" }),
    "healthy",
  );
  assert.equal(
    shopifyHealthStatus({ configured: true, syncing: false, readSource: "admin" }),
    "partial",
  );
  assert.equal(
    shopifyHealthStatus({ configured: true, syncing: true, readSource: "admin" }),
    "syncing",
  );
  assert.match(shopifyHealthMessage({ configured: true, readSource: "warehouse" }), /fct_shopify_orders/);
  assert.match(shopifyHealthMessage({ configured: true, readSource: "admin" }), /Admin API/);
  assert.doesNotMatch(
    shopifyHealthMessage({ configured: true, readSource: "warehouse" }),
    /Live Admin API/,
  );
});

test("Shopify coverage checkpoint is BigQuery, not cookie durable-json", () => {
  const coverage = readFileSync("src/lib/shopify/coverage.ts", "utf8");
  assert.doesNotMatch(coverage, /cookies\(/);
  assert.doesNotMatch(coverage, /durable-json/);
  const warehouse = readFileSync("src/lib/shopify/warehouse.ts", "utf8");
  assert.match(warehouse, /shopify_ingest_coverage/);
  assert.match(warehouse, /readShopifyWarehouseCoverage/);
  assert.match(warehouse, /expandShopifyWarehouseCoverage/);
  assert.match(warehouse, /warehouseReadDecision/);
  assert.doesNotMatch(
    warehouse.slice(warehouse.indexOf("export async function loadShopifyRecordsFromWarehouse")),
    /if \(!warehouseCoversPeriod/,
  );
});
