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
 *
 * Connected Vercel Git integration rejected sub-daily expressions at deploy
 * time (Hobby: once per day). Keep each source on its own daily slot, staggered
 * by hour because Hobby invocation can land anywhere in that hour.
 *
 * Pro unlock (do not ship until the Vercel project actually accepts it):
 * Meta every 5 minutes, Shopify every 5 minutes staggered, GA4 every 15 minutes,
 * Stape health hourly.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

export const SOURCE_SCHEDULES: Record<FreshnessSourceId, SourceSchedule> = {
  meta: {
    source: "meta",
    label: "Meta",
    cron: "0 14 * * *",
    intervalMs: DAY_MS,
    maxDurationMs: 300 * 1000,
  },
  shopify: {
    source: "shopify",
    label: "Shopify",
    cron: "0 15 * * *",
    intervalMs: DAY_MS,
    maxDurationMs: 120 * 1000,
  },
  ga4: {
    source: "ga4",
    label: "GA4",
    cron: "0 16 * * *",
    intervalMs: DAY_MS,
    maxDurationMs: 60 * 1000,
  },
  stape: {
    source: "stape",
    label: "Stape / BigQuery",
    cron: "0 17 * * *",
    intervalMs: DAY_MS,
    maxDurationMs: 60 * 1000,
    healthOnly: true,
  },
  google_ads: {
    source: "google_ads",
    label: "Google Ads",
    cron: "",
    intervalMs: DAY_MS,
    maxDurationMs: 60 * 1000,
  },
};

export const DAILY_RECON_CRON = "0 18 * * *";

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
