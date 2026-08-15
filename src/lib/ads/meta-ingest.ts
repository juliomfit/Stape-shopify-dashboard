import { writeDurableJson } from "@/lib/durable-json";
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
import {
  isPlatformBqReady,
  replaceAccountEntities,
  replaceDateWindow,
} from "@/lib/platform/bq";
import { acquireSyncLock, releaseSyncLock } from "@/lib/platform/lock";
import { finishSyncRun, startSyncRun, type SyncRun } from "@/lib/platform/sync-runs";
import { getDashboardPeriod, pacificDaysInRange, parseYmd, ymd } from "@/lib/period";

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

export type MetaSyncResult = {
  ok: boolean;
  message: string;
  run: SyncRun | null;
};

function actId(id: string) {
  return id.startsWith("act_") ? id : `act_${id}`;
}

function addDaysYmd(date: string, delta: number) {
  const parts = parseYmd(date);
  if (!parts) {
    return date;
  }
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + delta));
  return ymd(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
  );
}

function lookbackWindow(days: number) {
  const today = getDashboardPeriod("today").startDate;
  return {
    startDate: addDaysYmd(today, -(days - 1)),
    endDate: today,
  };
}

async function fetchInsights(
  accessToken: string,
  adAccountId: string,
  level: "campaign" | "adset" | "ad",
  startDate: string,
  endDate: string,
) {
  return graphPaginate<InsightRow>(
    `/${actId(adAccountId)}/insights`,
    accessToken,
    {
      fields: INSIGHT_FIELDS,
      level,
      time_increment: "1",
      time_range: JSON.stringify({ since: startDate, until: endDate }),
      limit: "500",
    },
    60,
  );
}

function actionRows(
  rows: InsightRow[],
  level: "campaign" | "adset" | "ad",
  accountId: string,
  syncRunId: string,
  now: string,
) {
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    const date = row.date_start;
    if (!date) continue;
    const base = {
      date,
      account_id: accountId,
      campaign_id: row.campaign_id || null,
      adset_id: row.adset_id || null,
      ad_id: row.ad_id || null,
      reporting_level: level,
      synced_at: now,
      sync_run_id: syncRunId,
    };
    for (const action of flattenActions(row.actions, "count")) {
      out.push({ ...base, ...action });
    }
    for (const action of flattenActions(row.action_values, "value")) {
      out.push({ ...base, ...action });
    }
  }
  return out;
}

