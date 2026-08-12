import { getPlatformReported } from "@/lib/ads/get-platform-reported";
import type { PlatformReported } from "@/lib/ads/types";
import { getAlignedPeriod, shopifyMetricsSince } from "@/lib/dashboard/aligned-period";
import { ATTRIBUTION_CHANNELS } from "@/lib/stape/channel-sql";
import { getAttributionMetrics } from "@/lib/stape/get-attribution-metrics";
import { getStapeFunnelMetrics } from "@/lib/stape/get-funnel-metrics";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";
import type { ChannelContribution } from "@/lib/stape/attribution-types";

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
  newCustomerByChannel: ChannelContribution[];
  totalSpend: number | null;
  mer: number | null;
  newCustomerRoas: number | null;
  blendedRoas: number | null;
  compare: PlatformCompareRow[];
  matchedOrders: number;
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

  const shopifyById = new Map(
    shopify.orderPoints
      .filter((order) => order.legacyId)
      .map((order) => [order.legacyId as string, order]),
  );

  let matchedOrders = 0;
  const ncByChannel = new Map<string, { orders: number; revenue: number }>();

  for (const attributed of attribution.orders) {
    const shopifyOrder = shopifyById.get(attributed.transactionId);
    if (!shopifyOrder) {
      continue;
    }

    matchedOrders += 1;
    if (shopifyOrder.isNew !== true) {
      continue;
    }

    const current = ncByChannel.get(attributed.firstNonDirect) ?? {
      orders: 0,
      revenue: 0,
    };
    current.orders += 1;
    current.revenue += shopifyOrder.amount;
    ncByChannel.set(attributed.firstNonDirect, current);
  }

  const newCustomerByChannel: ChannelContribution[] = ATTRIBUTION_CHANNELS.map(
    (source) => ({
      source,
      orders: ncByChannel.get(source)?.orders ?? 0,
      revenue: ncByChannel.get(source)?.revenue ?? 0,
    }),
  );

  const totalSpend = platform.totalSpend ?? marketingSpendFallback();
  const facebookReal = attribution.lastNonDirect.find(
    (row) => row.source === "Facebook / Meta Ads",
  );
  const googleReal = attribution.lastNonDirect.find(
    (row) => row.source === "Google Ads",
  );

  const compare: PlatformCompareRow[] = [
    {
      channel: "Facebook / Meta Ads",
      platformPurchases: platform.facebook.purchases,
      platformRevenue: platform.facebook.revenue,
      platformSpend: platform.facebook.spend,
      realPurchases: facebookReal?.orders ?? 0,
      realRevenue: facebookReal?.revenue ?? 0,
      purchaseGap:
        platform.facebook.purchases === null
          ? null
          : platform.facebook.purchases - (facebookReal?.orders ?? 0),
    },
    {
      channel: "Google Ads",
      platformPurchases: platform.google.purchases,
      platformRevenue: platform.google.revenue,
      platformSpend: platform.google.spend,
      realPurchases: googleReal?.orders ?? 0,
      realRevenue: googleReal?.revenue ?? 0,
      purchaseGap:
        platform.google.purchases === null
          ? null
          : platform.google.purchases - (googleReal?.orders ?? 0),
    },
  ];

  return {
    shopify,
    funnel,
    attribution,
    period,
    alignedShopify,
    platform,
    newCustomerByChannel,
    totalSpend,
    mer: ratio(alignedShopify.revenue, totalSpend),
    newCustomerRoas: ratio(alignedShopify.newCustomerRevenue, totalSpend),
    blendedRoas: ratio(attribution.attributedRevenue, totalSpend),
    compare,
    matchedOrders,
  };
}
