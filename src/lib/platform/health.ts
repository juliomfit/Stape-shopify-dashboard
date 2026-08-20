import { getMetaCredentials } from "@/lib/ads/meta-credentials";
import { getPlatformReported } from "@/lib/ads/get-platform-reported";
import { getMetaFactTableCounts } from "@/lib/ads/meta-fact-counts";
import { formatMetaFactTableCounts, type MetaFactTableCounts } from "@/lib/ads/meta-fact-format";
import { presentMetaAdsHealth } from "@/lib/platform/meta-health";
import {
  googleAdsApiConfigured,
  googleAdsEnvTotalsConfigured,
  googleAdsHealthStatus,
  googleAdsIsConfigured,
} from "@/lib/platform/google-health";
import { cachedLoad, periodCacheKey } from "@/lib/cache/server-data";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { isShopifyConfigured } from "@/lib/shopify/config";
import { isStapeConfigured } from "@/lib/stape/config";
import { isOpenAiConfigured } from "@/lib/platform/config";
import { latestSuccessfulSync, latestSync, type SyncRun } from "@/lib/platform/sync-runs";
import { isSyncActivelyRunning } from "@/lib/platform/sync-run-state";
import { getSelectedPeriod } from "@/lib/period-server";

export type SourceHealthStatus =
  | "healthy"
  | "delayed"
  | "syncing"
  | "partial"
  | "error"
  | "disconnected";

export type SourceHealth = {
  source: string;
  label: string;
  status: SourceHealthStatus;
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  message: string;
  href: string;
  provider?: string;
  providerId?: "flyweel" | "meta_graph" | "none";
  warning?: string | null;
  factCounts?: MetaFactTableCounts;
};

function fromRun(run: SyncRun | null, success: SyncRun | null): {
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  runStatus: SourceHealthStatus | null;
  staleRunning: boolean;
} {
  const staleRunning = Boolean(run && run.status === "running" && !isSyncActivelyRunning(run));
  return {
    lastAttemptAt: run?.started_at ?? null,
    lastSuccessAt: success?.completed_at ?? null,
    staleRunning,
    runStatus: run
      ? staleRunning
        ? "error"
        : run.status === "running"
          ? "syncing"
          : run.status === "failed"
            ? "error"
            : run.status === "partial"
              ? "partial"
              : "healthy"
      : null,
  };
}

function delayed(iso: string | null) {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() > 3 * 60 * 60 * 1000;
}

