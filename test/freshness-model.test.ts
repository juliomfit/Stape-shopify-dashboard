import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  buildFreshnessSnapshot,
  buildSourceFreshness,
  compactFreshnessLabel,
  formatFreshnessAge,
  freshnessStatus,
} from "../src/lib/freshness/model.ts";
import { firstFillSourcesFromSnapshot, shouldKickFirstFill } from "../src/lib/freshness/first-fill.ts";
import { SOURCE_SCHEDULES } from "../src/lib/freshness/schedules.ts";
import { META_SYNC_MAX_DURATION_MS } from "../src/lib/platform/sync-run-state.ts";
import { countableGrainRows, DEEP_GRAIN_MISSING_IDS } from "../src/lib/ads/insight-grain.ts";

test("freshness states distinguish syncing from last-known-good", () => {
  const now = Date.parse("2026-08-20T12:00:00.000Z");
  assert.equal(
    freshnessStatus({
      configured: true,
      lastSuccessIso: new Date(now - 60_000).toISOString(),
      lastAttemptIso: new Date(now - 60_000).toISOString(),
      latestError: null,
      activelyRunning: false,
      intervalMs: 5 * 60 * 1000,
      nowMs: now,
    }),
    "fresh",
  );
  assert.equal(
    freshnessStatus({
      configured: true,
      lastSuccessIso: new Date(now - 60_000).toISOString(),
      lastAttemptIso: new Date(now).toISOString(),
      latestError: null,
      activelyRunning: true,
      intervalMs: 5 * 60 * 1000,
      nowMs: now,
    }),
    "syncing",
  );
  assert.equal(
    freshnessStatus({
      configured: true,
      lastSuccessIso: new Date(now - 20 * 60 * 1000).toISOString(),
      lastAttemptIso: new Date(now - 20 * 60 * 1000).toISOString(),
      latestError: null,
      activelyRunning: false,
      intervalMs: 5 * 60 * 1000,
      nowMs: now,
    }),
    "delayed",
  );
  assert.equal(
    freshnessStatus({
      configured: true,
      lastSuccessIso: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      lastAttemptIso: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      latestError: "timeout",
      activelyRunning: false,
      intervalMs: 5 * 60 * 1000,
      nowMs: now,
    }),
    "stale",
  );
  assert.equal(
    freshnessStatus({
      configured: false,
      lastSuccessIso: null,
      lastAttemptIso: null,
      latestError: null,
      activelyRunning: false,
      intervalMs: 5 * 60 * 1000,
      nowMs: now,
    }),
    "unavailable",
  );
});

test("compact UI shows Updating while a source is syncing and keeps last-known-good age otherwise", () => {
  const now = Date.parse("2026-08-20T12:00:00.000Z");
  const shopify = buildSourceFreshness({
    source: "shopify",
    configured: true,
    latest: {
      id: "s1",
      status: "completed",
      started_at: new Date(now - 120_000).toISOString(),
      completed_at: new Date(now - 90_000).toISOString(),
    },
    lastSuccess: {
      id: "s1",
      status: "completed",
      started_at: new Date(now - 120_000).toISOString(),
      completed_at: new Date(now - 90_000).toISOString(),
    },
    nowMs: now,
  });
  const metaSyncing = buildSourceFreshness({
    source: "meta",
    configured: true,
    latest: {
      id: "m1",
      status: "running",
      started_at: new Date(now - 10_000).toISOString(),
      completed_at: null,
    },
    lastSuccess: {
      id: "m0",
      status: "completed",
      started_at: new Date(now - 300_000).toISOString(),
      completed_at: new Date(now - 240_000).toISOString(),
    },
    nowMs: now,
  });
  const compact = compactFreshnessLabel([shopify, metaSyncing], now);
  assert.equal(compact.status, "syncing");
  assert.equal(compact.label, "Updating…");
  assert.equal(formatFreshnessAge(90_000), "Updated 2m ago");
  const snapshot = buildFreshnessSnapshot([shopify, metaSyncing], now);
  assert.match(snapshot.version, /syncing/);
});

test("stale running Meta rows older than the 300s window are not syncing", () => {
  const now = Date.parse("2026-08-20T12:10:00.000Z");
  const freshness = buildSourceFreshness({
    source: "meta",
    configured: true,
    latest: {
      id: "old",
      status: "running",
      started_at: new Date(now - META_SYNC_MAX_DURATION_MS - 1_000).toISOString(),
      completed_at: null,
    },
    lastSuccess: {
      id: "ok",
      status: "completed",
      started_at: new Date(now - 10 * 60 * 1000).toISOString(),
      completed_at: new Date(now - 9 * 60 * 1000).toISOString(),
    },
    nowMs: now,
  });
  assert.notEqual(freshness.status, "syncing");
  assert.equal(freshness.last_successful_sync != null, true);
});

