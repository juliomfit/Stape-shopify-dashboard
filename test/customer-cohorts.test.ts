import assert from "node:assert/strict";
import test from "node:test";
import {
  pacificYearMonth,
  rollupCustomerCohorts,
} from "../src/lib/shopify/cohorts.ts";

test("pacificYearMonth buckets ISO timestamps by Pacific month", () => {
  assert.equal(pacificYearMonth("2026-08-13T18:00:00Z"), "2026-08");
  // 2026-01-01 07:00 UTC is still 2025-12-31 in Pacific.
  assert.equal(pacificYearMonth("2026-01-01T07:00:00Z"), "2025-12");
  assert.equal(pacificYearMonth(null), "Unknown");
});

test("cohort rollup uses range spend, not invented LTV", () => {
  const rows = rollupCustomerCohorts([
    {
      createdAt: "2026-03-15T12:00:00Z",
      orderCount: 2,
      spend: 80,
      isNew: false,
    },
    {
      createdAt: "2026-03-20T12:00:00Z",
      orderCount: 1,
      spend: 40,
      isNew: true,
    },
    {
      createdAt: "2026-04-02T12:00:00Z",
      orderCount: 1,
      spend: 25,
      isNew: true,
    },
  ]);

  assert.equal(rows[0].cohort, "2026-04");
  assert.equal(rows[0].customers, 1);
  assert.equal(rows[1].cohort, "2026-03");
  assert.equal(rows[1].customers, 2);
  assert.equal(rows[1].revenue, 120);
  assert.equal(rows[1].newCustomers, 1);
  assert.equal(rows[1].avgRevenuePerCustomer, 60);
});