export async function getDataHealth(): Promise<SourceHealth[]> {
  try {
    const period = await getSelectedPeriod();
    return cachedLoad({
      key: ["data-health", ...periodCacheKey(period)],
      tags: [CACHE_TAGS.health, CACHE_TAGS.dashboardCore, CACHE_TAGS.meta],
      loader: "health",
      period: `${period.startDate}..${period.endDate}`,
      fn: () => loadDataHealth(period),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Health check failed";
    return [
      {
        source: "platform",
        label: "Platform",
        status: "error",
        lastSuccessAt: null,
        lastAttemptAt: null,
        message,
        href: "/data-quality",
      },
    ];
  }
}

async function loadDataHealth(
  period: Awaited<ReturnType<typeof getSelectedPeriod>>,
): Promise<SourceHealth[]> {
  const [
    metaCreds,
    ads,
    metaRun,
    metaOk,
    shopifyRun,
    stapeRun,
    ga4Run,
    googleRun,
    metaFactCounts,
  ] = await Promise.all([
    getMetaCredentials(),
    getPlatformReported(period),
    latestSync("meta"),
    latestSuccessfulSync("meta"),
    latestSync("shopify"),
    latestSync("stape"),
    latestSync("ga4"),
    latestSync("google_ads"),
    getMetaFactTableCounts(),
  ]);

  const metaFromRun = fromRun(metaRun, metaOk);
  const metaConnected =
    Boolean(metaCreds.credentials) ||
    ads.facebook.state === "connected" ||
    Boolean(process.env.FLYWEEL_API_KEY?.trim());
  const flyweelOn = Boolean(process.env.FLYWEEL_API_KEY?.trim());
  const metaProviderId: "flyweel" | "meta_graph" | "none" = flyweelOn
    ? "flyweel"
    : metaCreds.credentials
      ? "meta_graph"
      : "none";
  const metaProvider =
    metaProviderId === "flyweel" ? "Flyweel" : metaProviderId === "meta_graph" ? "Meta Graph" : "none";
  const presented = presentMetaAdsHealth({
    providerId: metaProviderId,
    connected: metaConnected,
    latest: metaRun,
    lastSuccess: metaOk,
    pastedConnected: ads.facebook.state === "connected",
    pasteMessage: ads.facebook.message,
    delayed,
  });
  const metaStatus = presented.status;
  let metaMessage = presented.message;
  const metaWarning = presented.warning;
  const factLine = formatMetaFactTableCounts(metaFactCounts);
  if (factLine) {
    metaMessage = `${metaMessage} Facts: ${factLine}`.trim();
  }

  const shopify: SourceHealth = {
    source: "shopify",
    label: "Shopify",
    status: isShopifyConfigured() ? "healthy" : "disconnected",
    lastSuccessAt: shopifyRun?.completed_at ?? null,
    lastAttemptAt: shopifyRun?.started_at ?? null,
    message: isShopifyConfigured()
      ? "Live Admin API. Webhooks optional for faster order refresh."
      : "SHOPIFY_STORE_DOMAIN / CLIENT_ID / CLIENT_SECRET missing.",
    href: "/integrations",
  };

  const stape: SourceHealth = {
    source: "stape",
    label: "Stape / sGTM",
    status: isStapeConfigured() ? "healthy" : "disconnected",
    lastSuccessAt: stapeRun?.completed_at ?? null,
    lastAttemptAt: stapeRun?.started_at ?? null,
    message: isStapeConfigured()
      ? "Reading BigQuery event tables (not a pull sync)."
      : "BigQuery project/dataset/table not configured.",
    href: "/data-quality",
  };

  const ga4From = fromRun(ga4Run, await latestSuccessfulSync("ga4"));
  const ga4Configured = Boolean(process.env.GA4_PROPERTY_ID?.trim());
  const streamId = process.env.GA4_STREAM_ID?.trim();
  let ga4Status: SourceHealthStatus = "disconnected";
  let ga4Message =
    "Set GA4_PROPERTY_ID to enable Data API pulls. sGTM BigQuery remains the event warehouse.";
  if (ga4From.runStatus === "syncing") {
    ga4Status = "syncing";
    ga4Message = "GA4 Data API sync in progress.";
  } else if (ga4From.runStatus === "error") {
    ga4Status = "error";
    ga4Message = ga4Run?.error_message || "Last GA4 sync failed.";
  } else if (ga4Configured && ga4From.lastSuccessAt) {
    ga4Status = delayed(ga4From.lastSuccessAt) ? "delayed" : "healthy";
    ga4Message = `Data API · property ${process.env.GA4_PROPERTY_ID?.trim()} · ${
      streamId ? `stream ${streamId}` : "all streams"
    }. Last success ${ga4From.lastSuccessAt}.`;
  } else if (ga4Configured) {
    ga4Status = "partial";
    ga4Message =
      "GA4_PROPERTY_ID is set. Enable Analytics Data API on the service-account GCP project, then Refresh GA4.";
  }
  const ga4: SourceHealth = {
    source: "ga4",
    label: "GA4",
    status: ga4Status,
    lastSuccessAt: ga4From.lastSuccessAt,
    lastAttemptAt: ga4From.lastAttemptAt,
    message: ga4Message,
    href: "/health",
  };

  const googleFrom = fromRun(googleRun, await latestSuccessfulSync("google_ads"));
  const googleConfigured = googleAdsIsConfigured({
    pasteConnected: ads.google.state === "connected",
  });
  const google: SourceHealth = {
    source: "google_ads",
    label: "Google Ads",
    status: googleAdsHealthStatus({
      pasteConnected: ads.google.state === "connected",
      apiConfigured: googleAdsApiConfigured(),
      envTotalsConfigured: googleAdsEnvTotalsConfigured(),
      lastRunStatus: googleFrom.runStatus,
    }),
    lastSuccessAt: googleFrom.lastSuccessAt,
    lastAttemptAt: googleFrom.lastAttemptAt,
    message:
      ads.google.state === "connected"
        ? ads.google.message || "Pasted Ads Manager totals for this range."
        : googleConfigured
          ? "Paste Google spend on First-touch. Ads API needs a developer token (not wired)."
          : "Google Ads is not configured. Paste spend on First-touch if you want totals.",
    href: "/attribution",
  };

  return [
    shopify,
    {
      source: "meta",
      label: "Meta Ads",
      status: metaStatus,
      lastSuccessAt: metaFromRun.lastSuccessAt,
      lastAttemptAt: metaFromRun.lastAttemptAt,
      message: metaMessage,
      href: "/meta",
      provider: metaProvider,
      providerId: metaProviderId,
      warning: metaWarning,
      factCounts: metaFactCounts,
    },
    google,
    ga4,
    stape,
    {
      source: "openai",
      label: "GoodsNova AI",
      status: isOpenAiConfigured() ? "healthy" : "disconnected",
      lastSuccessAt: null,
      lastAttemptAt: null,
      message: isOpenAiConfigured()
        ? "Optional. Dashboard does not need GPT."
        : "OPENAI_API_KEY not set. Charts still load.",
      href: "/ai",
    },
  ];
}
