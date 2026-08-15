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

export type MetaInsightRow = {
  date: string;
  accountId: string;
  campaignId?: string;
  campaignName?: string;
  adsetId?: string;
  adsetName?: string;
  adId?: string;
  adName?: string;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  clicks: number;
  linkClicks: number;
  landingPageViews: number;
  ctr: number;
  cpc: number;
  cpm: number;
  purchases: number;
  purchaseValue: number;
  costPerPurchase: number;
  roas: number;
  addToCart: number;
  initiateCheckout: number;
  videoViews?: number;
  videoP25?: number;
  videoP50?: number;
  videoP75?: number;
  videoP100?: number;
  provider: string;
  raw: Record<string, unknown>;
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
