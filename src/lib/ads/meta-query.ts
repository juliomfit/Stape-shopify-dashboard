import { readDurableJson } from "@/lib/durable-json";
import { getMetaCredentials } from "@/lib/ads/meta-credentials";
import { isPlatformBqReady, runPlatformQuery } from "@/lib/platform/bq";
import { platformTable } from "@/lib/platform/config";
import { cpc, cpm, ctr, platformCpa, platformRoas } from "@/lib/metrics/formulas";
import type { DashboardPeriod } from "@/lib/period";

export type MetaInsightFact = {
  date: string;
  account_id: string;
  campaign_id: string;
  campaign_name: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  clicks: number;
  inline_link_clicks: number;
  purchases: number;
  purchase_value: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
};

type CacheFile = {
  accountId?: string;
  syncedAt?: string;
  campaigns?: MetaInsightFact[];
  adsets?: MetaInsightFact[];
  ads?: MetaInsightFact[];
};

function asDate(value: unknown) {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  if (value && typeof value === "object" && "value" in (value as { value?: string })) {
    return String((value as { value: string }).value).slice(0, 10);
  }
  return String(value ?? "").slice(0, 10);
}

function normalizeFacts(rows: MetaInsightFact[]): MetaInsightFact[] {
  return rows.map((row) => ({
    ...row,
    date: asDate(row.date),
    spend: Number(row.spend || 0),
    impressions: Number(row.impressions || 0),
    reach: Number(row.reach || 0),
    frequency: Number(row.frequency || 0),
    clicks: Number(row.clicks || 0),
    inline_link_clicks: Number(row.inline_link_clicks || 0),
    purchases: Number(row.purchases || 0),
    purchase_value: Number(row.purchase_value || 0),
  }));
}

function inRange(date: string, period: DashboardPeriod) {
  return date >= period.startDate && date <= period.endDate;
}

export async function loadMetaCache(): Promise<CacheFile> {
  return (await readDurableJson<CacheFile>("meta-insights-cache")) ?? {};
}

async function queryFacts(
  table: string,
  period: DashboardPeriod,
  extra = "",
  extraParams: Record<string, unknown> = {},
): Promise<MetaInsightFact[]> {
  const fq = platformTable(table);
  if (!fq || !isPlatformBqReady()) {
    return [];
  }
  try {
    const { credentials } = await getMetaCredentials();
    const accountId = credentials?.adAccountId.replace(/^act_/, "") || "";
    const rows = await runPlatformQuery<MetaInsightFact>(
      `SELECT * FROM ${fq}
       WHERE date BETWEEN @startDate AND @endDate
         ${accountId ? "AND account_id = @accountId" : ""}
         ${extra}`,
      {
        startDate: period.startDate,
        endDate: period.endDate,
        accountId,
        ...extraParams,
      },
    );
    return normalizeFacts(rows);
  } catch {
    return [];
  }
}

export async function getCampaignFacts(period: DashboardPeriod) {
  const live = await queryFacts("meta_campaign_insights_daily", period);
  if (live.length > 0) {
    return live;
  }
  const cache = await loadMetaCache();
  return normalizeFacts(
    (cache.campaigns || []).filter((row) => inRange(asDate(row.date), period)),
  );
}

export async function getAdsetFacts(period: DashboardPeriod, campaignId?: string) {
  const extra = campaignId ? "AND campaign_id = @campaignId" : "";
  const live = await queryFacts(
    "meta_adset_insights_daily",
    period,
    extra,
    campaignId ? { campaignId } : {},
  );
  if (live.length > 0) {
    return campaignId
      ? live.filter((row) => row.campaign_id === campaignId)
      : live;
  }
  const cache = await loadMetaCache();
  return normalizeFacts(
    (cache.adsets || []).filter(
      (row) =>
        inRange(asDate(row.date), period) &&
        (!campaignId || row.campaign_id === campaignId),
    ),
  );
}

export async function getAdFacts(
  period: DashboardPeriod,
  filter?: { campaignId?: string; adsetId?: string },
) {
  const live = await queryFacts("meta_ad_insights_daily", period);
  const rows =
    live.length > 0
      ? live
      : (await loadMetaCache()).ads || [];
  return normalizeFacts(rows).filter((row) => {
    if (!inRange(row.date, period)) return false;
    if (filter?.campaignId && row.campaign_id !== filter.campaignId) return false;
    if (filter?.adsetId && row.adset_id !== filter.adsetId) return false;
    return true;
  });
}

