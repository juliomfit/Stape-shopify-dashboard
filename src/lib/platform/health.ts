import { getMetaCredentials } from "@/lib/ads/meta-credentials";
import { getPlatformReported } from "@/lib/ads/get-platform-reported";
import { isShopifyConfigured } from "@/lib/shopify/config";
import { isStapeConfigured } from "@/lib/stape/config";
import { isOpenAiConfigured } from "@/lib/platform/config";
import { latestSuccessfulSync, latestSync, type SyncRun } from "@/lib/platform/sync-runs";
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
};

function fromRun(run: SyncRun | null, success: SyncRun | null): {
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  runStatus: SourceHealthStatus | null;
} {
  return {
    lastAttemptAt: run?.started_at ?? null,
    lastSuccessAt: success?.completed_at ?? null,
    runStatus: run
      ? run.status === "running"
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
    return await loadDataHealth();
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

async function loadDataHealth(): Promise<SourceHealth[]> {
  const period = await getSelectedPeriod();
  const [
    metaCreds,
    ads,
    metaRun,
    metaOk,
    shopifyRun,
    stapeRun,
    ga4Run,
    googleRun,
  ] = await Promise.all([
    getMetaCredentials(),
    getPlatformReported(period),
    latestSync("meta"),
    latestSuccessfulSync("meta"),
    latestSync("shopify"),
    latestSync("stape"),
    latestSync("ga4"),
    latestSync("google_ads"),
  ]);

  const metaFromRun = fromRun(metaRun, metaOk);
  const metaConnected =
    Boolean(metaCreds.credentials) ||
    ads.facebook.state === "connected" ||
    Boolean(process.env.FLYWEEL_API_KEY?.trim());
  let metaStatus: SourceHealthStatus = "disconnected";
  let metaMessage = "Not connected. Use Flyweel API key or Integrations Graph OAuth, or paste spend.";
  const flyweelOn = Boolean(process.env.FLYWEEL_API_KEY?.trim());
  const metaProvider = flyweelOn ? "Flyweel" : metaCreds.credentials ? "Meta Graph" : "none";
  if (metaFromRun.runStatus === "syncing") {
    metaStatus = "syncing";
    metaMessage = "Meta sync in progress.";
  } else if (metaFromRun.runStatus === "error") {
    metaStatus = "error";
    metaMessage = metaRun?.error_message || "Last Meta sync failed.";
  } else if (metaFromRun.runStatus === "partial") {
    metaStatus = "partial";
    metaMessage = metaRun?.error_message || "Last Meta sync was partial.";
  } else if (metaConnected && metaOk) {
    metaStatus = delayed(metaOk.completed_at) ? "delayed" : "healthy";
    metaMessage = `Provider: ${metaProvider}. Last successful sync ${metaOk.completed_at}`;
  } else if (ads.facebook.state === "connected") {
    metaStatus = "healthy";
    metaMessage = ads.facebook.message || "Using pasted Ads Manager totals for this range.";
  } else if (metaConnected) {
    metaStatus = "partial";
    metaMessage = flyweelOn
      ? "FLYWEEL_API_KEY is set but no successful warehouse sync yet. Press Refresh Meta."
      : "Token saved but no successful platform sync yet. Press Refresh Meta.";
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
  const ga4: SourceHealth = {
    source: "ga4",
    label: "GA4",
    status: !ga4Configured
      ? "disconnected"
      : ga4From.runStatus || "partial",
    lastSuccessAt: ga4From.lastSuccessAt,
    lastAttemptAt: ga4From.lastAttemptAt,
    message: ga4Configured
      ? ga4Run?.error_message || "GA4 Data API property set. Sync on cron."
      : "Set GA4_PROPERTY_ID to enable Data API pulls. sGTM BigQuery remains the event warehouse.",
    href: "/integrations",
  };

  const googleFrom = fromRun(googleRun, await latestSuccessfulSync("google_ads"));
  const google: SourceHealth = {
    source: "google_ads",
    label: "Google Ads",
    status:
      ads.google.state === "connected"
        ? "healthy"
        : googleFrom.runStatus || "disconnected",
    lastSuccessAt: googleFrom.lastSuccessAt,
    lastAttemptAt: googleFrom.lastAttemptAt,
    message:
      ads.google.state === "connected"
        ? ads.google.message || "Pasted Ads Manager totals for this range."
        : "Paste Google spend on True Performance. Ads API needs a developer token (not wired).",
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
      href: "/integrations",
      provider: metaProvider,
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
