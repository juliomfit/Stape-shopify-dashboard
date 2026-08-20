import {
  FLYWEEL_DIMENSION_LIMIT,
  FLYWEEL_METRIC_LIMIT,
  FLYWEEL_QUERY_BATCH_LIMIT,
  FLYWEEL_ROW_LIMIT,
  flyweelMetaAccountId,
} from "@/lib/ads/providers/config";
import { FlyweelMcpClient } from "@/lib/ads/providers/flyweel-mcp";
import { addDaysYmd } from "@/lib/ads/providers/chunk";
import { getDashboardPeriod } from "@/lib/period";
import {
  buildFlyweelQueryShapes,
  flyweelDimensionsForLevel,
  summarizeFlyweelSetup,
} from "@/lib/ads/providers/flyweel-query";
import {
  FLYWEEL_BASELINE_METRICS,
  groupedFlyweelMetaMetricBatches,
} from "@/lib/ads/providers/flyweel-catalog";
import {
  coverageFromHealth,
  getFlyweelMetricCatalog,
  summarizeMetricKeysFromRows,
  type FlyweelMetricHealth,
} from "@/lib/ads/providers/flyweel-metrics";
import {
  fetchFlyweelMetricBatches,
  FlyweelMetricQueryError,
  ecommerceSupportFromLive,
  payloadLooksLikeError,
} from "@/lib/ads/providers/flyweel-errors";
import {
  describeFlyweelPayload,
  mergeFlyweelMetricRows,
  normalizeAccount,
  normalizeInsightRow,
  parseNumber,
  pickField,
  unwrapRows,
} from "@/lib/ads/providers/normalize";
import type {
  InsightQuery,
  MetaAccount,
  MetaAd,
  MetaAdSet,
  MetaAdsProvider,
  MetaBreakdownRow,
  MetaCampaign,
  MetaCreative,
  MetaInsightResult,
  ProviderSyncResult,
} from "@/lib/ads/providers/types";

const BASELINE_METRICS = [...FLYWEEL_BASELINE_METRICS];


function daysInRange(startDate: string, endDate: string) {
  const days: string[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    days.push(cursor);
    cursor = addDaysYmd(cursor, 1);
  }
  return days;
}

