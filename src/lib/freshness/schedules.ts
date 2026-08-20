export type FreshnessSourceId = "shopify" | "meta" | "ga4" | "stape" | "google_ads";

export type SourceSchedule = {
  source: FreshnessSourceId;
  label: string;
  /** Vercel cron expression used in production freshness. */
  cron: string;
  intervalMs: number;
  maxDurationMs: number;
  /** Stape events already stream into BigQuery; cron is health-only. */
  healthOnly?: boolean;
};

/**
 * Production freshness cadences. Independent jobs — never a sequential sync-all.
 * Vercel Pro supports every-5-minute crons. Hobby is daily-only; keep the daily recon job either way.
 */
export const SOURCE_SCHEDULES: Record<FreshnessSourceId, SourceSchedule> = {
  meta: {
    source: "meta",
    label: "Meta",
    cron: "*/5 * * * *",
    intervalMs: 5 * 60 * 1000,
    maxDurationMs: 300 * 1000,
  },
  shopify: {
    source: "shopify",
    label: "Shopify",
    cron: "1-59/5 * * * *",
    intervalMs: 5 * 60 * 1000,
    maxDurationMs: 120 * 1000,
  },
  ga4: {
    source: "ga4",
    label: "GA4",
    cron: "3,18,33,48 * * * *",
    intervalMs: 15 * 60 * 1000,
    maxDurationMs: 60 * 1000,
  },
  stape: {
    source: "stape",
    label: "Stape / BigQuery",
    cron: "7 * * * *",
    intervalMs: 60 * 60 * 1000,
    maxDurationMs: 60 * 1000,
    healthOnly: true,
  },
  google_ads: {
    source: "google_ads",
    label: "Google Ads",
    cron: "",
    intervalMs: 24 * 60 * 60 * 1000,
    maxDurationMs: 60 * 1000,
  },
};

export const DAILY_RECON_CRON = "0 15 * * *";

export const FRESHNESS_POLL_MS = 45_000;

export const SHOPIFY_INCREMENTAL_LOOKBACK_DAYS = 3;
export const SHOPIFY_DAILY_LOOKBACK_DAYS = 30;

export function scheduleFor(source: string): SourceSchedule | null {
  if (
    source === "shopify" ||
    source === "meta" ||
    source === "ga4" ||
    source === "stape" ||
    source === "google_ads"
  ) {
    return SOURCE_SCHEDULES[source];
  }
  return null;
}

export function nextExpectedSyncIso(
  lastAttemptIso: string | null,
  intervalMs: number,
  nowMs = Date.now(),
): string | null {
  if (!intervalMs) return null;
  const from = lastAttemptIso ? Date.parse(lastAttemptIso) : NaN;
  const base = Number.isFinite(from) ? from : nowMs;
  const next = base + intervalMs;
  return new Date(Math.max(next, nowMs)).toISOString();
}

