import {
  FLYWEEL_CAMPAIGN_ONLY_WARNING,
  FLYWEEL_PARTIAL_HEALTHY_MESSAGE,
} from "../ads/providers/config.ts";
import {
  isSyncActivelyRunning,
  parseSyncRunMetadata,
  warehouseFinishErrorFromMetadata,
  type SyncRunLike,
} from "./sync-run-state.ts";
import { formatExtendedMetricsHealthMessage, sanitizeFlyweelUserError } from "../ads/providers/flyweel-errors.ts";

export type MetaAdsHealthStatus =
  | "healthy"
  | "delayed"
  | "syncing"
  | "partial"
  | "error"
  | "disconnected";

type HealthRun = SyncRunLike & {
  error_message?: string | null;
  metadata?: string | null;
};

export function presentMetaAdsHealth(input: {
  providerId: "flyweel" | "meta_graph" | "none";
  connected: boolean;
  latest: HealthRun | null;
  lastSuccess: HealthRun | null;
  pastedConnected?: boolean;
  pasteMessage?: string;
  delayed?: (iso: string | null) => boolean;
}): {
  status: MetaAdsHealthStatus;
  message: string;
  warning: string | null;
} {
  const delayed = input.delayed ?? ((iso: string | null) => {
    if (!iso) return false;
    return Date.now() - new Date(iso).getTime() > 3 * 60 * 60 * 1000;
  });
  const flyweelOn = input.providerId === "flyweel";
  const campaignOnlyWarning = flyweelOn ? FLYWEEL_CAMPAIGN_ONLY_WARNING : null;
  const persistError = warehouseFinishErrorFromMetadata(input.latest?.metadata)
    || warehouseFinishErrorFromMetadata(input.lastSuccess?.metadata);
  const latest = input.latest;
  const lastSuccess = input.lastSuccess;
  const staleRunning = Boolean(
    latest && latest.status === "running" && !isSyncActivelyRunning(latest),
  );
  const providerLabel =
    input.providerId === "flyweel"
      ? "Flyweel"
      : input.providerId === "meta_graph"
        ? "Meta Graph"
        : "none";

  let status: MetaAdsHealthStatus = "disconnected";
  let message = "Not connected. Use Flyweel API key or Integrations Graph OAuth, or paste spend.";

  if (latest && isSyncActivelyRunning(latest)) {
    status = "syncing";
    message = "Meta sync in progress.";
  } else if (staleRunning && !lastSuccess) {
    status = "error";
    message =
      "Last Meta sync timed out (no completion within 300s). Press Refresh Meta once.";
  } else if (latest?.status === "failed" && !lastSuccess) {
    status = "error";
    message = sanitizeFlyweelUserError(latest.error_message || "Last Meta sync failed.");
  } else if (input.connected && lastSuccess) {
    const base = flyweelOn
      ? FLYWEEL_PARTIAL_HEALTHY_MESSAGE
      : `Provider: ${providerLabel}. Last successful sync ${lastSuccess.completed_at}`;
    if (flyweelOn) {
      status = delayed(lastSuccess.completed_at ?? null) ? "delayed" : "partial";
      message = `${base} Last successful sync ${lastSuccess.completed_at}.`;
    } else {
      status = delayed(lastSuccess.completed_at ?? null) ? "delayed" : "healthy";
      message = base;
    }
  } else if (input.pastedConnected) {
    status = "healthy";
    message = input.pasteMessage || "Using pasted Ads Manager totals for this range.";
  } else if (input.connected) {
    status = "partial";
    message = flyweelOn
      ? "FLYWEEL_API_KEY is set but no successful warehouse sync yet. Press Refresh Meta."
      : "Token saved but no successful platform sync yet. Press Refresh Meta.";
  }

  const meta = parseSyncRunMetadata(input.lastSuccess?.metadata);
  const coverage = meta.flyweel_metric_coverage;
  const unknown = meta.flyweel_unknown_metrics;
  const healthMessage =
    typeof meta.flyweel_health_message === "string"
      ? meta.flyweel_health_message
      : formatExtendedMetricsHealthMessage({
          coverage:
            coverage === "baseline" || coverage === "partial" || coverage === "unavailable" || coverage === "full"
              ? coverage
              : "partial",
          candidateCount: Number(meta.flyweel_candidate_metric_count || 0),
          acceptedCount: Number(meta.flyweel_metrics_requested_count || 0),
          unknownCount: Array.isArray(unknown) ? unknown.length : 0,
        });
  if (
    flyweelOn &&
    (coverage === "partial" ||
      coverage === "baseline" ||
      coverage === "unavailable" ||
      (Array.isArray(unknown) && unknown.length > 0))
  ) {
    message = `${message} ${healthMessage || "Extended Meta metrics partial."}`.trim();
  }

  if (persistError && status !== "error" && status !== "disconnected" && status !== "syncing") {
    status = "partial";
    message = `${message} Warehouse sync history write failed: ${persistError}`.trim();
  }

  return {
    status,
    message,
    warning: campaignOnlyWarning,
  };
}
