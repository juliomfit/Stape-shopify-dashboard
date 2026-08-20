import { graphPaginate } from "@/lib/ads/graph";
import {
  addToCartCount,
  checkoutCount,
  flattenActions,
  landingPageViews,
  num,
  purchaseCount,
  purchaseValue,
  type MetaAction,
} from "@/lib/ads/meta-actions-parse";
import { getMetaCredentials } from "@/lib/ads/meta-credentials";
import type {
  InsightQuery,
  MetaAccount,
  MetaAd,
  MetaAdSet,
  MetaAdsProvider,
  MetaCampaign,
  MetaCreative,
  MetaInsightResult,
} from "@/lib/ads/providers/types";

const INSIGHT_FIELDS = [
  "campaign_id",
  "campaign_name",
  "adset_id",
  "adset_name",
  "ad_id",
  "ad_name",
  "spend",
  "impressions",
  "reach",
  "frequency",
  "clicks",
  "inline_link_clicks",
  "unique_clicks",
  "cpc",
  "cpm",
  "ctr",
  "actions",
  "action_values",
  "cost_per_action_type",
].join(",");

type InsightRow = {
  date_start?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  clicks?: string;
  inline_link_clicks?: string;
  unique_clicks?: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  actions?: MetaAction[];
  action_values?: MetaAction[];
};

function actId(id: string) {
  return id.startsWith("act_") ? id : `act_${id}`;
}

export class GraphMetaAdsProvider implements MetaAdsProvider {
  readonly id = "meta_graph";
  readonly label = "Meta Marketing API";

  configured() {
    return Boolean(process.env.META_ACCESS_TOKEN?.trim());
  }

  private async creds() {
    const { credentials } = await getMetaCredentials();
    if (!credentials) {
      throw new Error("Meta Graph credentials are not configured.");
    }
    return credentials;
  }

  async getAccounts(): Promise<MetaAccount[]> {
    const credentials = await this.creds();
    return [
      {
        accountId: credentials.adAccountId.replace(/^act_/, ""),
        accountName: credentials.adAccountId,
        platform: "meta",
        provider: this.id,
      },
    ];
  }

  async getCampaigns(accountId: string): Promise<MetaCampaign[]> {
    const credentials = await this.creds();
    const rows = await graphPaginate<Record<string, unknown>>(
      `/${actId(accountId)}/campaigns`,
      credentials.accessToken,
      {
        fields:
          "id,name,objective,status,effective_status,buying_type,created_time,updated_time,start_time,stop_time,daily_budget,lifetime_budget",
        limit: "200",
      },
    );
    return rows.map((row) => ({
      accountId,
      campaignId: String(row.id),
      campaignName: String(row.name || row.id),
      objective: row.objective ? String(row.objective) : undefined,
      status: row.status ? String(row.status) : undefined,
      effectiveStatus: row.effective_status ? String(row.effective_status) : undefined,
      dailyBudget: row.daily_budget ? Number(row.daily_budget) / 100 : null,
      lifetimeBudget: row.lifetime_budget ? Number(row.lifetime_budget) / 100 : null,
      createdTime: row.created_time ? String(row.created_time) : null,
      updatedTime: row.updated_time ? String(row.updated_time) : null,
      raw: row,
    }));
  }

  async getAdSets(accountId: string): Promise<MetaAdSet[]> {
    const credentials = await this.creds();
    const rows = await graphPaginate<Record<string, unknown>>(
      `/${actId(accountId)}/adsets`,
      credentials.accessToken,
      {
        fields:
          "id,name,campaign_id,status,effective_status,optimization_goal,billing_event,bid_strategy,daily_budget,lifetime_budget,start_time,end_time,created_time,updated_time",
        limit: "200",
      },
    );
    return rows.map((row) => ({
      accountId,
      campaignId: row.campaign_id ? String(row.campaign_id) : undefined,
      adsetId: String(row.id),
      adsetName: String(row.name || row.id),
      status: row.status ? String(row.status) : undefined,
      effectiveStatus: row.effective_status ? String(row.effective_status) : undefined,
      optimizationGoal: row.optimization_goal ? String(row.optimization_goal) : undefined,
      billingEvent: row.billing_event ? String(row.billing_event) : undefined,
      bidStrategy: row.bid_strategy ? String(row.bid_strategy) : undefined,
      dailyBudget: row.daily_budget ? Number(row.daily_budget) / 100 : null,
      lifetimeBudget: row.lifetime_budget ? Number(row.lifetime_budget) / 100 : null,
      startTime: row.start_time ? String(row.start_time) : null,
      endTime: row.end_time ? String(row.end_time) : null,
      raw: row,
    }));
  }

