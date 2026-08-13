import { getPlatformReported } from "@/lib/ads/get-platform-reported";
import type { PlatformReported } from "@/lib/ads/types";
import { getAlignedPeriod, shopifyMetricsSince } from "@/lib/dashboard/aligned-period";
import { getAttributionMetrics } from "@/lib/stape/get-attribution-metrics";
import { getStapeFunnelMetrics } from "@/lib/stape/get-funnel-metrics";
import {
  findRollup,
  rollupFirstTouch,
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

export type TruePerformance = {
  shopify: Awaited<ReturnType<typeof getShopifyOverviewMetrics>>;
  funnel: Awaited<ReturnType<typeof getStapeFunnelMetrics>>;
  attribution: Awaited<ReturnType<typeof getAttributionMetrics>>;
  period: Awaited<ReturnType<typeof getAlignedPeriod>>;
  alignedShopify: ReturnType<typeof shopifyMetricsSince>;
  platform: PlatformReported;
  totalSpend: number | null;
  mer: number | null;
  newCustomerRoas: number | null;
  blendedRoas: number | null;
  facebookRoas: number | null;
  googleRoas: number | null;
  facebookNewCustomerRoas: number | null;
  googleNewCustomerRoas: number | null;
  compare: PlatformCompareRow[];
  shopifyFirstTouch: FirstTouchRollup[];
  shopifyCampaigns: FirstTouchRollup[];
};

function marketingSpendFallback() {
  const raw = process.env.MARKETING_SPEND_USD?.trim();
  if (!raw) {
    return null;
  }

  const amount = Number(raw);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function ratio(numerator: number, spend: number | null) {
  if (spend === null || spend <= 0) {
    return null;
  }

  return numerator / spend;
}

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

export async function getTruePerformance(): Promise<TruePerformance> {
  const period = await getAlignedPeriod();
  const [shopify, funnel, attribution, platform] = await Promise.all([
    getShopifyOverviewMetrics(),
    getStapeFunnelMetrics(),
    getAttributionMetrics(),
    getPlatformReported(period),
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
  const shopifyFirstTouch = rollupFirstTouch(inRange, "channel", spendByLabel);
  const shopifyCampaigns = rollupFirstTouch(inRange, "campaign");
  const facebook = findRollup(shopifyFirstTouch, "Facebook / Meta Ads");
  const google = findRollup(shopifyFirstTouch, "Google Ads");
  const totalSpend = platform.totalSpend ?? marketingSpendFallback();

  return {
    shopify,
    funnel,
    attribution,
    period,
    alignedShopify,
    platform,
    totalSpend,
    mer: ratio(alignedShopify.revenue, totalSpend),
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
    shopifyCampaigns,
  };
}