function rowHasActivity(row: Record<string, unknown>) {
  return (
    parseNumber(pickField(row, ["spend", "cost", "amount_spent"])) > 0 ||
    parseNumber(pickField(row, ["impressions", "clicks"])) > 0
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function pickTool(available: Set<string>, candidates: string[]) {
  for (const name of candidates) {
    if (available.has(name)) {
      return name;
    }
  }
  return null;
}

export class FlyweelMetaAdsProvider implements MetaAdsProvider {
  readonly id = "flyweel";
  readonly label = "Flyweel";
  private client: FlyweelMcpClient;
  private tools: Set<string> | null = null;
  private lastMetrics: string[] | null = null;
  private verifiedMetricOptions: string[] | null = null;
  lastMetricHealth: FlyweelMetricHealth | null = null;

  constructor(client = new FlyweelMcpClient()) {
    this.client = client;
  }

  configured() {
    return this.client.configured();
  }

  lastDebug() {
    return this.lastParseDebug || "";
  }

  private lastQuerySnippet = "";
  private lastParseDebug = "";

  async setupSummary() {
    const payload = await this.callRead(["get_setup_status"]);
    return { payload, ...summarizeFlyweelSetup(payload) };
  }

  private async ensureTools() {
    if (this.tools) {
      return this.tools;
    }
    this.tools = new Set([
      "query_metrics",
      "list_ad_accounts",
      "select_ad_accounts",
      "get_setup_status",
      "trigger_sync",
      "get_sync_status",
    ]);
    return this.tools;
  }

  private async callRead(candidates: string[], args: Record<string, unknown> = {}) {
    const tools = await this.ensureTools();
    const name = pickTool(tools, candidates);
    if (!name) {
      throw new Error(`Flyweel MCP has none of: ${candidates.join(", ")}`);
    }
    return this.client.callTool(name, args);
  }

  async getAccounts(): Promise<MetaAccount[]> {
    const configured = flyweelMetaAccountId();
    let rows: Record<string, unknown>[] = [];
    try {
      const payload = await this.callRead(["list_ad_accounts", "listAdAccounts", "get_setup_status"]);
      rows = unwrapRows(payload).length ? unwrapRows(payload) : this.accountsFromSetup(payload);
    } catch {
      rows = [];
    }
    const parsed = rows
      .map((row) => normalizeAccount(row, this.id))
      .filter((row) => row.accountId);
    if (configured && !parsed.some((row) => row.accountId.replace(/^act_/, "") === configured)) {
      parsed.unshift({
        accountId: configured,
        accountName: "GoodsNova Meta",
        currency: undefined,
        timezone: undefined,
        platform: "meta",
        provider: this.id,
        raw: { account_id: configured },
      });
    }
    return parsed;
  }

  private accountsFromSetup(payload: unknown): Record<string, unknown>[] {
    const root = asRecord(payload);
    const providers = asRecord(root?.providers);
    const nested = [
      root?.accounts,
      root?.ad_accounts,
      root?.adAccounts,
      asRecord(root?.meta)?.accounts,
      asRecord(root?.facebook)?.accounts,
      asRecord(providers?.meta)?.accounts,
      asRecord(providers?.facebook)?.accounts,
      asRecord(asRecord(providers?.meta)?.data)?.accounts,
    ];
    for (const item of nested) {
      if (Array.isArray(item)) {
        return unwrapRows(item);
      }
    }
    return unwrapRows(payload);
  }

  async selectConfiguredMetaAccounts(accountId: string) {
    const wanted = accountId.replace(/^act_/, "");
    let ids = [wanted];
    try {
      const payload = await this.callRead(["list_ad_accounts"]);
      const found = this.accountsFromSetup(payload)
        .map((row) => String(row.account_id || row.accountId || row.id || "").replace(/^act_/, ""))
        .filter(Boolean);
      if (found.length) {
        ids = [...new Set([wanted, ...found])];
      }
    } catch {
      // Still select the configured Ads Manager id.
    }
    const account_ids = ids.map((id) => ({ accountId: id, isSelected: true }));
    const shapes: Record<string, unknown>[] = [
      { provider: "meta", account_ids },
      { provider: "facebook", account_ids },
      { account_ids },
    ];
    let lastError: unknown;
    for (const shape of shapes) {
      try {
        return await this.client.callTool("select_ad_accounts", shape);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("select_ad_accounts failed");
  }

  async getCampaigns(accountId: string): Promise<MetaCampaign[]> {
    const insights = await this.getInsights({
      accountId,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      level: "campaign",
    });
    const map = new Map<string, MetaCampaign>();
    for (const row of insights.rows) {
      if (!row.campaignId) continue;
      map.set(row.campaignId, {
        accountId,
        campaignId: row.campaignId,
        campaignName: row.campaignName || row.campaignId,
        raw: row.raw,
      });
    }
    return [...map.values()];
  }

  async getAdSets(accountId: string): Promise<MetaAdSet[]> {
    const insights = await this.getInsights({
      accountId,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      level: "adset",
    });
    const map = new Map<string, MetaAdSet>();
    for (const row of insights.rows) {
      if (!row.adsetId) continue;
      map.set(row.adsetId, {
        accountId,
        campaignId: row.campaignId,
        adsetId: row.adsetId,
        adsetName: row.adsetName || row.adsetId,
        raw: row.raw,
      });
    }
    return [...map.values()];
  }

  async getAds(accountId: string): Promise<MetaAd[]> {
    const insights = await this.getInsights({
      accountId,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      level: "ad",
    });
    const map = new Map<string, MetaAd>();
    for (const row of insights.rows) {
      if (!row.adId) continue;
      map.set(row.adId, {
        accountId,
        campaignId: row.campaignId,
        adsetId: row.adsetId,
        adId: row.adId,
        adName: row.adName || row.adId,
        raw: row.raw,
      });
    }
    return [...map.values()];
  }

  async getCreatives(accountId: string): Promise<MetaCreative[]> {
    void accountId;
    return [];
  }

  private dimensionsFor(level: InsightQuery["level"]) {
    return flyweelDimensionsForLevel(level).slice(0, FLYWEEL_DIMENSION_LIMIT);
  }

  private metricsList() {
    return (this.lastMetrics || BASELINE_METRICS).slice(0, FLYWEEL_METRIC_LIMIT);
  }

  private queryShapes(
    params: InsightQuery,
    metrics: string[],
    dimensions: string[],
    metricBatches?: string[][],
  ): Record<string, unknown>[] {
    return buildFlyweelQueryShapes({
      startDate: params.startDate,
      endDate: params.endDate,
      metrics,
      dimensions,
      metricBatches,
      todayStartDate: getDashboardPeriod("today").startDate,
      rowLimit: FLYWEEL_ROW_LIMIT,
    });
  }

  private async queryOnce(
    params: InsightQuery,
    metrics: string[],
    dimensions: string[],
    metricBatches?: string[][],
  ): Promise<Record<string, unknown>[]> {
    if (!metrics.length || !dimensions.length) {
      return [];
    }
    await this.ensureTools();
    const shapes = this.queryShapes(params, metrics, dimensions, metricBatches);
    let lastError: unknown;
    let best: Record<string, unknown>[] = [];
    for (const shape of shapes) {
      try {
        const payload = await this.callRead(["query_metrics", "queryMetrics"], shape);
        this.lastQuerySnippet = this.client.lastRawSnippet;
        this.lastParseDebug = describeFlyweelPayload(payload);
        const errorText = payloadLooksLikeError(payload);
        if (errorText) {
          lastError = new FlyweelMetricQueryError(errorText, payload, metrics);
          if (/invalid_metric|unknown metric|invalid metric/i.test(errorText)) {
            throw lastError;
          }
          continue;
        }
        const rows = unwrapRows(payload);
        const active = rows.filter(rowHasActivity);
        if (rows.length > best.length) {
          best = rows;
        }
        if (active.length) {
          return rows;
        }
      } catch (error) {
        if (error instanceof FlyweelMetricQueryError) {
          throw error;
        }
        lastError = error;
      }
    }
    if (best.length) {
      return best;
    }
    if (lastError && /metric|unknown|invalid|dimension/i.test(String(lastError))) {
      throw lastError instanceof Error ? lastError : new Error("query_metrics failed");
    }
    return best;
  }

  private async queryMetricsIsolated(
    params: InsightQuery,
    metrics: string[],
    dimensions: string[],
  ) {
    return this.queryMetricBatches(params, dimensions, groupedFlyweelMetaMetricBatches(metrics, FLYWEEL_METRIC_LIMIT));
  }

  private async queryMetricBatches(
    params: InsightQuery,
    dimensions: string[],
    batches: string[][],
  ) {
    const requested = batches.flat();
    if (!requested.length) {
      return {
        rows: [] as Record<string, unknown>[],
        accepted: [] as string[],
        unknown: [] as string[],
        validOptions: [] as string[],
        strategy: "direct" as const,
      };
    }
    const result = await fetchFlyweelMetricBatches({
      batches,
      baseline: BASELINE_METRICS,
      metricLimit: FLYWEEL_METRIC_LIMIT,
      query: async (nextBatches) => {
        const allRows: Record<string, unknown>[][] = [];
        for (let i = 0; i < nextBatches.length; i += FLYWEEL_QUERY_BATCH_LIMIT) {
          const slice = nextBatches.slice(i, i + FLYWEEL_QUERY_BATCH_LIMIT);
          allRows.push(await this.queryOnce(params, slice.flat(), dimensions, slice));
        }
        return allRows.flat();
      },
    });
    if (result.validOptions.length) {
      this.verifiedMetricOptions = result.validOptions;
    }
    if (result.accepted.length) {
      this.lastMetrics = result.accepted;
    }
    return result;
  }

  private async queryWithDimensionFallback(
    params: InsightQuery,
    batches: string[][],
  ) {
    const wanted = this.dimensionsFor(params.level);
    if (!wanted.length) {
      return {
        rows: [] as Record<string, unknown>[],
        accepted: [] as string[],
        unknown: [] as string[],
        validOptions: [] as string[],
        strategy: "direct" as const,
      };
    }
    try {
      return await this.queryMetricBatches(params, wanted, batches);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!/dimension|unknown|invalid|not supported/i.test(message)) {
        throw error;
      }
      const fallback =
        params.level === "campaign"
          ? ["date", "campaign_id", "campaign"]
          : wanted.slice(0, 3);
      return this.queryMetricBatches(params, fallback, batches);
    }
  }

  async getInsights(params: InsightQuery): Promise<MetaInsightResult> {
    const accountId = params.accountId.replace(/^act_/, "");
    const requestsBefore = this.client.requestCount;
    if (!this.dimensionsFor(params.level).length) {
      return {
        rows: [],
        actions: [],
        truncated: false,
        requests: this.client.requestCount - requestsBefore,
        splits: 0,
      };
    }
    const { catalog } = await getFlyweelMetricCatalog(this.client);
    const candidateNames = catalog.map((item) => item.name);
    const originalRequested = candidateNames;
    const unknown = new Set<string>();
    const accepted = new Set<string>();
    const returned = new Set<string>();
    const validOptions = new Set<string>(this.verifiedMetricOptions || []);
    let requested = this.verifiedMetricOptions?.length
      ? candidateNames.filter((name) => this.verifiedMetricOptions!.includes(name))
      : this.lastMetrics?.length
        ? this.lastMetrics
        : candidateNames;
    if (this.verifiedMetricOptions?.length) {
      candidateNames
        .filter((name) => !this.verifiedMetricOptions!.includes(name))
        .forEach((name) => unknown.add(name));
    }
    let batches = groupedFlyweelMetaMetricBatches(requested, FLYWEEL_METRIC_LIMIT);
    const days = daysInRange(params.startDate, params.endDate);
    const rawRows: Record<string, unknown>[] = [];
    for (const day of days) {
      const raw = await this.queryWithDimensionFallback(
        {
          ...params,
          accountId,
          startDate: day,
          endDate: day,
        },
        batches,
      );
      raw.unknown.forEach((name) => unknown.add(name));
      raw.accepted.forEach((name) => accepted.add(name));
      summarizeMetricKeysFromRows(raw.rows).forEach((name) => returned.add(name));
      (raw.validOptions || []).forEach((name) => validOptions.add(name));
      if (raw.accepted.length) {
        this.lastMetrics = raw.accepted;
        requested = raw.accepted;
        batches = groupedFlyweelMetaMetricBatches(raw.accepted, FLYWEEL_METRIC_LIMIT);
      }
      rawRows.push(...raw.rows);
    }
    const mergedRaw = mergeFlyweelMetricRows(rawRows, accountId);
    const rows = mergedRaw
      .map((row) =>
        normalizeInsightRow(row, {
          accountId,
          provider: this.id,
        }),
      )
      .filter((row) => row.date);
    const acceptedList = [...accepted];
    const unknownList = [...unknown];
    const validList = [...validOptions];
    const coverage = coverageFromHealth({
      requested: originalRequested,
      accepted: acceptedList,
      unknown: unknownList,
      baseline: BASELINE_METRICS,
    });
    const health: FlyweelMetricHealth = {
      flyweel_candidate_metric_count: candidateNames.length,
      flyweel_metric_catalog_count: validList.length || acceptedList.length,
      flyweel_metrics_requested: acceptedList.length ? acceptedList : requested,
      flyweel_metrics_requested_count: (acceptedList.length ? acceptedList : requested).length,
      flyweel_metric_batches: batches.length,
      flyweel_metrics_returned: [...returned],
      flyweel_unknown_metrics: unknownList,
      campaign_rows: rows.length,
      coverage,
      flyweel_ecommerce_support: ecommerceSupportFromLive({
        validOptions: validList,
        accepted: acceptedList,
        returned: [...returned],
      }),
    };
    this.lastMetricHealth = health;
    if (health.coverage !== "full") {
      console.info(
        "[flyweel-metrics]",
        JSON.stringify({
          coverage: health.coverage,
          flyweel_candidate_metric_count: health.flyweel_candidate_metric_count,
          flyweel_metric_catalog_count: health.flyweel_metric_catalog_count,
          flyweel_metrics_requested_count: health.flyweel_metrics_requested_count,
          flyweel_metric_batches: health.flyweel_metric_batches,
          flyweel_metrics_returned: health.flyweel_metrics_returned,
          flyweel_unknown_metrics: health.flyweel_unknown_metrics,
          flyweel_ecommerce_support: health.flyweel_ecommerce_support,
          campaign_rows: health.campaign_rows,
        }),
      );
    }
    return {
      rows,
      actions: this.actionsFromRows(rows, params.level),
      truncated: false,
      requests: this.client.requestCount - requestsBefore,
      splits: Math.max(0, days.length - 1),
      metricHealth: health,
    };
  }

  private actionsFromRows(rows: MetaInsightResult["rows"], level: InsightQuery["level"]) {
    const out: MetaInsightResult["actions"] = [];
    for (const row of rows) {
      const base = {
        date: row.date,
        accountId: row.accountId,
        campaignId: row.campaignId,
        adsetId: row.adsetId,
        adId: row.adId,
        reportingLevel: level,
        provider: this.id,
      };
      if (row.purchases) {
        out.push({ ...base, actionType: "purchase", actionCount: row.purchases, actionValue: 0 });
      }
      if (row.purchaseValue) {
        out.push({ ...base, actionType: "purchase", actionCount: 0, actionValue: row.purchaseValue });
      }
      if (row.addToCart) {
        out.push({ ...base, actionType: "add_to_cart", actionCount: row.addToCart, actionValue: 0 });
      }
      if (row.initiateCheckout) {
        out.push({
          ...base,
          actionType: "initiate_checkout",
          actionCount: row.initiateCheckout,
          actionValue: 0,
        });
      }
      if (row.landingPageViews) {
        out.push({
          ...base,
          actionType: "landing_page_view",
          actionCount: row.landingPageViews,
          actionValue: 0,
        });
      }
    }
    return out;
  }

  async getBreakdowns(params: InsightQuery & { dimensions: string[] }): Promise<MetaBreakdownRow[]> {
    const extra = params.dimensions.filter(Boolean).slice(0, 2);
    const dimensions = ["date", "campaign_id", ...extra].slice(0, FLYWEEL_DIMENSION_LIMIT);
    try {
      const isolated = await this.queryMetricsIsolated(params, BASELINE_METRICS, dimensions);
      const rows = isolated.rows;
      return rows.map((row) => {
        const insight = normalizeInsightRow(row, {
          accountId: params.accountId,
          provider: this.id,
        });
        const breakdownType = extra[0] || "unknown";
        const breakdownValue = String(row[breakdownType] ?? row.breakdown ?? "");
        return {
          date: insight.date,
          accountId: insight.accountId,
          campaignId: insight.campaignId,
          adsetId: insight.adsetId,
          adId: insight.adId,
          reportingLevel: params.level,
          breakdownType,
          breakdownValue,
          spend: insight.spend ?? 0,
          impressions: insight.impressions ?? 0,
          reach: insight.reach ?? 0,
          clicks: insight.clicks ?? 0,
          purchases: insight.purchases ?? 0,
          purchaseValue: insight.purchaseValue ?? 0,
          provider: this.id,
          raw: row,
        };
      });
    } catch {
      return [];
    }
  }

  async sync(params: { startDate?: string; endDate?: string } = {}): Promise<ProviderSyncResult> {
    try {
      const payload = await this.callRead(["trigger_sync", "triggerSync"], {
        start_date: params.startDate,
        end_date: params.endDate,
        platform: "meta",
      });
      const row = asRecord(payload) || {};
      const jobId = String(row.jobId || row.job_id || row.id || "");
      if (jobId) {
        await this.pollSync(jobId);
      }
      return {
        ok: true,
        jobId: jobId || undefined,
        status: String(row.status || "triggered"),
        message: "Flyweel sync requested (read-only refresh).",
        requests: this.client.requestCount,
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Flyweel trigger_sync failed",
        requests: this.client.requestCount,
      };
    }
  }

  private async pollSync(jobId: string) {
    const started = Date.now();
    while (Date.now() - started < 8_000) {
      const payload = await this.callRead(["get_sync_status", "getSyncStatus"], { jobId, job_id: jobId });
      const status = String(asRecord(payload)?.status || "").toLowerCase();
      if (["completed", "complete", "success", "ok"].includes(status)) {
        return;
      }
      if (["failed", "error"].includes(status)) {
        throw new Error(`Flyweel sync ${jobId} ${status}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

export function preferredFlyweelAccount(accounts: MetaAccount[]) {
  const configured = flyweelMetaAccountId();
  if (configured) {
    const match = accounts.find((row) => row.accountId.replace(/^act_/, "") === configured);
    if (match) {
      return match;
    }
  }
  const named = accounts.find((row) => /goodsnova/i.test(row.accountName));
  return named || accounts[0] || null;
}