  async getAds(accountId: string): Promise<MetaAd[]> {
    const credentials = await this.creds();
    const rows = await graphPaginate<Record<string, unknown>>(
      `/${actId(accountId)}/ads`,
      credentials.accessToken,
      {
        fields:
          "id,name,campaign_id,adset_id,status,effective_status,creative{id},created_time,updated_time",
        limit: "200",
      },
    );
    return rows.map((row) => {
      const creative = row.creative as { id?: string } | undefined;
      return {
        accountId,
        campaignId: row.campaign_id ? String(row.campaign_id) : undefined,
        adsetId: row.adset_id ? String(row.adset_id) : undefined,
        adId: String(row.id),
        adName: String(row.name || row.id),
        status: row.status ? String(row.status) : undefined,
        effectiveStatus: row.effective_status ? String(row.effective_status) : undefined,
        creativeId: creative?.id || null,
        raw: row,
      };
    });
  }

  async getCreatives(accountId: string): Promise<MetaCreative[]> {
    const credentials = await this.creds();
    const rows = await graphPaginate<Record<string, unknown>>(
      `/${actId(accountId)}/adcreatives`,
      credentials.accessToken,
      {
        fields:
          "id,name,title,body,image_url,thumbnail_url,video_id,object_story_spec,call_to_action_type,link_url",
        limit: "200",
      },
    );
    return rows.map((row) => ({
      accountId,
      creativeId: String(row.id),
      creativeName: row.name ? String(row.name) : undefined,
      headline: row.title ? String(row.title) : undefined,
      body: row.body ? String(row.body) : undefined,
      thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : undefined,
      imageUrl: row.image_url ? String(row.image_url) : undefined,
      videoId: row.video_id ? String(row.video_id) : undefined,
      destinationUrl: row.link_url ? String(row.link_url) : undefined,
      callToAction: row.call_to_action_type ? String(row.call_to_action_type) : undefined,
      raw: row,
    }));
  }

  async getInsights(params: InsightQuery): Promise<MetaInsightResult> {
    const credentials = await this.creds();
    const rows = await graphPaginate<InsightRow>(
      `/${actId(params.accountId)}/insights`,
      credentials.accessToken,
      {
        fields: INSIGHT_FIELDS,
        level: params.level,
        time_increment: "1",
        time_range: JSON.stringify({ since: params.startDate, until: params.endDate }),
        limit: "500",
        ...(params.campaignId ? { filtering: JSON.stringify([{ field: "campaign.id", operator: "EQUAL", value: params.campaignId }]) } : {}),
      },
      60,
    );
    const insights = rows.map((row) => ({
      date: String(row.date_start || ""),
      accountId: params.accountId.replace(/^act_/, ""),
      campaignId: row.campaign_id,
      campaignName: row.campaign_name,
      adsetId: row.adset_id,
      adsetName: row.adset_name,
      adId: row.ad_id,
      adName: row.ad_name,
      spend: num(row.spend),
      impressions: num(row.impressions),
      reach: num(row.reach),
      frequency: num(row.frequency),
      clicks: num(row.clicks),
      linkClicks: num(row.inline_link_clicks),
      uniqueClicks: num(row.unique_clicks),
      uniqueCtr: null,
      outboundClicks: null,
      landingPageViews: landingPageViews(row.actions),
      conversions: null,
      ctr: num(row.ctr),
      cpc: num(row.cpc),
      cpm: num(row.cpm),
      purchases: purchaseCount(row.actions),
      purchaseValue: purchaseValue(row.action_values),
      costPerPurchase: 0,
      costPerLandingPageView: null,
      costPerAddToCart: null,
      costPerCheckout: null,
      roas: 0,
      addToCart: addToCartCount(row.actions),
      initiateCheckout: checkoutCount(row.actions),
      videoViews: null,
      videoP25: null,
      videoP50: null,
      videoP75: null,
      videoP95: null,
      videoP100: null,
      video30s: null,
      videoAvgTime: null,
      postEngagement: null,
      pageEngagement: null,
      postReactions: null,
      messagingConversations: null,
      qualityRanking: null,
      engagementRateRanking: null,
      conversionRateRanking: null,
      extended: {},
      provider: this.id,
      raw: row as unknown as Record<string, unknown>,
    }));
    const actions = rows.flatMap((row) => {
      const date = String(row.date_start || "");
      const base = {
        date,
        accountId: params.accountId.replace(/^act_/, ""),
        campaignId: row.campaign_id,
        adsetId: row.adset_id,
        adId: row.ad_id,
        reportingLevel: params.level,
        provider: this.id,
      };
      return [
        ...flattenActions(row.actions, "count").map((action) => ({
          ...base,
          actionType: action.action_type,
          actionCount: action.action_value,
          actionValue: 0,
        })),
        ...flattenActions(row.action_values, "value").map((action) => ({
          ...base,
          actionType: action.action_type,
          actionCount: 0,
          actionValue: action.action_value,
        })),
      ];
    });
    return {
      rows: insights.filter((row) => row.date),
      actions,
      truncated: false,
      requests: 1,
      splits: 0,
    };
  }
}
