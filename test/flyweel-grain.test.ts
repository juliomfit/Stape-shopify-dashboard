import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  FLYWEEL_ADS_DIMENSIONS,
  FLYWEEL_CHILD_GRAIN_DIMENSION_CANDIDATES,
  buildFlyweelQueryShapes,
  flyweelChildGrainVerified,
  flyweelDimensionsForLevel,
  flyweelSupportsAdGrain,
  flyweelSupportsAdsetGrain,
  queryShapeDimensions,
} from "../src/lib/ads/providers/flyweel-query.ts";
import {
  FLYWEEL_CAMPAIGN_ONLY_WARNING,
  FLYWEEL_PARTIAL_HEALTHY_MESSAGE,
  shouldFetchDeepMetaInsights,
} from "../src/lib/ads/providers/config.ts";
import {
  DEEP_GRAIN_MISSING_IDS,
  countableGrainRows,
} from "../src/lib/ads/insight-grain.ts";
import {
  campaignIdExactMatchAllowed,
  isFlyweelInternalUuid,
  isNativeMetaNumericId,
} from "../src/lib/attribution/meta-id-namespace.ts";
import { joinMetaAndOurCampaigns } from "../src/lib/attribution/campaign-map.ts";
import {
  buildMetaFactIndexes,
  mapCampaignIdentity,
} from "../src/lib/attribution/meta-credit.ts";
import { presentMetaAdsHealth } from "../src/lib/platform/meta-health.ts";
import {
  formatWarehouseFinishError,
  mergeSyncRunMetadata,
  pickLatestSyncRun,
  warehouseFinishErrorFromMetadata,
} from "../src/lib/platform/sync-run-state.ts";

const flyweelSrc = readFileSync("src/lib/ads/providers/flyweel.ts", "utf8");
const ingestSrc = readFileSync("src/lib/ads/meta-ingest.ts", "utf8");

test("Flyweel ads dimensions are campaign grain only", () => {
  assert.deepEqual(
    [...FLYWEEL_ADS_DIMENSIONS].sort(),
    [
      "account",
      "campaign",
      "campaign_id",
      "campaign_status",
      "channel",
      "currency",
      "date",
      "month",
      "objective",
      "week",
    ],
  );
  for (const name of FLYWEEL_CHILD_GRAIN_DIMENSION_CANDIDATES) {
    assert.equal(FLYWEEL_ADS_DIMENSIONS.has(name), false, name);
  }
  assert.equal(flyweelSupportsAdsetGrain(), false);
  assert.equal(flyweelSupportsAdGrain(), false);
  assert.equal(flyweelChildGrainVerified(), false);
  assert.equal(shouldFetchDeepMetaInsights("flyweel"), false);
});

test("queryShapes actually respects level and dimensions", () => {
  const campaignDims = flyweelDimensionsForLevel("campaign");
  const shapes = buildFlyweelQueryShapes({
    startDate: "2026-08-19",
    endDate: "2026-08-19",
    metrics: ["spend", "impressions", "clicks", "conversions"],
    dimensions: campaignDims,
  });
  assert.ok(shapes.length > 0);
  for (const shape of shapes) {
    const dims = queryShapeDimensions(shape);
    assert.ok(dims.includes("campaign_id"));
    assert.equal(dims.includes("adset_id"), false);
    assert.equal(dims.includes("ad_id"), false);
    const query = (shape.queries as Record<string, unknown>[])[0];
    assert.deepEqual(query.metrics, ["spend", "impressions", "clicks", "conversions"]);
  }
  assert.match(flyweelSrc, /this\.queryShapes\(params, metrics, dimensions\)/);
});

test("campaign query cannot masquerade as adset query", () => {
  assert.deepEqual(flyweelDimensionsForLevel("adset"), []);
  const shapes = buildFlyweelQueryShapes({
    startDate: "2026-08-19",
    endDate: "2026-08-19",
    metrics: ["spend"],
    dimensions: flyweelDimensionsForLevel("adset"),
  });
  assert.deepEqual(shapes, []);
  assert.match(flyweelSrc, /if \(!this\.dimensionsFor\(params\.level\)\.length\)/);
});

