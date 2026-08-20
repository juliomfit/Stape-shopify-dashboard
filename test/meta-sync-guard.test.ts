import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  META_SYNC_ALREADY_RUNNING,
  META_SYNC_MAX_DURATION_SECONDS,
  buildMetaSyncMetadata,
  collapseSyncRunsById,
  isMetaSyncWinner,
  isSyncActivelyRunning,
  pickActiveSyncWinner,
  refreshMetaSyncUiMessage,
  syncRunDisplayStatus,
} from "../src/lib/platform/sync-run-state.ts";
import {
  FLYWEEL_CAMPAIGN_ONLY_WARNING,
  metaInsightLevelsToFetch,
  shouldFetchDeepMetaInsights,
} from "../src/lib/ads/providers/config.ts";

const route = readFileSync("src/app/api/meta/sync/route.ts", "utf8");
const ingest = readFileSync("src/lib/ads/meta-ingest.ts", "utf8");
const refresh = readFileSync("src/components/dashboard/RefreshControls.tsx", "utf8");
const syncRuns = readFileSync("src/lib/platform/sync-runs.ts", "utf8");

test("/api/meta/sync maxDuration is 300", () => {
  assert.match(route, /export const maxDuration = 300/);
  assert.equal(route.includes("export const maxDuration = 60"), false);
  assert.equal(META_SYNC_MAX_DURATION_SECONDS, 300);
  assert.equal(readFileSync("docs/PLATFORM.md", "utf8").includes("Hobby still caps at 60s"), false);
  assert.equal(
    readFileSync("docs/MANUAL_PRODUCTION_ACTIONS.md", "utf8").includes("Hobby still caps at 60s"),
    false,
  );
  assert.match(
    readFileSync("docs/PLATFORM.md", "utf8"),
    /Verify the deployed Production runtime accepts maxDuration=300/,
  );
});

test("campaign-only mode remains campaign only", () => {
  const prev = process.env.FLYWEEL_INGEST_LEVELS;
  try {
    delete process.env.FLYWEEL_INGEST_LEVELS;
    assert.equal(shouldFetchDeepMetaInsights("flyweel"), false);
    assert.deepEqual(metaInsightLevelsToFetch("flyweel"), ["campaign"]);
    assert.equal(
      FLYWEEL_CAMPAIGN_ONLY_WARNING,
      "Campaign-only Meta ingest — ad set/ad deterministic attribution unavailable.",
    );
    assert.match(ingest, /steps\.push\("flyweel-campaign-only"\)/);
    assert.match(ingest, /shouldFetchDeepMetaInsights\(provider\.id\)/);
  } finally {
    if (prev === undefined) delete process.env.FLYWEEL_INGEST_LEVELS;
    else process.env.FLYWEEL_INGEST_LEVELS = prev;
  }
});

test("FLYWEEL_INGEST_LEVELS=all cannot enable unverified Flyweel child grain", () => {
  const prev = process.env.FLYWEEL_INGEST_LEVELS;
  try {
    process.env.FLYWEEL_INGEST_LEVELS = "all";
    assert.equal(shouldFetchDeepMetaInsights("flyweel"), false);
    assert.deepEqual(metaInsightLevelsToFetch("flyweel"), ["campaign"]);
    assert.match(ingest, /level: "adset"/);
    assert.match(ingest, /level: "ad"/);
    assert.match(ingest, /level: "campaign"/);
    assert.equal(shouldFetchDeepMetaInsights("meta_graph"), true);
    assert.deepEqual(metaInsightLevelsToFetch("meta_graph"), ["campaign", "adset", "ad"]);
  } finally {
    if (prev === undefined) delete process.env.FLYWEEL_INGEST_LEVELS;
    else process.env.FLYWEEL_INGEST_LEVELS = prev;
  }
});

test("repeat Meta refresh is rejected while an active sync exists", () => {
  const now = Date.parse("2026-08-20T00:00:00.000Z");
  const active = {
    id: "run-1",
    status: "running",
    started_at: new Date(now - 10_000).toISOString(),
  };
  assert.equal(isSyncActivelyRunning(active, now), true);
  assert.equal(pickActiveSyncWinner([active], now)?.id, "run-1");
  const candidate = {
    id: "run-2",
    status: "running",
    started_at: new Date(now - 1_000).toISOString(),
  };
  assert.equal(isMetaSyncWinner([active, candidate], "run-2", now), false);
  assert.equal(isMetaSyncWinner([active, candidate], "run-1", now), true);
  assert.equal(META_SYNC_ALREADY_RUNNING, "Meta sync already running");
  assert.match(ingest, /findActiveSyncRun\("meta"\)/);
  assert.match(ingest, /META_SYNC_ALREADY_RUNNING/);
  assert.match(route, /status: alreadyRunning \? 409 : 200/);
  assert.match(refresh, /inFlight\.current/);
  assert.match(refresh, /disabled=\{pending\}/);
  assert.match(refresh, /refreshMetaSyncUiMessage/);
  assert.match(refresh, /\/api\/meta\/refresh/);
});

