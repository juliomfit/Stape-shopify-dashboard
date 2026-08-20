import { syncMetaHourly, syncMetaBackfill, type MetaSyncResult } from "@/lib/ads/meta-ingest";
import { getGa4Config } from "@/lib/ads/ga4-config";
import { getGoogleClaimed } from "@/lib/ads/google";
import { getSelectedPeriod } from "@/lib/period-server";
import { syncGa4Hourly, syncGoogleAdsPlaceholder, syncStapeHealth } from "@/lib/platform/sync-other";
import { finishSyncRun, findActiveSyncRun, startSyncRun, type SyncRun } from "@/lib/platform/sync-runs";
import { isShopifyConfigured } from "@/lib/shopify/config";
import { ingestShopifyIncremental } from "@/lib/shopify/ingest";
import { isStapeConfigured } from "@/lib/stape/config";
import { invalidateCachedSources } from "@/lib/cache/invalidate";
import type { CachedSource, InvalidationMode } from "@/lib/cache/tags";
import {
  googleAdsApiConfigured,
  googleAdsEnvTotalsConfigured,
  googleAdsIsConfigured,
} from "@/lib/platform/google-health";
import { acquireSyncLock, releaseSyncLock } from "@/lib/platform/lock";
import {
  SHOPIFY_DAILY_LOOKBACK_DAYS,
  SHOPIFY_INCREMENTAL_LOOKBACK_DAYS,
} from "@/lib/freshness/schedules";

export type ScheduledSyncResult = {
  ok: boolean;
  message: string;
  run: SyncRun | MetaSyncResult["run"];
};

export type ScheduledSyncOptions = {
  invalidation?: InvalidationMode;
  shopifyLookbackDays?: number;
};

async function invalidate(source: CachedSource, mode: InvalidationMode) {
  await invalidateCachedSources(source, { mode });
}

async function googleAdsRefreshConfigured() {
  const period = await getSelectedPeriod();
  const claim = await getGoogleClaimed(period);
  return googleAdsIsConfigured({
    pasteConnected: claim.state === "connected",
    apiConfigured: googleAdsApiConfigured(),
    envTotalsConfigured: googleAdsEnvTotalsConfigured(),
  });
}

