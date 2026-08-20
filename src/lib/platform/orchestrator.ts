import { syncMetaHourly, syncMetaBackfill, type MetaSyncResult } from "@/lib/ads/meta-ingest";
import { getGa4Config } from "@/lib/ads/ga4-config";
import { getGoogleClaimed } from "@/lib/ads/google";
import { getSelectedPeriod } from "@/lib/period-server";
import { syncGa4Hourly, syncGoogleAdsPlaceholder, syncStapeHealth } from "@/lib/platform/sync-other";
import { finishSyncRun, startSyncRun, type SyncRun } from "@/lib/platform/sync-runs";
import { isShopifyConfigured } from "@/lib/shopify/config";
import { isStapeConfigured } from "@/lib/stape/config";
import { invalidateCachedSources } from "@/lib/cache/invalidate";
import type { CachedSource, InvalidationMode } from "@/lib/cache/tags";
import {
  googleAdsApiConfigured,
  googleAdsEnvTotalsConfigured,
  googleAdsIsConfigured,
} from "@/lib/platform/google-health";

export type ScheduledSyncResult = {
  ok: boolean;
  message: string;
  run: SyncRun | MetaSyncResult["run"];
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
  options: { invalidation?: InvalidationMode } = {},
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
    const run = await startSyncRun({ source: "shopify", syncType: "cache_refresh" });
    if (!isShopifyConfigured()) {
      const finished = await finishSyncRun(run, {
        status: "failed",
        error_message: "Shopify is not configured.",
      });
      return { ok: false, message: finished.error_message || "Shopify missing.", run: finished };
    }
    await invalidate("shopify", invalidation);
    const { getShopifyOverviewForPeriod } = await import("@/lib/shopify/get-overview-metrics");
    const period = await getSelectedPeriod();
    const warmed = await getShopifyOverviewForPeriod(period);
    const connected = warmed.status.state === "connected";
    const finished = await finishSyncRun(run, {
      status: connected ? "completed" : "partial",
      records_inserted: warmed.orders ?? 0,
      error_message: connected
        ? undefined
        : warmed.status.state === "error"
          ? warmed.status.message
          : undefined,
      metadata: JSON.stringify({
        note: "Invalidated Shopify cache and reloaded the current period from the Admin API.",
      }),
    });
    return {
      ok: connected,
      message: connected
        ? "Shopify cache cleared and the current period was reloaded from the Admin API."
        : warmed.status.state === "error"
          ? `Shopify cache cleared, but Admin API reload failed: ${warmed.status.message}`
          : "Shopify cache cleared. Admin API is not connected.",
      run: finished,
    };
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

export { syncMetaBackfill, syncMetaHourly };
