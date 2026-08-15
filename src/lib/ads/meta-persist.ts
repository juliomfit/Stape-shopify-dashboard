import { readDurableJson, writeDurableJson } from "@/lib/durable-json";
import { isPlatformBqReady, replaceAccountEntities, replaceDateWindow, runPlatformQuery } from "@/lib/platform/bq";
import { platformTable } from "@/lib/platform/config";
import type {
  MetaAccount,
  MetaAd,
  MetaAdSet,
  MetaActionRow,
  MetaBreakdownRow,
  MetaCampaign,
  MetaCreative,
  MetaInsightRow,
} from "@/lib/ads/providers/types";

export function insightToCampaignFact(row: MetaInsightRow, syncRunId: string, syncedAt: string) {
  return {
    date: row.date,
    account_id: row.accountId,
    campaign_id: row.campaignId,
    campaign_name: row.campaignName,
    spend: row.spend,
    impressions: row.impressions,
    reach: row.reach,
    frequency: row.frequency,
    clicks: row.clicks,
    inline_link_clicks: row.linkClicks,
    unique_clicks: null,
    cpc: row.cpc,
    cpm: row.cpm,
    ctr: row.ctr,
    purchases: row.purchases,
    purchase_value: row.purchaseValue,
    add_to_cart: row.addToCart,
    initiate_checkout: row.initiateCheckout,
    landing_page_views: row.landingPageViews,
    actions_json: JSON.stringify([]),
    action_values_json: JSON.stringify([]),
    provider: row.provider,
    synced_at: syncedAt,
    sync_run_id: syncRunId,
  };
}

export function insightToAdsetFact(row: MetaInsightRow, syncRunId: string, syncedAt: string) {
  return {
    date: row.date,
    account_id: row.accountId,
    campaign_id: row.campaignId,
    adset_id: row.adsetId,
    adset_name: row.adsetName,
    spend: row.spend,
    impressions: row.impressions,
    reach: row.reach,
    frequency: row.frequency,
    clicks: row.clicks,
    inline_link_clicks: row.linkClicks,
    purchases: row.purchases,
    purchase_value: row.purchaseValue,
    provider: row.provider,
    actions_json: JSON.stringify([]),
    action_values_json: JSON.stringify([]),
    synced_at: syncedAt,
    sync_run_id: syncRunId,
  };
}

export function insightToAdFact(row: MetaInsightRow, syncRunId: string, syncedAt: string) {
  return {
    date: row.date,
    account_id: row.accountId,
    campaign_id: row.campaignId,
    adset_id: row.adsetId,
    ad_id: row.adId,
    ad_name: row.adName,
    spend: row.spend,
    impressions: row.impressions,
    reach: row.reach,
    frequency: row.frequency,
    clicks: row.clicks,
    inline_link_clicks: row.linkClicks,
    purchases: row.purchases,
    purchase_value: row.purchaseValue,
    ctr: row.ctr,
    cpc: row.cpc,
    cpm: row.cpm,
    provider: row.provider,
    actions_json: JSON.stringify([]),
    action_values_json: JSON.stringify([]),
    synced_at: syncedAt,
    sync_run_id: syncRunId,
  };
}

