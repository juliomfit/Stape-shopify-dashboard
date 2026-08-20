import assert from "node:assert/strict";
import test from "node:test";
import {
  googleAdsApiConfigured,
  googleAdsEnvTotalsConfigured,
  googleAdsHealthStatus,
  googleAdsIsConfigured,
} from "../src/lib/platform/google-health.ts";

test("unconfigured Google Ads is disconnected, never error", () => {
  const empty = {};
  assert.equal(googleAdsApiConfigured(empty), false);
  assert.equal(googleAdsEnvTotalsConfigured(empty), false);
  assert.equal(
    googleAdsHealthStatus({
      pasteConnected: false,
      apiConfigured: false,
      envTotalsConfigured: false,
      lastRunStatus: "error",
    }),
    "disconnected",
  );
  assert.equal(
    googleAdsIsConfigured({
      pasteConnected: false,
      apiConfigured: false,
      envTotalsConfigured: false,
    }),
    false,
  );
});

test("pasted or env Google Ads can be healthy", () => {
  assert.equal(
    googleAdsHealthStatus({
      pasteConnected: true,
      apiConfigured: false,
      envTotalsConfigured: false,
      lastRunStatus: "error",
    }),
    "healthy",
  );
  assert.equal(
    googleAdsEnvTotalsConfigured({ GOOGLE_ADS_SPEND: "12.5" }),
    true,
  );
  assert.equal(
    googleAdsHealthStatus({
      pasteConnected: false,
      apiConfigured: false,
      envTotalsConfigured: true,
      lastRunStatus: "error",
    }),
    "error",
  );
});
