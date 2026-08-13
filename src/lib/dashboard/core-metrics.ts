import { getPlatformReported } from "@/lib/ads/get-platform-reported";
import {
  getAlignedPeriod,
  shopifyMetricsSince,
} from "@/lib/dashboard/aligned-period";
import {
  blendedCpa,
  merRatio,
  netAfterFees,
  netProfit,
  percentChange,
  ratio,
  shopifyStapeMismatch,
  unknownFirstTouch,
} from "@/lib/dashboard/kpis";
import { getAverageOrderValue, getConversionRate } from "@/lib/dashboard/conversion";
import { pacificDaysInRange, pacificYmd, previousDashboardPeriod } from "@/lib/period";
import { rollupFirstTouch } from "@/lib/shopify/first-touch";
import {
  getShopifyOverviewForPeriod,
  getShopifyOverviewMetrics,
} from "@/lib/shopify/get-overview-metrics";
import {
  getStapeFunnelMetrics,
  getStapeFunnelMetricsForPeriod,
} from "@/lib/stape/get-funnel-metrics";

export async function getCoreDashboard() {
  const period = await getAlignedPeriod();
  const previous = previousDashboardPeriod(period);
  const [shopify, previousShopify, funnel, previousFunnel, ads] =
    await Promise.all([
      getShopifyOverviewMetrics(),
      getShopifyOverviewForPeriod(previous),
      getStapeFunnelMetrics(),
      getStapeFunnelMetricsForPeriod(previous),
      getPlatformReported(period),
    ]);

  const alignedShopify = shopifyMetricsSince(
    shopify.orderPoints,
    period.startMs,
    period.endMs,
  );
  const previousAligned = shopifyMetricsSince(
    previousShopify.orderPoints,
    previous.startMs,
    previous.endMs,
  );
  const inRange = shopify.orderPoints.filter((order) => {
    const created = new Date(order.createdAt).getTime();
    return created >= period.startMs && created < period.endMs;
  });
  const shopifyConnected = shopify.status.state === "connected";
  const stapeConnected = funnel.status.state === "connected";
  const currency = shopify.revenue?.currencyCode || "USD";
  const conversion = getConversionRate(
    shopifyConnected ? alignedShopify.orders : null,
    stapeConnected ? funnel.sessions : null,
  );
  const previousConversion = getConversionRate(
    previousShopify.status.state === "connected" ? previousAligned.orders : null,
    previousFunnel.status.state === "connected" ? previousFunnel.sessions : null,
  );
  const aov = getAverageOrderValue(
    shopifyConnected ? alignedShopify.revenue : null,
    shopifyConnected ? alignedShopify.orders : null,
  );
  const previousAov = getAverageOrderValue(
    previousShopify.status.state === "connected" ? previousAligned.revenue : null,
    previousShopify.status.state === "connected" ? previousAligned.orders : null,
  );
  const totalSpend = ads.totalSpend;
  const unknown = unknownFirstTouch(inRange);
  const mismatch = shopifyStapeMismatch({
    shopifyConnected,
    stapeConnected,
    shopifyOrders: alignedShopify.orders,
    shopifyRevenue: alignedShopify.revenue,
    stapePurchases: funnel.purchases,
    stapeRevenue: funnel.purchaseRevenue,
  });
  const days = pacificDaysInRange(period.startDate, period.endDate);
  const sessionsByDay = new Map(funnel.daily.map((point) => [point.date, point.sessions]));
  const pageviewsByDay = new Map(
    funnel.daily.map((point) => [point.date, point.pageviews]),
  );
  const ordersByDay = new Map<string, number>();
  for (const order of inRange) {
    const day = pacificYmd(order.createdAt);
    ordersByDay.set(day, (ordersByDay.get(day) ?? 0) + 1);
  }
  const dailySessions = days.map((day) => sessionsByDay.get(day) ?? 0);
  const dailyPageviews = days.map((day) => pageviewsByDay.get(day) ?? 0);
  const dailyOrders = days.map((day) => ordersByDay.get(day) ?? 0);
  const feesAfter = netAfterFees(
    alignedShopify.revenue,
    alignedShopify.processingFees,
    alignedShopify.refundFees,
  );
  const profit = netProfit(
    alignedShopify.revenue,
    alignedShopify.processingFees,
    alignedShopify.refundFees,
    totalSpend,
  );
  const mer = merRatio(totalSpend, alignedShopify.revenue);
  const blendedRoas = ratio(alignedShopify.revenue, totalSpend);
  const cpa = blendedCpa(totalSpend, alignedShopify.paidOrders);
  const ncRoas = ratio(alignedShopify.newCustomerRevenue, totalSpend);
  const byChannel = rollupFirstTouch(inRange, "channel");
  const byCampaign = rollupFirstTouch(inRange, "campaign");
  const deltaLabel = `vs ${previous.displayRange}`;

  return {
    period,
    previous,
    deltaLabel,
    shopify,
    previousShopify,
    funnel,
    previousFunnel,
    ads,
    alignedShopify,
    previousAligned,
    inRange,
    shopifyConnected,
    stapeConnected,
    currency,
    conversion,
    previousConversion,
    aov,
    previousAov,
    totalSpend,
    unknown,
    mismatch,
    days,
    dailySessions,
    dailyPageviews,
    dailyOrders,
    feesAfter,
    profit,
    mer,
    blendedRoas,
    cpa,
    ncRoas,
    byChannel,
    byCampaign,
    deltas: {
      sessions: percentChange(
        stapeConnected ? funnel.sessions : null,
        previousFunnel.status.state === "connected" ? previousFunnel.sessions : null,
      ),
      users: percentChange(
        stapeConnected ? funnel.users : null,
        previousFunnel.status.state === "connected" ? previousFunnel.users : null,
      ),
      pageviews: percentChange(
        stapeConnected ? funnel.pageviews : null,
        previousFunnel.status.state === "connected" ? previousFunnel.pageviews : null,
      ),
      orders: percentChange(
        shopifyConnected ? alignedShopify.orders : null,
        previousShopify.status.state === "connected" ? previousAligned.orders : null,
      ),
      revenue: percentChange(
        shopifyConnected ? alignedShopify.revenue : null,
        previousShopify.status.state === "connected" ? previousAligned.revenue : null,
      ),
      aov: percentChange(aov, previousAov),
      conversion: percentChange(conversion.rate, previousConversion.rate),
      newCustomerOrders: percentChange(
        shopifyConnected ? alignedShopify.newCustomerOrders : null,
        previousShopify.status.state === "connected"
          ? previousAligned.newCustomerOrders
          : null,
      ),
      newCustomerRevenue: percentChange(
        shopifyConnected ? alignedShopify.newCustomerRevenue : null,
        previousShopify.status.state === "connected"
          ? previousAligned.newCustomerRevenue
          : null,
      ),
    },
  };
}