export async function runScheduledSync(
  source: string,
  options: ScheduledSyncOptions = {},
): Promise<ScheduledSyncResult> {
  const invalidation = options.invalidation ?? "hard";
  if (source === "meta") {
    const result = await syncMetaHourly();
    if (result.ok) {
      await invalidate("meta", invalidation);
    }
    return result;
  }
  if (source === "ga4") {
    if (!getGa4Config()) {
      return {
        ok: true,
        message: "GA4 is not configured. Set GA4_PROPERTY_ID to enable Data API pulls.",
        run: null,
      };
    }
    const run = await syncGa4Hourly();
    if (run.status !== "failed") {
      await invalidate("ga4", invalidation);
    }
    return { ok: run.status !== "failed", message: run.error_message || "GA4 sync finished.", run };
  }
  if (source === "google_ads") {
    if (!(await googleAdsRefreshConfigured())) {
      return {
        ok: true,
        message: "Google Ads is not configured. Paste spend on First-touch if you want totals.",
        run: null,
      };
    }
    const run = await syncGoogleAdsPlaceholder();
    if (run.status !== "failed") {
      await invalidate("google_ads", invalidation);
    }
    return {
      ok: run.status !== "failed",
      message: run.error_message || "Google spend check finished.",
      run,
    };
  }
  if (source === "stape") {
    if (!isStapeConfigured()) {
      return {
        ok: true,
        message: "Stape / BigQuery is not configured.",
        run: null,
      };
    }
    const run = await syncStapeHealth();
    if (run.status !== "failed") {
      await invalidate("stape", invalidation);
    }
    return { ok: run.status !== "failed", message: run.error_message || "Stape health recorded.", run };
  }
  if (source === "shopify") {
    const already = await findActiveSyncRun("shopify");
    if (already) {
      return { ok: false, message: "Shopify sync already running", run: already };
    }
    const lookbackDays = options.shopifyLookbackDays ?? SHOPIFY_INCREMENTAL_LOOKBACK_DAYS;
    const run = await startSyncRun({
      source: "shopify",
      syncType: "incremental_warehouse",
    });
    const locked = await acquireSyncLock("shopify", run.id);
    if (!locked) {
      const finished = await finishSyncRun(run, {
        status: "failed",
        error_message: "Shopify sync already running",
      });
      return { ok: false, message: finished.error_message || "Shopify sync already running", run: finished };
    }
    try {
      if (!isShopifyConfigured()) {
        const finished = await finishSyncRun(run, {
          status: "failed",
          error_message: "Shopify is not configured.",
        });
        return { ok: false, message: finished.error_message || "Shopify missing.", run: finished };
      }
      let ingested: Awaited<ReturnType<typeof ingestShopifyIncremental>>;
      try {
        ingested = await ingestShopifyIncremental(lookbackDays);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Shopify ingest failed.";
        const finished = await finishSyncRun(run, {
          status: "failed",
          error_message: message,
        });
        return { ok: false, message, run: finished };
      }
      if (ingested.ok) {
        await invalidate("shopify", invalidation);
      }
      const finished = await finishSyncRun(run, {
        status: ingested.ok ? (ingested.truncated ? "partial" : "completed") : "failed",
        records_inserted: ingested.records,
        error_message: ingested.ok ? undefined : ingested.message,
        metadata: JSON.stringify({
          lookbackDays,
          truncated: ingested.truncated,
          note: ingested.message,
        }),
      });
      return {
        ok: ingested.ok,
        message: ingested.message,
        run: finished,
      };
    } finally {
      await releaseSyncLock("shopify");
    }
  }
  if (source === "all") {
    const parts: string[] = [];
    const nested = { invalidation };
    const meta = await runScheduledSync("meta", nested);
    parts.push(`Meta ${meta.ok ? "ok" : "failed"}`);
    if (getGa4Config()) {
      const ga4 = await runScheduledSync("ga4", nested);
      parts.push(`GA4 ${ga4.ok ? "ok" : "failed"}`);
    }
    if (await googleAdsRefreshConfigured()) {
      const google = await runScheduledSync("google_ads", nested);
      parts.push(`Google Ads ${google.ok ? "ok" : "skipped/failed"}`);
    }
    if (isStapeConfigured()) {
      const stape = await runScheduledSync("stape", nested);
      parts.push(`Stape ${stape.ok ? "ok" : "failed"}`);
    }
    if (isShopifyConfigured()) {
      const shopify = await runScheduledSync("shopify", nested);
      parts.push(`Shopify ${shopify.ok ? "ok" : "failed"}`);
    }
    return {
      ok: meta.ok,
      message: `Refresh all (configured sources only): ${parts.join(" · ")}. ${meta.message}`,
      run: meta.run,
    };
  }
  return { ok: false, message: `Unknown source ${source}`, run: null };
}

/**
 * Daily deeper reconciliation. Independent sources run in parallel.
 * source=all remains an admin-only sequential operation.
 */
export async function runDailyReconciliation() {
  const nested: ScheduledSyncOptions = { invalidation: "swr" };
  const jobs: Promise<ScheduledSyncResult>[] = [
    runScheduledSync("meta", nested),
    runScheduledSync("shopify", {
      ...nested,
      shopifyLookbackDays: SHOPIFY_DAILY_LOOKBACK_DAYS,
    }),
  ];
  if (getGa4Config()) {
    jobs.push(runScheduledSync("ga4", nested));
  }
  if (isStapeConfigured()) {
    jobs.push(runScheduledSync("stape", nested));
  }
  const settled = await Promise.allSettled(jobs);
  const parts = settled.map((item, index) => {
    if (item.status === "fulfilled") {
      return item.value.ok ? `ok:${index}` : `failed:${index}`;
    }
    return `rejected:${index}`;
  });
  const ok = settled.every((item) => item.status === "fulfilled" && item.value.ok);
  return {
    ok,
    message: `Daily reconciliation (parallel sources): ${parts.join(" · ")}`,
    source: "daily",
  };
}

export { syncMetaBackfill, syncMetaHourly };
