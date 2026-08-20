import type { Metadata } from "next";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { DailyTrendChart } from "@/components/dashboard/DailyTrendChart";
import { DonutChart } from "@/components/dashboard/DonutChart";
import { HorizontalBarList } from "@/components/dashboard/HorizontalBarList";
import { SummaryBoard } from "@/components/dashboard/SummaryBoard";
import type { SummaryMetric } from "@/components/dashboard/MetricTile";
import { Header } from "@/components/layout/Header";
import { getCoreDashboard } from "@/lib/dashboard/core-metrics";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";


export const metadata: Metadata = {
  title: "Summary",
};

export default async function SummaryPage() {
  const data = await getCoreDashboard();
  const {
    shopify,
    funnel,
    alignedShopify,
    shopifyConnected,
    stapeConnected,
    currency,
    conversion,
    aov,
    totalSpend,
    unknown,
    dailySessions,
    dailyPageviews,
    dailyOrders,
    days,
    feesAfter,
    profit,
    profitAfterCogs,
    cogsSource,
    mer,
    blendedRoas,
    cpa,
    ncRoas,
    ads,
    byChannel,
    deltas,
  } = data;

  const money = (amount: number | null | undefined) =>
    amount === null || amount === undefined
      ? null
      : formatMoney({ amount, currencyCode: currency });
  const roas = (value: number | null) =>
    value === null ? null : `${value.toFixed(2)}x`;
  const percent = (value: number | null) =>
    value === null ? null : formatPercent(value);
  const count = (value: number | null | undefined) =>
    value === null || value === undefined ? null : formatNumber(value);

  const newCustomerCac =
    totalSpend !== null && alignedShopify.newCustomerOrders > 0
      ? totalSpend / alignedShopify.newCustomerOrders
      : null;
  const netProfitValue = profitAfterCogs ?? profit;
  const netProfitSource =
    profitAfterCogs !== null
      ? `After fees + supplier COGS · ${cogsSource}`
      : "Revenue − fees − ad spend · no COGS";

  const metrics: SummaryMetric[] = [
    // Blended performance (the numbers operators cite first).
    {
      id: "blended_roas",
      group: "Blended performance",
      label: "Blended ROAS",
      value: roas(blendedRoas),
      delta: null,
      source: "Total revenue ÷ blended ad spend",
      hero: true,
    },
    {
      id: "net_profit",
      group: "Blended performance",
      label: "Net profit",
      value: money(netProfitValue),
      delta: null,
      source: netProfitSource,
      hero: true,
    },
    {
      id: "mer",
      group: "Blended performance",
      label: "MER",
      value: roas(mer),
      delta: null,
      source: "Shopify revenue ÷ blended ad spend",
      hero: true,
    },
    {
      id: "nc_cac",
      group: "Blended performance",
      label: "New-customer CAC",
      value: money(newCustomerCac),
      delta: null,
      source: "Ad spend ÷ new-customer orders",
      hero: true,
      invertDelta: true,
    },
    {
      id: "nc_roas",
      group: "Blended performance",
      label: "New-customer ROAS",
      value: roas(ncRoas),
      delta: null,
      source: "New-customer revenue ÷ blended ad spend",
      hero: true,
    },
    // Business (Shopify).
    {
      id: "revenue",
      group: "Business",
      label: "Total revenue",
      value: shopifyConnected ? money(alignedShopify.revenue) : null,
      delta: deltas.revenue,
      source: "Shopify · currentTotalPriceSet",
    },
    {
      id: "orders",
      group: "Business",
      label: "Orders",
      value: shopifyConnected ? count(alignedShopify.orders) : null,
      delta: deltas.orders,
      spark: dailyOrders,
      source: "Shopify orders in range",
    },
    {
      id: "aov",
      group: "Business",
      label: "Average order value",
      value: money(aov),
      delta: deltas.aov,
      source: "Revenue ÷ orders",
    },
    {
      id: "new_customer_orders",
      group: "Business",
      label: "New-customer orders",
      value: shopifyConnected ? count(alignedShopify.newCustomerOrders) : null,
      delta: deltas.newCustomerOrders,
      source: "Shopify numberOfOrders ≤ 1",
    },
    {
      id: "gross_revenue",
      group: "Business",
      label: "Gross revenue",
      value: shopifyConnected ? money(alignedShopify.gross) : null,
      delta: null,
      source: "Line items before discounts",
    },
    {
      id: "net_after_fees",
      group: "Business",
      label: "Net after fees",
      value: shopifyConnected ? money(feesAfter) : null,
      delta: null,
      source: "Revenue − Shopify Payments fees",
    },
    // Advertising (Meta + Google).
    {
      id: "ad_spend",
      group: "Advertising",
      label: "Ad spend",
      value: money(totalSpend),
      delta: null,
      source: "Meta + Google for this range",
    },
    {
      id: "meta_spend",
      group: "Advertising",
      label: "Meta spend",
      value: money(ads.facebook.spend),
      delta: null,
      source: ads.facebook.state === "connected" ? "Meta Ads" : "Connect or paste on First-touch",
    },
    {
      id: "google_spend",
      group: "Advertising",
      label: "Google spend",
      value: money(ads.google.spend),
      delta: null,
      source: ads.google.state === "connected" ? "Google Ads" : "Paste on First-touch",
    },
    {
      id: "blended_cpa",
      group: "Advertising",
      label: "Blended CPA",
      value: money(cpa),
      delta: null,
      source: "Spend ÷ orders with total > $0",
      invertDelta: true,
    },
    // Web analytics (Stape / BigQuery).
    {
      id: "sessions",
      group: "Web analytics",
      label: "Sessions",
      value: stapeConnected ? count(funnel.sessions) : null,
      delta: deltas.sessions,
      spark: dailySessions,
      source: "Stape sessions",
    },
    {
      id: "users",
      group: "Web analytics",
      label: "Users",
      value: stapeConnected ? count(funnel.users) : null,
      delta: deltas.users,
      source: "Distinct client_id",
    },
    {
      id: "pageviews",
      group: "Web analytics",
      label: "Pageviews",
      value: stapeConnected ? count(funnel.pageviews) : null,
      delta: deltas.pageviews,
      spark: dailyPageviews,
      source: "page_view events",
    },
    {
      id: "conversion_rate",
      group: "Web analytics",
      label: "Conversion rate",
      value: percent(conversion.rate),
      delta: deltas.conversion,
      source: "Shopify orders ÷ Stape sessions",
    },
    {
      id: "stape_purchases",
      group: "Web analytics",
      label: "Stape purchases",
      value: stapeConnected ? count(funnel.purchases) : null,
      delta: null,
      source: "Deduped purchase events",
    },
    {
      id: "unknown_share",
      group: "Web analytics",
      label: "Unknown first-touch",
      value: shopifyConnected ? percent(unknown.orderShare) : null,
      delta: null,
      source: "Orders missing gn_* ÷ orders",
      invertDelta: true,
    },
  ];

  const channelRevenue = byChannel.map((row) => ({
    label: row.channel,
    value: row.revenue,
  }));
  const channelOrders = byChannel.map((row) => ({
    label: row.channel,
    value: row.orders,
    secondary: formatMoney({ amount: row.revenue, currencyCode: currency }),
  }));

  return (
    <>
      <Header
        title="Summary"
        description="Your command center: blended performance, business, advertising, and web analytics for the selected range — pin what matters and compare to the previous period."
      />
      <section className="dash-page">
        <ConnectionStatus
          shopify={shopify.status}
          stape={funnel.status}
          facebook={ads.facebook}
          google={ads.google}
        />
        <SummaryBoard metrics={metrics} />
        <div className="grid gap-4 lg:grid-cols-2">
          <DonutChart
            title="Revenue by first-touch channel"
            description="Shopify gn_* first-touch · selected range"
            slices={channelRevenue}
            currencyCode={currency}
            emptyLabel="Channel revenue appears once Shopify orders carry gn_* attribution."
          />
          <HorizontalBarList
            title="Orders by first-touch channel"
            description="Shopify gn_* first-touch · selected range"
            rows={channelOrders}
            emptyLabel="Channel orders appear once Shopify orders carry gn_* attribution."
          />
        </div>
        <DailyTrendChart
          title="Sessions vs orders"
          description="Pacific calendar days for the header range. Sessions are Stape; orders are Shopify."
          days={days}
          seriesA={{ label: "Stape sessions", values: dailySessions }}
          seriesB={{ label: "Shopify orders", values: dailyOrders }}
        />
      </section>
    </>
  );
}