test("campaign query cannot masquerade as ad query", () => {
  assert.deepEqual(flyweelDimensionsForLevel("ad"), []);
  const shapes = buildFlyweelQueryShapes({
    startDate: "2026-08-19",
    endDate: "2026-08-19",
    metrics: ["spend"],
    dimensions: flyweelDimensionsForLevel("ad"),
  });
  assert.deepEqual(shapes, []);
});

test("adset_row_count stays 0 without adsetId", () => {
  const masquerade = [
    { campaignId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", adsetId: "", adId: "" },
    { campaignId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", adsetId: "  ", adId: null },
    { campaignId: "bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee" },
  ];
  const counted = countableGrainRows("adset", masquerade);
  assert.equal(counted.report.raw_rows, 3);
  assert.equal(counted.report.valid_campaign_id_rows, 3);
  assert.equal(counted.report.valid_adset_id_rows, 0);
  assert.equal(counted.count, 0);
  assert.equal(counted.skip, DEEP_GRAIN_MISSING_IDS);
  assert.match(ingestSrc, /countableGrainRows\("adset"/);
});

test("ad_row_count stays 0 without adId", () => {
  const masquerade = [
    { campaignId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", adsetId: "", adId: "" },
    { campaignId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" },
    { campaignId: "bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee", adId: null },
  ];
  const counted = countableGrainRows("ad", masquerade);
  assert.equal(counted.report.raw_rows, 3);
  assert.equal(counted.report.valid_ad_id_rows, 0);
  assert.equal(counted.count, 0);
  assert.equal(counted.skip, DEEP_GRAIN_MISSING_IDS);
  assert.match(ingestSrc, /countableGrainRows\("ad"/);
});

test("Flyweel internal UUID does not HIGH-match native numeric Meta ID", () => {
  const flyweelId = "a1b2c3d4-e5f6-4789-8abc-def012345678";
  assert.equal(isFlyweelInternalUuid(flyweelId), true);
  assert.equal(isNativeMetaNumericId("120218123456789"), true);
  assert.equal(campaignIdExactMatchAllowed("120218123456789", flyweelId), false);
  assert.equal(campaignIdExactMatchAllowed(flyweelId, flyweelId), false);
  assert.equal(campaignIdExactMatchAllowed("111", "111"), true);

  const rows = joinMetaAndOurCampaigns(
    [
      {
        campaign_id: flyweelId,
        campaign_name: "Prospecting",
        spend: 100,
        impressions: 10,
        clicks: 2,
        purchases: 3,
        purchase_value: 150,
      },
    ],
    [{ campaign: "120218123456789", channel: "Facebook / Meta Ads", orders: 1, revenue: 80 }],
  );
  const byNumeric = rows.find((row) => row.campaignName === "120218123456789");
  assert.equal(byNumeric?.mappingMethod, "unmapped");
  assert.equal(byNumeric?.mappingConfidence, "NONE");
  const uuidExact = joinMetaAndOurCampaigns(
    [
      {
        campaign_id: flyweelId,
        campaign_name: "Prospecting",
        spend: 100,
        impressions: 10,
        clicks: 2,
        purchases: 3,
        purchase_value: 150,
      },
    ],
    [{ campaign: flyweelId, channel: "Facebook / Meta Ads", orders: 1, revenue: 80 }],
  );
  const uuidRow = uuidExact.find((row) => row.campaignName === flyweelId || row.campaignId === flyweelId);
  assert.notEqual(uuidRow?.mappingMethod, "campaign_id_exact");
  assert.notEqual(uuidRow?.mappingConfidence, "HIGH");
});

test("campaign unique-name fallback remains PARTIAL only against Flyweel UUIDs", () => {
  const flyweelId = "a1b2c3d4-e5f6-4789-8abc-def012345678";
  const rows = joinMetaAndOurCampaigns(
    [
      {
        campaign_id: flyweelId,
        campaign_name: "Prospecting",
        spend: 100,
        impressions: 10,
        clicks: 2,
        purchases: 3,
        purchase_value: 150,
      },
    ],
    [{ campaign: "prospecting", channel: "Facebook / Meta Ads", orders: 1, revenue: 80 }],
  );
  const row = rows.find((item) => item.campaignId === flyweelId);
  assert.equal(row?.mappingMethod, "campaign_name_exact_unique");
  assert.equal(row?.mappingConfidence, "PARTIAL");

  const indexes = buildMetaFactIndexes({
    campaigns: [{ campaign_id: flyweelId, campaign_name: "Prospecting" }],
  });
  const mapped = mapCampaignIdentity(
    { campaignId: "120218123456789", campaign: "Prospecting" },
    indexes,
  );
  assert.equal(mapped.method, "campaign_name_exact_unique");
  assert.equal(mapped.confidence, "PARTIAL");
});

test("unsupported child grain does not make campaign integration a fatal error", () => {
  const presented = presentMetaAdsHealth({
    providerId: "flyweel",
    connected: true,
    latest: {
      id: "run-ok",
      status: "completed",
      started_at: "2026-08-20T00:00:00.000Z",
      completed_at: "2026-08-20T00:02:00.000Z",
      error_message: null,
      metadata: JSON.stringify({
        campaign_row_count: 3,
        adset_row_count: 0,
        ad_row_count: 0,
      }),
    },
    lastSuccess: {
      id: "run-ok",
      status: "completed",
      started_at: "2026-08-20T00:00:00.000Z",
      completed_at: "2026-08-20T00:02:00.000Z",
    },
  });
  assert.notEqual(presented.status, "error");
  assert.equal(presented.status, "partial");
  assert.match(presented.message, new RegExp(FLYWEEL_PARTIAL_HEALTHY_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(presented.warning, FLYWEEL_CAMPAIGN_ONLY_WARNING);
});

test("successful sync terminal-state BQ persistence failure becomes observable", () => {
  const error = formatWarehouseFinishError(
    new Error("replace denied"),
    new Error("insert denied"),
  );
  assert.match(error, /replace=replace denied/);
  assert.match(error, /insert=insert denied/);
  const metadata = mergeSyncRunMetadata(JSON.stringify({ campaign_row_count: 3 }), {
    warehouse_finish_error: error,
  });
  assert.equal(warehouseFinishErrorFromMetadata(metadata), error);
  const presented = presentMetaAdsHealth({
    providerId: "flyweel",
    connected: true,
    latest: {
      id: "run-ok",
      status: "completed",
      started_at: "2026-08-20T00:00:00.000Z",
      completed_at: "2026-08-20T00:02:00.000Z",
      metadata,
    },
    lastSuccess: {
      id: "run-ok",
      status: "completed",
      started_at: "2026-08-20T00:00:00.000Z",
      completed_at: "2026-08-20T00:02:00.000Z",
      metadata,
    },
  });
  assert.equal(presented.status, "partial");
  assert.match(presented.message, /Warehouse sync history write failed/);
  assert.match(presented.message, /insert denied/);
  const syncRuns = readFileSync("src/lib/platform/sync-runs.ts", "utf8");
  assert.match(syncRuns, /console\.error\("\[sync-runs\] replaceRowsById failed"/);
  assert.match(syncRuns, /console\.error\("\[sync-runs\] insertRows fallback failed"/);
  assert.equal(syncRuns.includes("Local history still holds. BQ writer may lack CREATE/INSERT."), false);
});

test("stale running rows do not override a newer persisted completed sync", () => {
  const now = Date.parse("2026-08-20T01:00:00.000Z");
  const stale = {
    id: "old-running",
    status: "running",
    started_at: "2026-08-20T00:50:00.000Z",
    completed_at: null,
  };
  const completed = {
    id: "done",
    status: "completed",
    started_at: "2026-08-20T00:40:00.000Z",
    completed_at: "2026-08-20T00:42:00.000Z",
  };
  assert.equal(pickLatestSyncRun([stale, completed], now)?.id, "done");
});
