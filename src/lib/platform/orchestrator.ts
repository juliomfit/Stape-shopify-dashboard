import { syncMetaHourly, syncMetaBackfill, type MetaSyncResult } from "@/lib/ads/meta-ingest";
import { syncGa4Hourly, syncGoogleAdsPlaceholder, syncStapeHealth } from "@/lib/platform/sync-other";
import { finishSyncRun, startSyncRun, type SyncRun } from "@/lib/platform/sync-runs";
import { isShopifyConfigured } from "@/lib/shopify/config";

export type ScheduledSyncResult = {
  ok: boolean;
  message: string;
  run: SyncRun | MetaSyncResult["run"];
};

export async function runScheduledSync(source: string): Promise<ScheduledSyncResult> {
  if (source === "meta") {
    return syncMetaHourly();
  }
  if (source === "ga4") {
    const run = await syncGa4Hourly();
    return { ok: run.status !== "failed", message: run.error_message || "GA4 sync finished.", run };
  }
  if (source === "google_ads") {
    const run = await syncGoogleAdsPlaceholder();
    return { ok: run.status !== "failed", message: run.error_message || "Google spend check finished.", run };
  }
  if (source === "stape") {
    const run = await syncStapeHealth();
    return { ok: run.status !== "failed", message: run.error_message || "Stape health recorded.", run };
  }
  if (source === "shopify") {
    const run = await startSyncRun({ source: "shopify", syncType: "reconcile" });
    if (!isShopifyConfigured()) {
      const finished = await finishSyncRun(run, {
        status: "failed",
        error_message: "Shopify is not configured.",
      });
      return { ok: false, message: finished.error_message || "Shopify missing.", run: finished };
    }
    const finished = await finishSyncRun(run, { status: "completed" });
    return { ok: true, message: "Shopify remains live Admin API; no duplicate warehouse.", run: finished };
  }
  if (source === "all") {
    const meta = await syncMetaHourly();
    await syncGa4Hourly();
    await syncGoogleAdsPlaceholder();
    await syncStapeHealth();
    await runScheduledSync("shopify");
    return {
      ok: meta.ok,
      message: `Hourly bundle: Meta ${meta.ok ? "ok" : "failed"}. ${meta.message}`,
      run: meta.run,
    };
  }
  return { ok: false, message: `Unknown source ${source}`, run: null };
}

export { syncMetaBackfill, syncMetaHourly };
