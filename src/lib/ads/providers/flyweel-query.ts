/**
 * Flyweel query_metrics ads contract.
 *
 * Verified ads dimensions (Flyweel public MCP docs, 11 ads dimensions):
 * channel, account, campaign, campaign_id, campaign_status, objective,
 * currency, date, week, month.
 *
 * query_metrics "enforces campaign view for ads data". No adset/ad dimension
 * is in that registry. Do not send child-grain aliases and pretend they worked.
 *
 * This environment has no Flyweel MCP/API key. Live initialize without a key
 * returns HTTP 401 Authentication required. Capability below is the documented
 * query_metrics contract plus production evidence that campaign_id values are
 * Flyweel UUIDs, not Meta {{campaign.id}} numerics.
 */

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

/** Candidate names audited against the Flyweel ads dimension registry. None are supported. */
export const FLYWEEL_CHILD_GRAIN_DIMENSION_CANDIDATES = [
  "adset_id",
  "adset",
  "adset_name",
  "ad_id",
  "ad",
  "ad_name",
  "platform_adset_id",
  "platform_ad_id",
  "external_adset_id",
  "external_ad_id",
  "source_adset_id",
  "source_ad_id",
] as const;

export const FLYWEEL_CAMPAIGN_DIMENSIONS = [
  "date",
  "campaign_id",
  "campaign",
  "channel",
  "campaign_status",
] as const;

const ADSET_DIMENSION_ALIASES = [
  "adset_id",
  "adset",
  "adset_name",
  "platform_adset_id",
  "external_adset_id",
  "source_adset_id",
] as const;

const AD_DIMENSION_ALIASES = [
  "ad_id",
  "ad",
  "ad_name",
  "platform_ad_id",
  "external_ad_id",
  "source_ad_id",
] as const;

export function flyweelSupportsDimension(name: string) {
  return FLYWEEL_ADS_DIMENSIONS.has(name);
}

export function verifiedFlyweelDimensions(requested: readonly string[]) {
  return requested.filter((name) => FLYWEEL_ADS_DIMENSIONS.has(name));
}

export function flyweelSupportsAdsetGrain() {
  return ADSET_DIMENSION_ALIASES.some((name) => FLYWEEL_ADS_DIMENSIONS.has(name));
}

export function flyweelSupportsAdGrain() {
  return AD_DIMENSION_ALIASES.some((name) => FLYWEEL_ADS_DIMENSIONS.has(name));
}

export function flyweelChildGrainVerified() {
  return flyweelSupportsAdsetGrain() && flyweelSupportsAdGrain();
}

export function flyweelDimensionsForLevel(level: "campaign" | "adset" | "ad"): string[] {
  if (level === "adset") {
    if (!flyweelSupportsAdsetGrain()) return [];
    return verifiedFlyweelDimensions(["date", "campaign_id", "campaign", "adset_id", "adset"]);
  }
  if (level === "ad") {
    if (!flyweelSupportsAdGrain()) return [];
    return verifiedFlyweelDimensions(["date", "campaign_id", "campaign", "ad_id", "ad"]);
  }
  return verifiedFlyweelDimensions(FLYWEEL_CAMPAIGN_DIMENSIONS);
}

function adsQuery(input: {
  metrics: string[];
  dimensions: string[];
  dateRange: Record<string, unknown>;
  limit: number;
}) {
  return {
    dataSource: "ads",
    metrics: input.metrics,
    dimensions: input.dimensions,
    dateRange: input.dateRange,
    filters: { channel: ["Meta"] },
    limit: input.limit,
  };
}

/**
 * Build query_metrics shapes that actually use the caller-supplied metrics
 * and dimensions. Empty verified dimensions → no query (do not fall back to
 * a campaign-grain query while claiming another level).
 *
 * Multiple metric batches become multiple queries in one request (max 5).
 */
export function buildFlyweelQueryShapes(input: {
  startDate: string;
  endDate: string;
  metrics: string[];
  dimensions: string[];
  todayStartDate?: string;
  rowLimit?: number;
  metricBatches?: string[][];
}): Record<string, unknown>[] {
  const batches = (input.metricBatches?.length ? input.metricBatches : [input.metrics])
    .map((batch) => batch.filter(Boolean))
    .filter((batch) => batch.length > 0);
  const dimensions = verifiedFlyweelDimensions(input.dimensions);
  if (!batches.length || !dimensions.length) {
    return [];
  }
  const limit = input.rowLimit ?? 500;
  const dayRange = { start: input.startDate, end: input.endDate };
  const packed = (range: Record<string, unknown>, dims: string[]) => ({
    queries: batches.slice(0, 5).map((metrics) =>
      adsQuery({ metrics, dimensions: dims, dateRange: range, limit }),
    ),
  });
  if (input.startDate !== input.endDate) {
    return [packed(dayRange, dimensions)];
  }

  const withoutDate = dimensions.filter((name) => name !== "date");
  const shapes: Record<string, unknown>[] = [];
  if (withoutDate.length) {
    shapes.push(packed(dayRange, withoutDate));
    if (input.todayStartDate && input.startDate === input.todayStartDate) {
      shapes.push(packed({ preset: "today" }, withoutDate));
    }
  }
  shapes.push(packed(dayRange, dimensions));
  return shapes;
}

export function queryShapeDimensions(shape: Record<string, unknown>): string[] {
  const queries = Array.isArray(shape.queries) ? shape.queries : [];
  const first = queries[0];
  if (!first || typeof first !== "object") return [];
  const dimensions = (first as { dimensions?: unknown }).dimensions;
  return Array.isArray(dimensions) ? dimensions.map((name) => String(name)) : [];
}

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
