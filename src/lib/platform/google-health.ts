export type GoogleAdsHealthStatus =
  | "healthy"
  | "delayed"
  | "syncing"
  | "partial"
  | "error"
  | "disconnected";

export function googleAdsApiConfigured(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): boolean {
  return Boolean(
    env.GOOGLE_ADS_CUSTOMER_ID?.trim() &&
      env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim() &&
      env.GOOGLE_ADS_REFRESH_TOKEN?.trim(),
  );
}

export function googleAdsEnvTotalsConfigured(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): boolean {
  return ["GOOGLE_ADS_SPEND", "GOOGLE_ADS_PURCHASES", "GOOGLE_ADS_REVENUE"].some(
    (name) => {
      const amount = Number(env[name]?.trim());
      return Number.isFinite(amount);
    },
  );
}

/**
 * A missing optional Google Ads integration is disconnected, never error.
 * Last-run failure only counts when something is actually configured.
 */
export function googleAdsHealthStatus(input: {
  pasteConnected: boolean;
  apiConfigured: boolean;
  envTotalsConfigured: boolean;
  lastRunStatus: GoogleAdsHealthStatus | null;
}): GoogleAdsHealthStatus {
  if (input.pasteConnected) {
    return input.lastRunStatus === "syncing" ? "syncing" : "healthy";
  }
  if (input.lastRunStatus === "syncing") {
    return "syncing";
  }
  const configured = input.apiConfigured || input.envTotalsConfigured;
  if (!configured) {
    return "disconnected";
  }
  return input.lastRunStatus || "disconnected";
}

export function googleAdsIsConfigured(input: {
  pasteConnected: boolean;
  apiConfigured?: boolean;
  envTotalsConfigured?: boolean;
  env?: Record<string, string | undefined>;
}): boolean {
  const env = (input.env ?? process.env) as Record<string, string | undefined>;
  return (
    input.pasteConnected ||
    (input.apiConfigured ?? googleAdsApiConfigured(env)) ||
    (input.envTotalsConfigured ?? googleAdsEnvTotalsConfigured(env))
  );
}