test("HTTP 409 UI path is reachable before generic !ok failure", () => {
  const helper = readFileSync("src/lib/platform/sync-run-state.ts", "utf8");
  const alreadyIndex = helper.indexOf("input.status === 409");
  const genericOkIndex = helper.indexOf("if (!input.ok)");
  assert.ok(alreadyIndex >= 0);
  assert.ok(genericOkIndex > alreadyIndex);

  const json409 = refreshMetaSyncUiMessage({
    status: 409,
    ok: false,
    parsed: { ok: false, message: META_SYNC_ALREADY_RUNNING, error: META_SYNC_ALREADY_RUNNING },
    raw: JSON.stringify({
      ok: false,
      message: META_SYNC_ALREADY_RUNNING,
      error: META_SYNC_ALREADY_RUNNING,
    }),
  });
  assert.equal(json409.message, "Meta sync already running");
  assert.equal(json409.alreadyRunning, true);
  assert.equal(json409.shouldRefresh, false);
  assert.equal(json409.message.includes("Refresh failed (HTTP 409)"), false);

  const opaque409 = refreshMetaSyncUiMessage({
    status: 409,
    ok: false,
    parsed: null,
    raw: "Conflict",
  });
  assert.equal(opaque409.message, "Meta sync already running");
  assert.equal(opaque409.message.includes("Refresh failed (HTTP 409)"), false);

  const generic500 = refreshMetaSyncUiMessage({
    status: 500,
    ok: false,
    parsed: { ok: false, message: "boom" },
    raw: '{"ok":false,"message":"boom"}',
  });
  assert.equal(generic500.message, "Refresh failed (HTTP 500): boom");
  assert.match(refresh, /finally \{[\s\S]*inFlight\.current = false[\s\S]*setPending\(false\)/);
});

test("HTTP 202 enqueue is shown as started, not as a completed Flyweel wait", () => {
  const accepted = refreshMetaSyncUiMessage({
    status: 202,
    ok: true,
    parsed: { ok: true, message: "Meta refresh started" },
    raw: '{"ok":true,"message":"Meta refresh started"}',
  });
  assert.equal(accepted.message, "Meta refresh started");
  assert.equal(accepted.alreadyRunning, false);
  assert.equal(accepted.shouldRefresh, true);
});

test("completed sync no longer appears as a duplicate running + completed state", () => {
  const started = "2026-08-20T00:00:00.000Z";
  const completed = "2026-08-20T00:02:00.000Z";
  const collapsed = collapseSyncRunsById([
    { id: "same", status: "running", started_at: started, completed_at: null },
    {
      id: "same",
      status: "completed",
      started_at: started,
      completed_at: completed,
    },
  ]);
  assert.equal(collapsed.length, 1);
  assert.equal(collapsed[0].status, "completed");
  assert.equal(collapsed[0].completed_at, completed);
  assert.equal(isSyncActivelyRunning(collapsed[0], Date.parse(completed) + 1_000), false);
  assert.match(syncRuns, /collapseSyncRunsById/);
  assert.match(syncRuns, /replaceRowsById/);
});

test("stale running sync is not treated as actively running forever", () => {
  const now = Date.parse("2026-08-20T00:10:00.000Z");
  const stale = {
    id: "old",
    status: "running",
    started_at: "2026-08-20T00:00:00.000Z",
  };
  assert.equal(now - Date.parse(stale.started_at), 600_000);
  assert.equal(isSyncActivelyRunning(stale, now), false);
  assert.equal(syncRunDisplayStatus(stale, now), "stale/timed-out");
  assert.equal(pickActiveSyncWinner([stale], now), null);
});

test("completed Meta sync metadata records deep ingest counts", () => {
  const meta = buildMetaSyncMetadata({
    provider: "flyweel",
    deep_ingest_enabled: true,
    campaign_row_count: 15,
    adset_row_count: 40,
    ad_row_count: 90,
    provider_requests: 6,
    elapsed_ms: 82000,
    steps: ["provider:flyweel"],
    account_id: "209273195421975",
  });
  assert.equal(meta.provider, "flyweel");
  assert.equal(meta.deep_ingest_enabled, true);
  assert.equal(meta.campaign_row_count, 15);
  assert.equal(meta.adset_row_count, 40);
  assert.equal(meta.ad_row_count, 90);
  assert.equal(meta.provider_requests, 6);
  assert.equal(meta.elapsed_ms, 82000);
  assert.equal((meta.steps as string[]).includes("flyweel-campaign-only"), false);
  const campaignOnly = buildMetaSyncMetadata({
    provider: "flyweel",
    deep_ingest_enabled: false,
    campaign_row_count: 15,
    adset_row_count: 0,
    ad_row_count: 0,
    provider_requests: 2,
    elapsed_ms: 59000,
    steps: ["flyweel-campaign-only"],
    adset_skip: undefined,
  });
  assert.equal(campaignOnly.deep_ingest_enabled, false);
  assert.deepEqual(campaignOnly.steps, ["flyweel-campaign-only"]);
});
