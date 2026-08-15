export const FLYWEEL_ADS_DIMENSIONS = new Set([
  "channel",
  "account",
  "campaign",
  "campaign_id",
  "campaign_status",
  "objective",
  "currency",
  "date",
  "week",
  "month",
]);

export function buildFlyweelAdsQuery(params: {
  startDate: string;
  endDate: string;
  metrics: string[];
  dimensions: string[];
  campaignName?: string;
}): Record<string, unknown> {
  const allowed = params.dimensions.filter((name) => FLYWEEL_ADS_DIMENSIONS.has(name));
  const query: Record<string, unknown> = {
    dataSource: "ads",
    metrics: params.metrics,
    dimensions: allowed.length ? allowed : ["date", "campaign", "channel"],
    dateRange: { start: params.startDate, end: params.endDate },
    filters: { channel: ["Meta"] },
    limit: 500,
  };
  if (params.campaignName) {
    query.filters = { channel: ["Meta"], campaign: [params.campaignName] };
  }
  return { queries: [query] };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asCount(value: unknown): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function findMetaStatus(payload: unknown): Record<string, unknown> | null {
  const root = asRecord(payload);
  if (!root) {
    return null;
  }
  const direct = asRecord(asRecord(root.status)?.meta) || asRecord(asRecord(root.providers)?.meta);
  if (direct) {
    return direct;
  }
  const nested = [root.result, root.organization, root.data];
  for (const item of nested) {
    const found = findMetaStatus(item);
    if (found) {
      return found;
    }
  }
  return null;
}

export function summarizeFlyweelSetup(payload: unknown): {
  metaConnected: boolean;
  metaTotal: number | null;
  metaSelected: number | null;
  metaSync: string;
  message: string;
} {
  const meta = findMetaStatus(payload);
  const metaConnected = Boolean(
    meta && (meta.connected === true || meta.isConnected === true || meta.connected === "true"),
  );
  const metaTotal = asCount(meta?.totalAccounts ?? meta?.total_accounts ?? meta?.accounts);
  const metaSelected = asCount(meta?.selectedAccounts ?? meta?.selected_accounts ?? meta?.selected);
  const metaSync = String(meta?.syncStatus || meta?.lastSync || meta?.last_sync || "");
  let message = "Flyweel setup: Meta connection unknown.";
  if (metaConnected && metaSelected === 0) {
    message =
      "Flyweel has Meta connected, but no ad account is selected. Open Flyweel → Settings → Connections (not the API key page). Select the GoodsNova / FBSmash account 209273195421975, then Refresh Meta.";
  } else if (metaConnected && (metaSelected === null || metaSelected > 0)) {
    message = `Flyweel Meta is connected (${metaSelected ?? "?"} selected of ${metaTotal ?? "?"} accounts${metaSync ? `, sync ${metaSync}` : ""}).`;
  } else if (meta && !metaConnected) {
    message =
      "Flyweel Meta is not connected. Open Flyweel → Settings → Connections and connect Meta Ads, then select account 209273195421975.";
  }
  return { metaConnected, metaTotal, metaSelected, metaSync, message };
}
