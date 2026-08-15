import { finishSyncRun, startSyncRun } from "@/lib/platform/sync-runs";
import { isStapeConfigured } from "@/lib/stape/config";
import { getGoogleClaimed } from "@/lib/ads/google";
import { getSelectedPeriod } from "@/lib/period-server";
import { ingestGa4 } from "@/lib/ads/ga4-ingest";

export async function syncStapeHealth() {
  const run = await startSyncRun({ source: "stape", syncType: "healthcheck" });
  if (!isStapeConfigured()) {
    return finishSyncRun(run, {
      status: "failed",
      error_message: "BigQuery is not configured.",
    });
  }
  return finishSyncRun(run, { status: "completed", records_inserted: 0 });
}

export async function syncGoogleAdsPlaceholder() {
  const period = await getSelectedPeriod();
  const run = await startSyncRun({
    source: "google_ads",
    syncType: "paste_or_env",
    lookbackStart: period.startDate,
    lookbackEnd: period.endDate,
  });
  const claim = await getGoogleClaimed(period);
  if (claim.state !== "connected") {
    return finishSyncRun(run, {
      status: "failed",
      error_message: claim.message || "No Google Ads spend for this range.",
    });
  }
  return finishSyncRun(run, {
    status: "completed",
    records_inserted: 1,
    metadata: JSON.stringify({ note: "Paste/env totals. Google Ads API not connected." }),
  });
}

export async function syncGa4Hourly() {
  return ingestGa4();
}