export type EntityRollup = {
  id: string;
  name: string;
  campaignId?: string;
  adsetId?: string;
  spend: number;
  purchases: number;
  purchaseValue: number;
  impressions: number;
  reach: number;
  clicks: number;
  frequency: number;
  roas: number | null;
  cpa: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
};

function rollup(
  rows: MetaInsightFact[],
  key: (row: MetaInsightFact) => string,
  name: (row: MetaInsightFact) => string,
): EntityRollup[] {
  const map = new Map<string, MetaInsightFact[]>();
  for (const row of rows) {
    const id = key(row);
    if (!id) continue;
    const list = map.get(id) || [];
    list.push(row);
    map.set(id, list);
  }
  return [...map.entries()].map(([id, list]) => {
    const spend = list.reduce((sum, row) => sum + Number(row.spend || 0), 0);
    const purchases = list.reduce((sum, row) => sum + Number(row.purchases || 0), 0);
    const purchaseValue = list.reduce(
      (sum, row) => sum + Number(row.purchase_value || 0),
      0,
    );
    const impressions = list.reduce(
      (sum, row) => sum + Number(row.impressions || 0),
      0,
    );
    const clicks = list.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
    const reach = list.reduce((sum, row) => sum + Number(row.reach || 0), 0);
    const first = list[0];
    return {
      id,
      name: name(first),
      campaignId: first.campaign_id,
      adsetId: first.adset_id,
      spend,
      purchases,
      purchaseValue,
      impressions,
      reach,
      clicks,
      frequency: impressions > 0 ? reach / impressions : 0,
      roas: platformRoas(purchaseValue, spend),
      cpa: platformCpa(spend, purchases),
      ctr: ctr(clicks, impressions),
      cpc: cpc(spend, clicks),
      cpm: cpm(spend, impressions),
    };
  });
}

export function rollupCampaigns(rows: MetaInsightFact[]) {
  return rollup(
    rows,
    (row) => String(row.campaign_id || ""),
    (row) => String(row.campaign_name || row.campaign_id),
  ).sort((a, b) => b.spend - a.spend);
}

export function rollupAdsets(rows: MetaInsightFact[]) {
  return rollup(
    rows,
    (row) => String(row.adset_id || ""),
    (row) => String(row.adset_name || row.adset_id),
  ).sort((a, b) => b.spend - a.spend);
}

export function rollupAds(rows: MetaInsightFact[]) {
  return rollup(
    rows,
    (row) => String(row.ad_id || ""),
    (row) => String(row.ad_name || row.ad_id),
  ).sort((a, b) => b.spend - a.spend);
}

export function totalsFromFacts(rows: MetaInsightFact[]) {
  const spend = rows.reduce((sum, row) => sum + Number(row.spend || 0), 0);
  const purchases = rows.reduce((sum, row) => sum + Number(row.purchases || 0), 0);
  const purchaseValue = rows.reduce(
    (sum, row) => sum + Number(row.purchase_value || 0),
    0,
  );
  const impressions = rows.reduce(
    (sum, row) => sum + Number(row.impressions || 0),
    0,
  );
  const clicks = rows.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
  const reach = rows.reduce((sum, row) => sum + Number(row.reach || 0), 0);
  return {
    spend,
    purchases,
    purchaseValue,
    impressions,
    clicks,
    reach,
    frequency: impressions > 0 ? reach / impressions : 0,
    roas: platformRoas(purchaseValue, spend || null),
    cpa: platformCpa(spend || null, purchases),
    ctr: ctr(clicks, impressions),
    cpc: cpc(spend || null, clicks),
    cpm: cpm(spend || null, impressions),
  };
}

export function dailySeries(rows: MetaInsightFact[], days: string[], field: keyof MetaInsightFact) {
  const byDay = new Map<string, number>();
  for (const row of rows) {
    const date = String(row.date);
    byDay.set(date, (byDay.get(date) || 0) + Number(row[field] || 0));
  }
  return days.map((day) => byDay.get(day) ?? 0);
}
