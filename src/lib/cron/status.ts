import { publicBuildInfo } from "@/lib/build-info";
import { getMetaFactTableCounts } from "@/lib/ads/meta-fact-counts";
import { isPlatformBqReady } from "@/lib/platform/bq";
import { latestSuccessfulSync, latestSync } from "@/lib/platform/sync-runs";
import { isShopifyConfigured } from "@/lib/shopify/config";
import { summarizeShopifyWarehouse } from "@/lib/shopify/warehouse";
import { SOURCE_SCHEDULES, DAILY_RECON_CRON, EVENING_INGEST_CRON } from "@/lib/freshness/schedules";

function syncSummary(
  latest: Awaited<ReturnType<typeof latestSync>>,
  success: Awaited<ReturnType<typeof latestSuccessfulSync>>,
) {
  return {
    lastAttemptAt: latest?.started_at ?? null,
    lastAttemptStatus: latest?.status ?? null,
    lastSuccessAt: success?.completed_at ?? null,
    lastError: latest?.status === "failed" ? latest.error_message ?? null : null,
  };
}

/** Warehouse serving census for operators. No order or customer PII. */
export async function getIngestStatus() {
  const [
    shopifyFacts,
    metaFacts,
    shopifyLatest,
    shopifyOk,
    metaLatest,
    metaOk,
    ga4Latest,
    ga4Ok,
    stapeLatest,
    stapeOk,
  ] = await Promise.all([
    summarizeShopifyWarehouse(),
    getMetaFactTableCounts(),
    latestSync("shopify"),
    latestSuccessfulSync("shopify"),
    latestSync("meta"),
    latestSuccessfulSync("meta"),
    latestSync("ga4"),
    latestSuccessfulSync("ga4"),
    latestSync("stape"),
    latestSuccessfulSync("stape"),
  ]);

  return {
    ok: true,
    generated_at: new Date().toISOString(),
    ...publicBuildInfo(),
    warehouseReady: isPlatformBqReady(),
    shopify: {
      configured: isShopifyConfigured(),
      serving: shopifyFacts.available && (shopifyFacts.rowCount ?? 0) > 0 ? "warehouse" : "admin-or-empty",
      facts: shopifyFacts,
      sync: syncSummary(shopifyLatest, shopifyOk),
    },
    meta: {
      facts: metaFacts,
      sync: syncSummary(metaLatest, metaOk),
    },
    ga4: { sync: syncSummary(ga4Latest, ga4Ok) },
    stape: { sync: syncSummary(stapeLatest, stapeOk) },
    schedules: {
      meta: SOURCE_SCHEDULES.meta.cron,
      shopify: SOURCE_SCHEDULES.shopify.cron,
      ga4: SOURCE_SCHEDULES.ga4.cron,
      stape: SOURCE_SCHEDULES.stape.cron,
      daily: DAILY_RECON_CRON,
      evening: EVENING_INGEST_CRON,
    },
  };
}
