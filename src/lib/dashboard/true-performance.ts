import { getPlatformReported } from "@/lib/ads/get-platform-reported";
import {
  getMetaConnectionPublic,
  type MetaConnectionPublic,
} from "@/lib/ads/meta-credentials";
import {
  getMetaPaste,
  getGooglePaste,
  listSpendCoverage,
  type PeriodSpendPaste,
  type SpendCoverageRow,
} from "@/lib/ads/spend-paste";
import type { PlatformReported } from "@/lib/ads/types";
import { getAlignedPeriod, shopifyMetricsSince } from "@/lib/dashboard/aligned-period";
import { blendedCpa, merRatio, ratio } from "@/lib/dashboard/kpis";
import { getAttributionMetrics } from "@/lib/stape/get-attribution-metrics";
import { getStapeFunnelMetrics } from "@/lib/stape/get-funnel-metrics";
import {
  buildAttributionRollups,
  findRollup,
  sourceMediumSpendNote,
  type FirstTouchRollup,
} from "@/lib/shopify/first-touch";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";

export type PlatformCompareRow = {
  channel: string;
  platformPurchases: number | null;
  platformRevenue: number | null;
  platformSpend: number | null;
  realPurchases: number;
  realRevenue: number;
  purchaseGap: number | null;
};

export type CampaignSpendCompare = {
  campaign: string;
  spend: number;
  shopifyRevenue: number;
  shopifyOrders: number;
  roas: number | null;
};

export type TruePerformance = {
  shopify: Awaited<ReturnType<typeof getShopifyOverviewMetrics>>;
  funnel: Awaited<ReturnType<typeof getStapeFunnelMetrics>>;
  attribution: Awaited<ReturnType<typeof getAttributionMetrics>>;
  period: Awaited<ReturnType<typeof getAlignedPeriod>>;
  alignedShopify: ReturnType<typeof shopifyMetricsSince>;
  platform: PlatformReported;
  totalSpend: number | null;
  mer: number | null;
  blendedCpa: number | null;
  newCustomerRoas: number | null;
  blendedRoas: number | null;
  facebookRoas: number | null;
  googleRoas: number | null;
  facebookNewCustomerRoas: number | null;
  googleNewCustomerRoas: number | null;
  compare: PlatformCompareRow[];
  shopifyFirstTouch: FirstTouchRollup[];
  shopifySourceMedium: FirstTouchRollup[];
  shopifyCampaigns: FirstTouchRollup[];
  sourceMediumSpendNote: string | null;
  campaignSpendCompare: CampaignSpendCompare[] | null;
  spendCoverage: SpendCoverageRow[];
  metaConnection: MetaConnectionPublic;
  metaPaste: PeriodSpendPaste | null;
  googlePaste: PeriodSpendPaste | null;
};

function compareRow(
  channel: string,
  real: FirstTouchRollup | null,
  purchases: number | null,
  revenue: number | null,
  spend: number | null,
): PlatformCompareRow {
  const realPurchases = real?.orders ?? 0;
  const realRevenue = real?.revenue ?? 0;

  return {
    channel,
    platformPurchases: purchases,
    platformRevenue: revenue,
    platformSpend: spend,
    realPurchases,
    realRevenue,
    purchaseGap: purchases === null ? null : purchases - realPurchases,
  };
}

function campaignSpendByLabel(paste: PeriodSpendPaste | null) {
  const map: Record<string, number | null> = {};
  for (const row of paste?.campaigns || []) {
    map[row.campaign] = row.spend;
  }
  return map;
}

export async function getTruePerformance(): Promise<TruePerformance> {
  const period = await getAlignedPeriod();
  const [
    shopify,
    funnel,
    attribution,
    platform,
    metaConnection,
    metaPaste,
    googlePaste,
    spendCoverage,
  ] = await Promise.all([
    getShopifyOverviewMetrics(),
    getStapeFunnelMetrics(),
    getAttributionMetrics(),
    getPlatformReported(period),
    getMetaConnectionPublic(),
    getMetaPaste(period),
    getGooglePaste(period),
    listSpendCoverage(),
  ]);

  const alignedShopify = shopifyMetricsSince(
    shopify.orderPoints,
    period.startMs,
    period.endMs,
  );
  const inRange = shopify.orderPoints.filter((order) => {
    const created = new Date(order.createdAt).getTime();
    return created >= period.startMs && created < period.endMs;
  });
  const spendByLabel = {
    "Facebook / Meta Ads": platform.facebook.spend,
    "Google Ads": platform.google.spend,
  };
  const campaignSpend = {
    ...campaignSpendByLabel(googlePaste),
    ...campaignSpendByLabel(metaPaste),
  };
  const { byChannel, bySourceMedium, byCampaign } = buildAttributionRollups(
    inRange,
    spendByLabel,
    campaignSpend,
  );
  const shopifyFirstTouch = byChannel;
  const shopifySourceMedium = bySourceMedium;
  const shopifyCampaigns = byCampaign;
  const sourceMediumSpendNoteText = sourceMediumSpendNote(
    shopifySourceMedium,
    platform.facebook.spend,
    platform.google.spend,
  );
  const facebook = findRollup(shopifyFirstTouch, "Facebook / Meta Ads");
  const google = findRollup(shopifyFirstTouch, "Google Ads");
  const totalSpend = platform.totalSpend;
  const campaignRows = [...(metaPaste?.campaigns || [])];
  const campaignSpendCompare: CampaignSpendCompare[] | null =
    campaignRows.length > 0
      ? campaignRows.map((row) => {
          const match = shopifyCampaigns.find(
            (item) => item.label.toLowerCase() === row.campaign.toLowerCase(),
          );
          const shopifyRevenue = match?.revenue ?? 0;
          return {
            campaign: row.campaign,
            spend: row.spend,
            shopifyRevenue,
            shopifyOrders: match?.orders ?? 0,
            roas: row.spend > 0 ? shopifyRevenue / row.spend : null,
          };
        })
      : null;

  return {
    shopify,
    funnel,
    attribution,
    period,
    alignedShopify,
    platform,
    totalSpend,
    mer: merRatio(totalSpend, alignedShopify.revenue),
    blendedCpa: blendedCpa(totalSpend, alignedShopify.paidOrders),
    newCustomerRoas: ratio(alignedShopify.newCustomerRevenue, totalSpend),
    blendedRoas: ratio(alignedShopify.revenue, totalSpend),
    facebookRoas: facebook?.roas ?? null,
    googleRoas: google?.roas ?? null,
    facebookNewCustomerRoas: facebook?.newCustomerRoas ?? null,
    googleNewCustomerRoas: google?.newCustomerRoas ?? null,
    compare: [
      compareRow(
        "Facebook / Meta Ads",
        facebook,
        platform.facebook.purchases,
        platform.facebook.revenue,
        platform.facebook.spend,
      ),
      compareRow(
        "Google Ads",
        google,
        platform.google.purchases,
        platform.google.revenue,
        platform.google.spend,
      ),
    ],
    shopifyFirstTouch,
    shopifySourceMedium,
    shopifyCampaigns,
    sourceMediumSpendNote: sourceMediumSpendNoteText,
    campaignSpendCompare,
    spendCoverage,
    metaConnection,
    metaPaste,
    googlePaste,
  };
}
