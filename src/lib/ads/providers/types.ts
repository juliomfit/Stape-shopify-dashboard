export type MetaReportingLevel = "campaign" | "adset" | "ad";

export type MetaAccount = {
  accountId: string;
  accountName: string;
  currency?: string;
  timezone?: string;
  platform: "meta";
  provider: string;
  raw?: Record<string, unknown>;
};

export type MetaCampaign = {
  accountId: string;
  campaignId: string;
  campaignName: string;
  objective?: string;
  status?: string;
  effectiveStatus?: string;
  dailyBudget?: number | null;
  lifetimeBudget?: number | null;
  createdTime?: string | null;
  updatedTime?: string | null;
  raw?: Record<string, unknown>;
};

export type MetaAdSet = {
  accountId: string;
  campaignId?: string;
  adsetId: string;
  adsetName: string;
  status?: string;
  effectiveStatus?: string;
  optimizationGoal?: string;
  billingEvent?: string;
  bidStrategy?: string;
  dailyBudget?: number | null;
  lifetimeBudget?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  raw?: Record<string, unknown>;
};

export type MetaAd = {
  accountId: string;
  campaignId?: string;
  adsetId?: string;
  adId: string;
  adName: string;
  status?: string;
  effectiveStatus?: string;
  creativeId?: string | null;
  raw?: Record<string, unknown>;
};

export type MetaCreative = {
  accountId?: string;
  creativeId: string;
  creativeName?: string;
  headline?: string;
  body?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  videoId?: string;
  destinationUrl?: string;
  callToAction?: string;
  raw?: Record<string, unknown>;
};

export type MetaMetricScalar = number | string | null;

export type MetaInsightRow = {
  date: string;
  accountId: string;
  campaignId?: string;
  campaignName?: string;
  adsetId?: string;
  adsetName?: string;
  adId?: string;
  adName?: string;
  spend: number | null;
  impressions: number | null;
  reach: number | null;
  frequency: number | null;
  clicks: number | null;
  linkClicks: number | null;
  uniqueClicks: number | null;
  uniqueCtr: number | null;
  outboundClicks: number | null;
  landingPageViews: number | null;
  conversions: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  purchases: number | null;
  purchaseValue: number | null;
  costPerPurchase: number | null;
  costPerLandingPageView: number | null;
  costPerAddToCart: number | null;
  costPerCheckout: number | null;
  roas: number | null;
  addToCart: number | null;
  initiateCheckout: number | null;
  videoViews: number | null;
  videoP25: number | null;
  videoP50: number | null;
  videoP75: number | null;
  videoP95: number | null;
  videoP100: number | null;
  video30s: number | null;
  videoAvgTime: number | null;
  postEngagement: number | null;
  pageEngagement: number | null;
  postReactions: number | null;
  messagingConversations: number | null;
  qualityRanking: string | null;
  engagementRateRanking: string | null;
  conversionRateRanking: string | null;
  /** Additional Flyweel Meta metrics not modeled as first-class fields. */
  extended: Record<string, MetaMetricScalar>;
  provider: string;
  raw: Record<string, unknown>;
};

export type FlyweelMetricQueryHealth = {
  flyweel_candidate_metric_count: number;
  flyweel_metric_catalog_count: number;
  flyweel_metrics_requested: string[];
  flyweel_metrics_requested_count: number;
  flyweel_metric_batches: number;
  flyweel_metrics_returned: string[];
  flyweel_unknown_metrics: string[];
  campaign_rows: number;
  coverage: "full" | "partial" | "baseline" | "unavailable";
  flyweel_ecommerce_support: Record<string, "SUPPORTED" | "UNSUPPORTED">;
};

export type MetaActionRow = {
  date: string;
  accountId: string;
  campaignId?: string;
  adsetId?: string;
  adId?: string;
  reportingLevel: MetaReportingLevel;
  actionType: string;
  actionCount: number;
  actionValue: number;
  provider: string;
  metadata?: Record<string, unknown>;
};

export type MetaBreakdownRow = {
  date: string;
  accountId: string;
  campaignId?: string;
  adsetId?: string;
  adId?: string;
  reportingLevel: MetaReportingLevel;
  breakdownType: string;
  breakdownValue: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  purchases: number;
  purchaseValue: number;
  provider: string;
  raw: Record<string, unknown>;
};

export type MetaInsightResult = {
  rows: MetaInsightRow[];
  actions: MetaActionRow[];
  truncated: boolean;
  requests: number;
  splits: number;
  metricHealth?: FlyweelMetricQueryHealth;
};

export type ProviderSyncResult = {
  ok: boolean;
  jobId?: string;
  status?: string;
  message: string;
  requests: number;
};

export type InsightQuery = {
  accountId: string;
  startDate: string;
  endDate: string;
  level: MetaReportingLevel;
  campaignId?: string;
  adsetId?: string;
};

export interface MetaAdsProvider {
  readonly id: string;
  readonly label: string;
  configured(): boolean;
  getAccounts(): Promise<MetaAccount[]>;
  getCampaigns(accountId: string): Promise<MetaCampaign[]>;
  getAdSets(accountId: string): Promise<MetaAdSet[]>;
  getAds(accountId: string): Promise<MetaAd[]>;
  getCreatives(accountId: string): Promise<MetaCreative[]>;
  getInsights(params: InsightQuery): Promise<MetaInsightResult>;
  getBreakdowns?(params: InsightQuery & { dimensions: string[] }): Promise<MetaBreakdownRow[]>;
  sync?(params: { startDate?: string; endDate?: string }): Promise<ProviderSyncResult>;
}
