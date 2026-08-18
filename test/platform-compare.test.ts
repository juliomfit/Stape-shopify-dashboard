import assert from "node:assert/strict";
import test from "node:test";
import { percentChange } from "../src/lib/metrics/formulas.ts";
import {
  PLATFORM_ENGINE_CHANNELS,
  buildPlatformVsOurRows,
} from "../src/lib/attribution/platform-compare.ts";
import { parseAttributionLookback } from "../src/lib/attribution/windows.ts";

test("maps Meta/Google claims onto engine channel names", () => {
  const rows = buildPlatformVsOurRows(
    [
      {
        channel: PLATFORM_ENGINE_CHANNELS.facebook,
        spend: 400,
        purchases: 12,
        revenue: 1200,
      },
      {
        channel: PLATFORM_ENGINE_CHANNELS.google,
        spend: 200,
        purchases: 5,
        revenue: 400,
      },
    ],
    {
      "Facebook / Meta Ads": { revenue: 800, orders: 8 },
      "Google Ads": { revenue: 400, orders: 4 },
      Email: { revenue: 150, orders: 2 },
    },
  );

  assert.equal(rows[0].channel, "Facebook / Meta Ads");
  assert.equal(rows[0].platformRevenue, 1200);
  assert.equal(rows[0].ourRevenue, 800);
  assert.equal(rows[1].channel, "Google Ads");
  assert.equal(rows[2].channel, "Email");
  assert.equal(rows[2].spend, null);
  assert.equal(rows[2].platformRevenue, null);
});

test("platform gap percent is (platform − our) / our", () => {
  // Platform claims 25% more than our engine.
  assert.equal(percentChange(125, 100), 0.25);
  assert.equal(percentChange(80, 100), -0.2);
  assert.equal(percentChange(100, 0), null);
});

test("lookback query param falls back to 7 days", () => {
  assert.equal(parseAttributionLookback("30"), 30);
  assert.equal(parseAttributionLookback("60"), 60);
  assert.equal(parseAttributionLookback("90"), 7);
  assert.equal(parseAttributionLookback("12"), 7);
  assert.equal(parseAttributionLookback(undefined), 7);
});