export async function ingestMetaRange(input: {
  startDate: string;
  endDate: string;
  includeEntities?: boolean;
  syncType?: string;
}): Promise<MetaSyncResult> {
  const { credentials } = await getMetaCredentials();
  if (!credentials) {
    return {
      ok: false,
      message: "Connect Meta Ads first (OAuth or saved token).",
      run: null,
    };
  }

  const run = await startSyncRun({
    source: "meta",
    syncType: input.syncType || "insights",
    lookbackStart: input.startDate,
    lookbackEnd: input.endDate,
  });
  const locked = await acquireSyncLock("meta", run.id);
  if (!locked) {
    await finishSyncRun(run, {
      status: "failed",
      error_message: "Another Meta sync is already running.",
    });
    return { ok: false, message: "Another Meta sync is already running.", run };
  }

  let inserted = 0;
  let failed = 0;
  const steps: string[] = [];
  const now = new Date().toISOString();
  const accountId = credentials.adAccountId.replace(/^act_/, "");

  try {
    if (input.includeEntities !== false) {
      const campaigns = await graphPaginate<Record<string, unknown>>(
        `/${actId(accountId)}/campaigns`,
        credentials.accessToken,
        {
          fields:
            "id,name,objective,status,effective_status,buying_type,created_time,updated_time,start_time,stop_time,daily_budget,lifetime_budget",
          limit: "200",
        },
      );
      const adsets = await graphPaginate<Record<string, unknown>>(
        `/${actId(accountId)}/adsets`,
        credentials.accessToken,
        {
          fields:
            "id,name,campaign_id,status,effective_status,optimization_goal,billing_event,bid_strategy,daily_budget,lifetime_budget,attribution_spec,promoted_object,start_time,end_time,created_time,updated_time",
          limit: "200",
        },
      );
      const ads = await graphPaginate<Record<string, unknown>>(
        `/${actId(accountId)}/ads`,
        credentials.accessToken,
        {
          fields:
            "id,name,campaign_id,adset_id,status,effective_status,creative{id},created_time,updated_time",
          limit: "200",
        },
      );
      const creatives = await graphPaginate<Record<string, unknown>>(
        `/${actId(accountId)}/adcreatives`,
        credentials.accessToken,
        {
          fields:
            "id,name,title,body,image_url,thumbnail_url,video_id,object_story_spec,call_to_action_type,link_url",
          limit: "200",
        },
      );
      steps.push("Campaigns", "Ad sets", "Ads", "Creatives");
      inserted += campaigns.length + adsets.length + ads.length + creatives.length;

      if (isPlatformBqReady()) {
        await replaceAccountEntities({
          table: "meta_campaigns",
          accountId,
          rows: campaigns.map((row) => ({
            account_id: accountId,
            campaign_id: String(row.id),
            campaign_name: row.name,
            objective: row.objective,
            status: row.status,
            effective_status: row.effective_status,
            buying_type: row.buying_type,
            created_time: row.created_time,
            updated_time: row.updated_time,
            start_time: row.start_time,
            stop_time: row.stop_time,
            daily_budget: row.daily_budget ? Number(row.daily_budget) / 100 : null,
            lifetime_budget: row.lifetime_budget ? Number(row.lifetime_budget) / 100 : null,
            source_payload: JSON.stringify(row),
            first_seen_at: now,
            last_seen_at: now,
          })),
        });
        await replaceAccountEntities({
          table: "meta_adsets",
          accountId,
          rows: adsets.map((row) => ({
            account_id: accountId,
            campaign_id: row.campaign_id,
            adset_id: String(row.id),
            adset_name: row.name,
            status: row.status,
            effective_status: row.effective_status,
            optimization_goal: row.optimization_goal,
            billing_event: row.billing_event,
            bid_strategy: row.bid_strategy,
            daily_budget: row.daily_budget ? Number(row.daily_budget) / 100 : null,
            lifetime_budget: row.lifetime_budget ? Number(row.lifetime_budget) / 100 : null,
            attribution_spec: row.attribution_spec
              ? JSON.stringify(row.attribution_spec)
              : null,
            promoted_object: row.promoted_object
              ? JSON.stringify(row.promoted_object)
              : null,
            start_time: row.start_time,
            end_time: row.end_time,
            created_time: row.created_time,
            updated_time: row.updated_time,
            first_seen_at: now,
            last_seen_at: now,
          })),
        });
        await replaceAccountEntities({
          table: "meta_ads",
          accountId,
          rows: ads.map((row) => {
            const creative = row.creative as { id?: string } | undefined;
            return {
              account_id: accountId,
              campaign_id: row.campaign_id,
              adset_id: row.adset_id,
              ad_id: String(row.id),
              ad_name: row.name,
              status: row.status,
              effective_status: row.effective_status,
              creative_id: creative?.id || null,
              created_time: row.created_time,
              updated_time: row.updated_time,
              first_seen_at: now,
              last_seen_at: now,
            };
          }),
        });
        await replaceAccountEntities({
          table: "meta_creatives",
          accountId,
          rows: creatives.map((row) => ({
            account_id: accountId,
            creative_id: String(row.id),
            name: row.name,
            title: row.title,
            body: row.body,
            image_url: row.image_url,
            thumbnail_url: row.thumbnail_url,
            video_id: row.video_id,
            object_story: row.object_story_spec
              ? JSON.stringify(row.object_story_spec)
              : null,
            destination_url: row.link_url,
            call_to_action: row.call_to_action_type,
            source_payload: JSON.stringify(row),
            first_seen_at: now,
            last_seen_at: now,
          })),
        });
      }
    }

    const campaignRows = await fetchInsights(
      credentials.accessToken,
      accountId,
      "campaign",
      input.startDate,
      input.endDate,
    );
    const adsetRows = await fetchInsights(
      credentials.accessToken,
      accountId,
      "adset",
      input.startDate,
      input.endDate,
    );
    const adRows = await fetchInsights(
      credentials.accessToken,
      accountId,
      "ad",
      input.startDate,
      input.endDate,
    );
    steps.push("Campaign insights", "Ad set insights", "Ad insights");

    const campaignFacts = campaignRows.map((row) => ({
      date: row.date_start,
      account_id: accountId,
      campaign_id: row.campaign_id,
      campaign_name: row.campaign_name,
      spend: num(row.spend),
      impressions: num(row.impressions),
      reach: num(row.reach),
      frequency: num(row.frequency),
      clicks: num(row.clicks),
      inline_link_clicks: num(row.inline_link_clicks),
      unique_clicks: num(row.unique_clicks),
      cpc: num(row.cpc),
      cpm: num(row.cpm),
      ctr: num(row.ctr),
      purchases: purchaseCount(row.actions),
      purchase_value: purchaseValue(row.action_values),
      add_to_cart: addToCartCount(row.actions),
      initiate_checkout: checkoutCount(row.actions),
      landing_page_views: landingPageViews(row.actions),
      actions_json: JSON.stringify(row.actions || []),
      action_values_json: JSON.stringify(row.action_values || []),
      synced_at: now,
      sync_run_id: run.id,
    }));
    const adsetFacts = adsetRows.map((row) => ({
      date: row.date_start,
      account_id: accountId,
      campaign_id: row.campaign_id,
      adset_id: row.adset_id,
      adset_name: row.adset_name,
      spend: num(row.spend),
      impressions: num(row.impressions),
      reach: num(row.reach),
      frequency: num(row.frequency),
      clicks: num(row.clicks),
      inline_link_clicks: num(row.inline_link_clicks),
      purchases: purchaseCount(row.actions),
      purchase_value: purchaseValue(row.action_values),
      actions_json: JSON.stringify(row.actions || []),
      action_values_json: JSON.stringify(row.action_values || []),
      synced_at: now,
      sync_run_id: run.id,
    }));
    const adFacts = adRows.map((row) => ({
      date: row.date_start,
      account_id: accountId,
      campaign_id: row.campaign_id,
      adset_id: row.adset_id,
      ad_id: row.ad_id,
      ad_name: row.ad_name,
      spend: num(row.spend),
      impressions: num(row.impressions),
      reach: num(row.reach),
      frequency: num(row.frequency),
      clicks: num(row.clicks),
      inline_link_clicks: num(row.inline_link_clicks),
      purchases: purchaseCount(row.actions),
      purchase_value: purchaseValue(row.action_values),
      ctr: num(row.ctr),
      cpc: num(row.cpc),
      cpm: num(row.cpm),
      actions_json: JSON.stringify(row.actions || []),
      action_values_json: JSON.stringify(row.action_values || []),
      synced_at: now,
      sync_run_id: run.id,
    }));

    await writeDurableJson("meta-insights-cache", {
      accountId,
      startDate: input.startDate,
      endDate: input.endDate,
      syncedAt: now,
      campaigns: campaignFacts,
      adsets: adsetFacts,
      ads: adFacts,
    });

    inserted += campaignFacts.length + adsetFacts.length + adFacts.length;

    if (isPlatformBqReady()) {
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
      const actions = [
        ...actionRows(campaignRows, "campaign", accountId, run.id, now),
        ...actionRows(adsetRows, "adset", accountId, run.id, now),
        ...actionRows(adRows, "ad", accountId, run.id, now),
      ];
      await replaceDateWindow({
        table: "meta_actions_daily",
        accountId,
        startDate: input.startDate,
        endDate: input.endDate,
        rows: actions,
      });
      inserted += actions.length;
    }

    const finished = await finishSyncRun(run, {
      status: isPlatformBqReady() ? "completed" : "partial",
      records_requested: inserted,
      records_inserted: inserted,
      records_failed: failed,
      error_message: isPlatformBqReady()
        ? null
        : "Insights cached locally. Run bigquery/platform/00_schema.sql and grant Data Editor to persist in BigQuery.",
      metadata: JSON.stringify({ steps }),
    });
    return {
      ok: true,
      message: `Meta ${input.startDate}–${input.endDate}: ${inserted} rows. ${steps.join(" · ")}`,
      run: finished,
    };
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : "Meta sync failed";
    const finished = await finishSyncRun(run, {
      status: inserted > 0 ? "partial" : "failed",
      records_inserted: inserted,
      records_failed: failed,
      error_message: message,
    });
    return { ok: false, message, run: finished };
  } finally {
    await releaseSyncLock("meta");
  }
}

export async function syncMetaIncremental() {
  const window = lookbackWindow(8);
  return ingestMetaRange({
    ...window,
    includeEntities: true,
    syncType: "incremental",
  });
}

export async function syncMetaBackfill(startDate: string, endDate: string) {
  const days = pacificDaysInRange(startDate, endDate);
  if (days.length === 0) {
    return { ok: false, message: "Invalid date range.", run: null };
  }
  if (days.length > 93) {
    return {
      ok: false,
      message: "Backfill is limited to 93 Pacific days per request.",
      run: null,
    };
  }
  return ingestMetaRange({
    startDate,
    endDate,
    includeEntities: true,
    syncType: "backfill",
  });
}

export async function syncMetaHourly() {
  return syncMetaIncremental();
}
