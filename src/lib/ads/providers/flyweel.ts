import {
  FLYWEEL_DIMENSION_LIMIT,
  FLYWEEL_METRIC_LIMIT,
  FLYWEEL_ROW_LIMIT,
  flyweelMetaAccountId,
} from "@/lib/ads/providers/config";
import { FlyweelMcpClient } from "@/lib/ads/providers/flyweel-mcp";
import { queryDateRangeChunked, SilentTruncationError } from "@/lib/ads/providers/chunk";
import { buildFlyweelAdsQuery, FLYWEEL_ADS_DIMENSIONS, summarizeFlyweelSetup } from "@/lib/ads/providers/flyweel-query";
import {
  mergeInsightBatches,
  normalizeAccount,
  normalizeInsightRow,
  unwrapRows,
  payloadLooksLikeError,
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

const BASELINE_METRICS = [
  "spend",
  "impressions",
  "clicks",
  "conversions",
  "cpc",
  "cpm",
  "ctr",
  "reach",
  "cost_per_conversion",
  "conversion_rate",
];

const CAMPAIGN_DIMENSIONS = ["date", "campaign_id", "campaign", "channel", "campaign_status"];
const ADSET_DIMENSIONS = ["date", "campaign_id", "campaign", "channel", "campaign_status"];
const AD_DIMENSIONS = ["date", "campaign_id", "campaign", "channel", "campaign_status"];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function toolNames(tools: { name: string }[]) {
  return new Set(tools.map((tool) => tool.name));
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

  constructor(client = new FlyweelMcpClient()) {
    this.client = client;
  }

  configured() {
    return this.client.configured();
  }

  lastDebug() {
    return this.lastQuerySnippet || this.client.lastRawSnippet;
  }

  private lastQuerySnippet = "";

  async setupSummary() {
    const payload = await this.callRead(["get_setup_status"]);
    return { payload, ...summarizeFlyweelSetup(payload) };
  }

  private async ensureTools() {
    if (this.tools) {
      return this.tools;
    }
    const listed = await this.client.listTools();
    this.tools = toolNames(listed);
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
    if (level === "ad") return AD_DIMENSIONS.slice(0, FLYWEEL_DIMENSION_LIMIT);
    if (level === "adset") return ADSET_DIMENSIONS.slice(0, FLYWEEL_DIMENSION_LIMIT);
    return CAMPAIGN_DIMENSIONS.slice(0, FLYWEEL_DIMENSION_LIMIT);
  }

  private metricsList() {
    return BASELINE_METRICS.slice(0, FLYWEEL_METRIC_LIMIT);
  }

  private queryShapes(
    params: InsightQuery,
    metrics: string[],
    dimensions: string[],
  ): Record<string, unknown>[] {
    const allowed = dimensions.filter((name) => FLYWEEL_ADS_DIMENSIONS.has(name));
    const documented = buildFlyweelAdsQuery({
      startDate: params.startDate,
      endDate: params.endDate,
      metrics,
      dimensions: allowed,
    });
    const query = (documented.queries as Record<string, unknown>[])[0];
    const unfiltered = { ...query };
    delete unfiltered.filters;
    return [
      {
        queries: [
          {
            dataSource: "ads",
            metrics,
            dimensions: ["date", "campaign", "channel"].slice(0, FLYWEEL_DIMENSION_LIMIT),
            dateRange: { preset: "last_7_days" },
            limit: 500,
          },
        ],
      },
      { queries: [unfiltered] },
    ];
  }

  private async queryOnce(
    params: InsightQuery,
    metrics: string[],
    dimensions: string[],
  ): Promise<Record<string, unknown>[]> {
    await this.ensureTools();
    const shapes = this.queryShapes(params, metrics, dimensions);
    let lastError: unknown;
    let best: Record<string, unknown>[] = [];
    for (const shape of shapes) {
      try {
        const payload = await this.callRead(["query_metrics", "queryMetrics"], shape);
        this.lastQuerySnippet = this.client.lastRawSnippet;
        const errorText = payloadLooksLikeError(payload);
        if (errorText) {
          lastError = new Error(errorText);
          continue;
        }
        const rows = unwrapRows(payload);
        if (rows.length > best.length) {
          best = rows;
        }
        if (best.length) {
          return best;
        }
      } catch (error) {
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

  private async queryWithMetricFallback(
    params: InsightQuery,
    dimensions: string[],
  ): Promise<Record<string, unknown>[]> {
    const preferred = this.lastMetrics || this.metricsList();
    try {
      const rows = await this.queryOnce(params, preferred, dimensions);
      this.lastMetrics = preferred;
      return rows;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/metric|unknown|invalid/i.test(message) && preferred !== BASELINE_METRICS) {
        const rows = await this.queryOnce(params, BASELINE_METRICS, dimensions);
        this.lastMetrics = BASELINE_METRICS;
        return rows;
      }
      throw error;
    }
  }

  private async queryWithDimensionFallback(
    params: InsightQuery,
  ): Promise<Record<string, unknown>[]> {
    const wanted = this.dimensionsFor(params.level);
    try {
      return await this.queryWithMetricFallback(params, wanted);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!/dimension|unknown|invalid|not supported/i.test(message)) {
        throw error;
      }
      const fallback =
        params.level === "campaign"
          ? ["date", "campaign_id", "campaign"]
          : wanted.slice(0, 3);
      return this.queryWithMetricFallback(params, fallback);
    }
  }

  async getInsights(params: InsightQuery): Promise<MetaInsightResult> {
    const accountId = params.accountId.replace(/^act_/, "");
    const requestsBefore = this.client.requestCount;
    try {
      const chunked = await queryDateRangeChunked({
        startDate: params.startDate,
        endDate: params.endDate,
        rowLimit: FLYWEEL_ROW_LIMIT,
        query: async (startDate, endDate) =>
          this.queryWithDimensionFallback({ ...params, accountId, startDate, endDate }),
      });
      const normalized = chunked.rows.map((row) =>
        normalizeInsightRow(row, { accountId, provider: this.id }),
      );
      const rows = mergeInsightBatches([normalized]).filter((row) => row.date);
      return {
        rows,
        actions: this.actionsFromRows(rows, params.level),
        truncated: chunked.truncated,
        requests: this.client.requestCount - requestsBefore,
        splits: chunked.splits,
      };
    } catch (error) {
      if (!(error instanceof SilentTruncationError) || params.campaignId) {
        throw error;
      }
      const campaigns = await this.queryWithDimensionFallback({
        ...params,
        startDate: params.startDate,
        endDate: params.startDate,
        level: "campaign",
      });
      const ids = [
        ...new Set(
          campaigns
            .map((row) => normalizeInsightRow(row, { accountId, provider: this.id }).campaignId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const batches = [];
      for (const campaignId of ids) {
        const piece = await queryDateRangeChunked({
          startDate: params.startDate,
          endDate: params.endDate,
          rowLimit: FLYWEEL_ROW_LIMIT,
          query: async (startDate, endDate) =>
            this.queryWithDimensionFallback({
              ...params,
              accountId,
              startDate,
              endDate,
              campaignId,
            }),
        });
        batches.push(
          piece.rows.map((row) => normalizeInsightRow(row, { accountId, provider: this.id })),
        );
      }
      const rows = mergeInsightBatches(batches).filter((row) => row.date);
      return {
        rows,
        actions: this.actionsFromRows(rows, params.level),
        truncated: false,
        requests: this.client.requestCount - requestsBefore,
        splits: ids.length,
      };
    }
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
      const rows = await this.queryWithMetricFallback(params, dimensions);
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
          spend: insight.spend,
          impressions: insight.impressions,
          reach: insight.reach,
          clicks: insight.clicks,
          purchases: insight.purchases,
          purchaseValue: insight.purchaseValue,
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
    while (Date.now() - started < 15_000) {
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
