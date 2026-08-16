import assert from "node:assert/strict";
import test from "node:test";
import {
  formatGa4Date,
  friendlyGa4Error,
  streamDimensionFilter,
} from "../src/lib/ads/ga4-config.ts";

test("GA4 dates from the Data API become YYYY-MM-DD", () => {
  assert.equal(formatGa4Date("20260815"), "2026-08-15");
  assert.equal(formatGa4Date("2026-08-15"), "2026-08-15");
});

test("stream filter is omitted when stream id is empty", () => {
  assert.equal(streamDimensionFilter(""), undefined);
  assert.deepEqual(streamDimensionFilter("123"), {
    filter: {
      fieldName: "streamId",
      stringFilter: { matchType: "EXACT", value: "123" },
    },
  });
});

test("disabled Data API error tells you to enable it", () => {
  const message = friendlyGa4Error(
    "Google Analytics Data API has not been used in project 431238472079 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/analyticsdata.googleapis.com/overview?project=431238472079",
  );
  assert.match(message, /Enable Google Analytics Data API/);
  assert.match(message, /431238472079/);
});
