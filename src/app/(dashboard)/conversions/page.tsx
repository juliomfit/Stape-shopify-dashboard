import type { Metadata } from "next";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { ConversionFunnel } from "@/components/dashboard/ConversionFunnel";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Header } from "@/components/layout/Header";
import { getAverageOrderValue, getConversionRate } from "@/lib/dashboard/conversion";
import { getAlignedPeriod, shopifyMetricsSince } from "@/lib/dashboard/aligned-period";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";
import { getStapeFunnelMetrics } from "@/lib/stape/get-funnel-metrics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Conversions",
};

export default async function ConversionsPage() {
  const [shopify, funnel, period] = await Promise.all([
    getShopifyOverviewMetrics(),
    getStapeFunnelMetrics(),
    getAlignedPeriod(),
  ]);
  const alignedShopify = shopifyMetricsSince(
    shopify.orderPoints,
    period.startMs,
    period.endMs,
  );
  const shopifyConnected = shopify.status.state === "connected";
  const stapeConnected = funnel.status.state === "connected";
  const shopifySource = shopifyConnected
    ? `Shopify · ${period.label}`
    : "Shopify · no data yet";
  const stapeSource = stapeConnected
    ? `Stape · ${period.label}`
    : "Stape · no data yet";
  const conversion = getConversionRate(
    stapeConnected ? funnel.purchases : null,
    stapeConnected ? funnel.sessions : null,
  );
  const bothSource =
    conversion.rate === null
      ? conversion.note
      : `${conversion.note} · ${period.label}`;
  const averageOrderValue = getAverageOrderValue(
    shopifyConnected ? alignedShopify.revenue : null,
    shopifyConnected ? alignedShopify.orders : null,
  );

  return (
    <>
      <Header
        title="Conversions"
        description="Clicks to purchase for the selected date range. Landing page views are page_view sessions, not product views."
      />
      <section className="flex flex-1 flex-col gap-6 p-8">
        <ConnectionStatus shopify={shopify.status} stape={funnel.status} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Conversion Rate"
            source={bothSource}
            value={
              conversion.rate === null ? null : formatPercent(conversion.rate)
            }
          />
          <MetricCard
            label="Shopify orders"
            source={shopifySource}
            value={shopifyConnected ? formatNumber(alignedShopify.orders) : null}
          />
          <MetricCard
            label="Stape purchases"
            source={stapeSource}
            value={stapeConnected ? formatNumber(funnel.purchases) : null}
          />
          <MetricCard
            label="Average Order Value"
            source={shopifySource}
            value={
              averageOrderValue === null
                ? null
                : formatMoney({
                    amount: averageOrderValue,
                    currencyCode: shopify.revenue?.currencyCode || "USD",
                  })
            }
          />
        </div>
        <ConversionFunnel
          periodLabel={period.label}
          steps={funnel.steps}
          showTable
        />
      </section>
    </>
  );
}