export async function persistMetaWarehouse(input: {
  account: MetaAccount;
  campaigns?: MetaCampaign[];
  adsets?: MetaAdSet[];
  ads?: MetaAd[];
  creatives?: MetaCreative[];
  campaignInsights: MetaInsightRow[];
  adsetInsights: MetaInsightRow[];
  adInsights: MetaInsightRow[];
  actions: MetaActionRow[];
  breakdowns?: MetaBreakdownRow[];
  startDate: string;
  endDate: string;
  syncRunId: string;
  syncedAt: string;
}) {
  const accountId = input.account.accountId.replace(/^act_/, "");
  const campaignFacts = input.campaignInsights.map((row) =>
    insightToCampaignFact(row, input.syncRunId, input.syncedAt),
  );
  const adsetFacts = input.adsetInsights.map((row) =>
    insightToAdsetFact(row, input.syncRunId, input.syncedAt),
  );
  const adFacts = input.adInsights.map((row) =>
    insightToAdFact(row, input.syncRunId, input.syncedAt),
  );

  const prev = (await readDurableJson<{
    campaigns?: Record<string, unknown>[];
    adsets?: Record<string, unknown>[];
    ads?: Record<string, unknown>[];
  }>("meta-insights-cache")) || {};

  function mergeFacts(
    existing: Record<string, unknown>[] | undefined,
    next: Record<string, unknown>[],
    key: (row: Record<string, unknown>) => string,
  ) {
    const map = new Map<string, Record<string, unknown>>();
    for (const row of existing || []) {
      const date = String(row.date || "").slice(0, 10);
      if (date >= input.startDate && date <= input.endDate) {
        continue;
      }
      map.set(key(row), row);
    }
    for (const row of next) {
      map.set(key(row), row);
    }
    return [...map.values()];
  }

  await writeDurableJson("meta-insights-cache", {
    accountId,
    startDate: input.startDate,
    endDate: input.endDate,
    syncedAt: input.syncedAt,
    provider: input.account.provider,
    campaigns: mergeFacts(prev.campaigns, campaignFacts, (row) => `${row.date}|${row.campaign_id}`),
    adsets: mergeFacts(prev.adsets, adsetFacts, (row) => `${row.date}|${row.adset_id}`),
    ads: mergeFacts(prev.ads, adFacts, (row) => `${row.date}|${row.ad_id}`),
  });

  if (!isPlatformBqReady()) {
    return { cached: true, inserted: campaignFacts.length + adsetFacts.length + adFacts.length };
  }

  const accountsTable = platformTable("meta_accounts");
  if (accountsTable) {
    await runPlatformQuery(`
      CREATE TABLE IF NOT EXISTS ${accountsTable} (
        account_id STRING NOT NULL,
        account_name STRING,
        currency STRING,
        timezone STRING,
        platform STRING,
        provider STRING,
        first_seen_at TIMESTAMP,
        last_seen_at TIMESTAMP,
        raw_source STRING
      )
    `);
  }

  await replaceAccountEntities({
    table: "meta_accounts",
    accountId,
    rows: [
      {
        account_id: accountId,
        account_name: input.account.accountName,
        currency: input.account.currency || null,
        timezone: input.account.timezone || null,
        platform: "meta",
        provider: input.account.provider,
        first_seen_at: input.syncedAt,
        last_seen_at: input.syncedAt,
        raw_source: JSON.stringify(input.account.raw || {}),
      },
    ],
  });

  if (input.campaigns) {
    await replaceAccountEntities({
      table: "meta_campaigns",
      accountId,
      rows: input.campaigns.map((row) => ({
        account_id: accountId,
        campaign_id: row.campaignId,
        campaign_name: row.campaignName,
        objective: row.objective || null,
        status: row.status || null,
        effective_status: row.effectiveStatus || null,
        daily_budget: row.dailyBudget ?? null,
        lifetime_budget: row.lifetimeBudget ?? null,
        created_time: row.createdTime || null,
        updated_time: row.updatedTime || null,
        source_payload: JSON.stringify(row.raw || {}),
        first_seen_at: input.syncedAt,
        last_seen_at: input.syncedAt,
        provider: input.account.provider,
      })),
    });
  }
  if (input.adsets) {
    await replaceAccountEntities({
      table: "meta_adsets",
      accountId,
      rows: input.adsets.map((row) => ({
        account_id: accountId,
        campaign_id: row.campaignId || null,
        adset_id: row.adsetId,
        adset_name: row.adsetName,
        status: row.status || null,
        effective_status: row.effectiveStatus || null,
        optimization_goal: row.optimizationGoal || null,
        billing_event: row.billingEvent || null,
        bid_strategy: row.bidStrategy || null,
        daily_budget: row.dailyBudget ?? null,
        lifetime_budget: row.lifetimeBudget ?? null,
        start_time: row.startTime || null,
        end_time: row.endTime || null,
        first_seen_at: input.syncedAt,
        last_seen_at: input.syncedAt,
        provider: input.account.provider,
      })),
    });
  }
  if (input.ads) {
    await replaceAccountEntities({
      table: "meta_ads",
      accountId,
      rows: input.ads.map((row) => ({
        account_id: accountId,
        campaign_id: row.campaignId || null,
        adset_id: row.adsetId || null,
        ad_id: row.adId,
        ad_name: row.adName,
        status: row.status || null,
        effective_status: row.effectiveStatus || null,
        creative_id: row.creativeId || null,
        first_seen_at: input.syncedAt,
        last_seen_at: input.syncedAt,
        provider: input.account.provider,
      })),
    });
  }
  if (input.creatives) {
    await replaceAccountEntities({
      table: "meta_creatives",
      accountId,
      rows: input.creatives.map((row) => ({
        account_id: accountId,
        creative_id: row.creativeId,
        name: row.creativeName || null,
        title: row.headline || null,
        body: row.body || null,
        image_url: row.imageUrl || null,
        thumbnail_url: row.thumbnailUrl || null,
        video_id: row.videoId || null,
        destination_url: row.destinationUrl || null,
        call_to_action: row.callToAction || null,
        source_payload: JSON.stringify(row.raw || {}),
        first_seen_at: input.syncedAt,
        last_seen_at: input.syncedAt,
        provider: input.account.provider,
      })),
    });
  }

  await replaceDateWindow({
    table: "meta_campaign_insights_daily",
    accountId,
    startDate: input.startDate,
    endDate: input.endDate,
    rows: campaignFacts,
  });
  await replaceDateWindow({
    table: "meta_adset_insights_daily",
    accountId,
    startDate: input.startDate,
    endDate: input.endDate,
    rows: adsetFacts,
  });
  await replaceDateWindow({
    table: "meta_ad_insights_daily",
    accountId,
    startDate: input.startDate,
    endDate: input.endDate,
    rows: adFacts,
  });
  await replaceDateWindow({
    table: "meta_actions_daily",
    accountId,
    startDate: input.startDate,
    endDate: input.endDate,
    rows: input.actions.map((row) => ({
      date: row.date,
      account_id: row.accountId,
      campaign_id: row.campaignId || null,
      adset_id: row.adsetId || null,
      ad_id: row.adId || null,
      reporting_level: row.reportingLevel,
      action_kind: row.actionValue ? "value" : "count",
      action_type: row.actionType,
      action_value: row.actionValue || row.actionCount,
      provider: row.provider,
      synced_at: input.syncedAt,
      sync_run_id: input.syncRunId,
      metadata: row.metadata ? JSON.stringify(row.metadata) : null,
    })),
  });
  if (input.breakdowns && input.breakdowns.length > 0) {
    await replaceDateWindow({
      table: "meta_insights_breakdowns_daily",
      accountId,
      startDate: input.startDate,
      endDate: input.endDate,
      rows: input.breakdowns.map((row) => ({
        date: row.date,
        account_id: row.accountId,
        campaign_id: row.campaignId || null,
        adset_id: row.adsetId || null,
        ad_id: row.adId || null,
        reporting_level: row.reportingLevel,
        breakdown_type: row.breakdownType,
        breakdown_value: row.breakdownValue,
        spend: row.spend,
        impressions: row.impressions,
        reach: row.reach,
        clicks: row.clicks,
        purchases: row.purchases,
        purchase_value: row.purchaseValue,
        provider: row.provider,
        synced_at: input.syncedAt,
        sync_run_id: input.syncRunId,
      })),
    });
  }

  return {
    cached: false,
    inserted:
      campaignFacts.length +
      adsetFacts.length +
      adFacts.length +
      input.actions.length +
      (input.breakdowns?.length || 0),
  };
}