test("warehouse coverage does not claim a range until both ends are filled", () => {
  function warehouseCoversPeriod(
    coverage: { minDate: string | null; maxDate: string | null },
    startDate: string,
    endDate: string,
  ) {
    if (!coverage.minDate || !coverage.maxDate) return false;
    return coverage.minDate <= startDate && coverage.maxDate >= endDate;
  }
  assert.equal(
    warehouseCoversPeriod({ minDate: "2026-08-10", maxDate: "2026-08-20", populatedAt: "x" }, "2026-08-01", "2026-08-20"),
    false,
  );
  assert.equal(
    warehouseCoversPeriod({ minDate: "2026-08-01", maxDate: "2026-08-20", populatedAt: "x" }, "2026-08-10", "2026-08-20"),
    true,
  );
  assert.equal(
    warehouseCoversPeriod({ minDate: null, maxDate: null, populatedAt: null }, "2026-08-10", "2026-08-20"),
    false,
  );
});

test("campaign-shaped rows cannot masquerade as adset or ad data", () => {
  const campaignShaped = [
    { campaignId: "fwl-uuid", adsetId: "", adId: "" },
    { campaignId: "fwl-uuid-2", adsetId: null, adId: null },
  ];
  const adset = countableGrainRows("adset", campaignShaped);
  const ad = countableGrainRows("ad", campaignShaped);
  assert.equal(adset.count, 0);
  assert.equal(adset.skip, DEEP_GRAIN_MISSING_IDS);
  assert.equal(ad.count, 0);
  assert.equal(ad.skip, DEEP_GRAIN_MISSING_IDS);
  assert.equal(countableGrainRows("adset", [{ adsetId: "123" }]).count, 1);
  assert.equal(countableGrainRows("ad", [{ adId: "456" }]).count, 1);
});

test("first-fill kicks only never-succeeded sources with backoff", () => {
  const now = Date.parse("2026-08-20T22:00:00.000Z");
  assert.equal(
    shouldKickFirstFill({
      configured: true,
      warehouseReady: true,
      lastSuccessAt: null,
      lastAttemptAt: null,
      activelyRunning: false,
      nowMs: now,
    }),
    true,
  );
  assert.equal(
    shouldKickFirstFill({
      configured: true,
      warehouseReady: true,
      lastSuccessAt: new Date(now - 60_000).toISOString(),
      lastAttemptAt: new Date(now - 60_000).toISOString(),
      activelyRunning: false,
      nowMs: now,
    }),
    false,
  );
  assert.equal(
    shouldKickFirstFill({
      configured: true,
      warehouseReady: true,
      lastSuccessAt: null,
      lastAttemptAt: new Date(now - 2 * 60 * 1000).toISOString(),
      activelyRunning: false,
      nowMs: now,
    }),
    false,
  );
  assert.equal(
    shouldKickFirstFill({
      configured: true,
      warehouseReady: false,
      lastSuccessAt: null,
      lastAttemptAt: null,
      activelyRunning: false,
      nowMs: now,
    }),
    false,
  );
  const snapshot = buildFreshnessSnapshot(
    [
      buildSourceFreshness({
        source: "shopify",
        configured: true,
        latest: null,
        lastSuccess: null,
        nowMs: now,
      }),
      buildSourceFreshness({
        source: "meta",
        configured: true,
        latest: null,
        lastSuccess: null,
        nowMs: now,
      }),
    ],
    now,
  );
  assert.deepEqual(firstFillSourcesFromSnapshot(snapshot, { warehouseReady: true, nowMs: now }), [
    "shopify",
    "meta",
  ]);
});

test("production freshness crons are independent and not sequential sync-all", () => {
  assert.equal(SOURCE_SCHEDULES.meta.cron, "0 14 * * *");
  assert.equal(SOURCE_SCHEDULES.shopify.cron, "0 15 * * *");
  const vercel = readFileSync("vercel.json", "utf8");
  assert.match(vercel, /\/api\/cron\/meta/);
  assert.match(vercel, /\/api\/cron\/shopify/);
  assert.match(vercel, /\/api\/cron\/ga4/);
  assert.match(vercel, /\/api\/cron\/stape/);
  assert.match(vercel, /\/api\/cron\/daily/);
  assert.doesNotMatch(vercel, /"\*\/5 \* \* \* \*"/);
  assert.equal(vercel.includes("/api/cron/sync"), false);
  const daily = readFileSync("src/lib/platform/orchestrator.ts", "utf8");
  assert.match(daily, /runDailyReconciliation/);
  assert.match(daily, /Promise\.allSettled/);
  const metaCron = readFileSync("src/app/api/cron/meta/route.ts", "utf8");
  assert.doesNotMatch(metaCron, /runScheduledSync\("all"/);
  const shopifyCron = readFileSync("src/app/api/cron/shopify/route.ts", "utf8");
  assert.doesNotMatch(shopifyCron, /runScheduledSync\("all"/);
});
