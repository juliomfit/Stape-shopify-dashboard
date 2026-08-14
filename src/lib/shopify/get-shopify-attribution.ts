import type { DashboardPeriod } from "@/lib/period";
import { buildAttributionCompare } from "@/lib/shopify/compare";
import {
  attributionSuffix,
  isShopifyAttributionModel,
  runShopifyql,
  shopifyqlDates,
  shopifyqlNumber,
  shopifyqlString,
  shopifyqlTimezone,
  SHOPIFY_ATTRIBUTION_MODELS,
  type ShopifyAttributionModel,
} from "@/lib/shopify/shopifyql";
import { getShopifyOverviewForPeriod } from "@/lib/shopify/get-overview-metrics";

export type ShopifyqlChannelRow = {
  channel: string;
  type: string;
  label: string;
  sales: number;
  orders: number;
  aov: number;
};

export type ShopifyqlReferrerRow = {
  channel: string;
  type: string;
  referrerUrl: string;
  sales: number;
  orders: number;
};

export type ShopifyqlSessionPoint = {
  hour: string;
  channel: string;
  type: string;
  sessions: number;
};

export type ShopifyAttributionPage = {
  model: ShopifyAttributionModel;
  period: DashboardPeriod;
  shopify: Awaited<ReturnType<typeof getShopifyOverviewForPeriod>>;
  compare: ReturnType<typeof buildAttributionCompare>;
  qlError: string | null;
  channelRows: ShopifyqlChannelRow[];
  referrerRows: ShopifyqlReferrerRow[];
  sessionPoints: ShopifyqlSessionPoint[];
  marketingSpend: number | null;
  marketingSpendNote: string;
  usedFirstVisitFallback: boolean;
};

function salesField(model: ShopifyAttributionModel, metric: string) {
  return `${metric}__${attributionSuffix(model)}`;
}

export async function getShopifyAttributionPage(
  period: DashboardPeriod,
  modelRaw: string | undefined,
): Promise<ShopifyAttributionPage> {
  const requested = modelRaw ?? "";
  const model: ShopifyAttributionModel = isShopifyAttributionModel(requested)
    ? requested
    : "first_click";
  const modifier =
    SHOPIFY_ATTRIBUTION_MODELS.find((item) => item.key === model)?.modifier ||
    "FIRST_CLICK_ATTRIBUTION";
  const dates = shopifyqlDates(period);
  const tz = shopifyqlTimezone();
  const salesMetric = salesField(model, "total_sales");
  const ordersMetric = salesField(model, "orders");
  const aovMetric = salesField(model, "average_order_value");

  const shopify = await getShopifyOverviewForPeriod(period);
  const inRange = shopify.orderPoints.filter((order) => {
    const created = new Date(order.createdAt).getTime();
    return created >= period.startMs && created < period.endMs;
  });
  const compare = buildAttributionCompare(inRange);

  const [channels, referrers, sessions, spend] = await Promise.all([
    runShopifyql(`FROM sales
  SHOW total_sales, orders, average_order_value
  GROUP BY referring_channel, traffic_type WITH ${modifier}, ${tz}
  ${dates}
  ORDER BY ${salesMetric} DESC`),
    runShopifyql(`FROM sales
  SHOW total_sales, orders
  GROUP BY referring_channel, traffic_type, referrer_url WITH ${modifier}, ${tz}
  ${dates}
  ORDER BY ${salesMetric} DESC`),
    runShopifyql(`FROM sessions
  SHOW sessions
  TIMESERIES hour WITH ${tz}
  GROUP BY referring_channel, traffic_type
  ${dates}
  ORDER BY hour ASC`),
    runShopifyql(`FROM marketing_engagements
  SHOW ad_spend
  WITH ${tz}
  ${dates}`),
  ]);

  const qlError = [channels.error, referrers.error, sessions.error]
    .filter(Boolean)
    .join(" · ") || null;

  let channelRows: ShopifyqlChannelRow[] = channels.rows.map((row) => {
    const channel = shopifyqlString(row.referring_channel) || "Direct";
    const type = shopifyqlString(row.traffic_type) || "—";
    return {
      channel,
      type,
      label: `${channel} / ${type}`,
      sales: shopifyqlNumber(row[salesMetric] ?? row.total_sales),
      orders: shopifyqlNumber(row[ordersMetric] ?? row.orders),
      aov: shopifyqlNumber(row[aovMetric] ?? row.average_order_value),
    };
  });

  let referrerRows: ShopifyqlReferrerRow[] = referrers.rows.map((row) => {
    const channel = shopifyqlString(row.referring_channel) || "Direct";
    const type = shopifyqlString(row.traffic_type) || "—";
    return {
      channel,
      type,
      referrerUrl: shopifyqlString(row.referrer_url) || "(none)",
      sales: shopifyqlNumber(row[salesMetric] ?? row.total_sales),
      orders: shopifyqlNumber(row[ordersMetric] ?? row.orders),
    };
  });

  const usedFirstVisitFallback = Boolean(channels.error);

  if (channels.error) {
    const byLabel = new Map<string, ShopifyqlChannelRow>();
    for (const order of inRange) {
      const click = order.journey?.ready
        ? order.journey.firstClick
        : { channel: "Not ready", type: "—", label: "Not ready" };
      const current = byLabel.get(click.label) ?? {
        channel: click.channel,
        type: click.type,
        label: click.label,
        sales: 0,
        orders: 0,
        aov: 0,
      };
      current.sales += order.amount;
      current.orders += 1;
      byLabel.set(click.label, current);
    }
    channelRows = [...byLabel.values()]
      .map((row) => ({
        ...row,
        aov: row.orders > 0 ? row.sales / row.orders : 0,
      }))
      .sort((a, b) => b.sales - a.sales);
  }

  if (referrers.error) {
    const byRef = new Map<string, ShopifyqlReferrerRow>();
    for (const order of inRange) {
      if (!order.journey?.ready) {
        continue;
      }
      const click = order.journey.firstClick;
      const referrerUrl = order.journey.firstVisit?.referrerUrl || "(none)";
      const key = `${click.label}::${referrerUrl}`;
      const current = byRef.get(key) ?? {
        channel: click.channel,
        type: click.type,
        referrerUrl,
        sales: 0,
        orders: 0,
      };
      current.sales += order.amount;
      current.orders += 1;
      byRef.set(key, current);
    }
    referrerRows = [...byRef.values()].sort((a, b) => b.sales - a.sales);
  }

  const sessionPoints: ShopifyqlSessionPoint[] = sessions.error
    ? []
    : sessions.rows.map((row) => ({
        hour: shopifyqlString(row.hour),
        channel: shopifyqlString(row.referring_channel) || "Direct",
        type: shopifyqlString(row.traffic_type) || "—",
        sessions: shopifyqlNumber(row.sessions),
      }));

  let marketingSpend: number | null = null;
  let marketingSpendNote =
    "Shopify marketing-app spend is empty until a marketing app reports engagements.";
  if (!spend.error && spend.rows.length > 0) {
    const total = spend.rows.reduce(
      (sum, row) => sum + shopifyqlNumber(row.ad_spend),
      0,
    );
    if (total > 0) {
      marketingSpend = total;
      marketingSpendNote =
        "Shopify marketing-app spend from marketing_engagements. Does not replace paste spend.";
    }
  }

  return {
    model,
    period,
    shopify,
    compare,
    qlError,
    channelRows,
    referrerRows,
    sessionPoints,
    marketingSpend,
    marketingSpendNote,
    usedFirstVisitFallback,
  };
}
