import type { Metadata } from "next";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { ConversionFunnel } from "@/components/dashboard/ConversionFunnel";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { TopProductsPanel } from "@/components/dashboard/TopProductsPanel";
import { TruncationNotice } from "@/components/dashboard/TruncationNotice";
import { RevenueBreakdown } from "@/components/dashboard/RevenueBreakdown";
import { Header } from "@/components/layout/Header";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { getAlignedPeriod, shopifyMetricsSince } from "@/lib/dashboard/aligned-period";
import { getConversionRate } from "@/lib/dashboard/conversion";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";
import { getStapeFunnelMetrics } from "@/lib/stape/get-funnel-metrics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Overview",
};

export default async function OverviewPage() {
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
    shopifyConnected ? alignedShopify.orders : null,
    stapeConnected ? funnel.sessions : null,
  );
  const conversionSource =
    conversion.rate === null
      ? conversion.note
      : `${conversion.note} · ${period.label}`;

  return (
    <>
      <Header
        title="Overview"
        description="Sales and funnel for the selected date range, using America/Los_Angeles calendar days."
      />
      <section className="flex flex-1 flex-col gap-6 p-8">
        <ConnectionStatus shopify={shopify.status} stape={funnel.status} />
        <TruncationNotice
          truncated={shopify.truncated}
          fetched={alignedShopify.orders}
          reportedCount={shopify.reportedOrderCount}
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Gross revenue"
            source={`${shopifySource} · line items before discounts`}
            value={
              shopifyConnected
                ? formatMoney({
                    amount: alignedShopify.gross,
                    currencyCode: shopify.revenue?.currencyCode || "USD",
                  })
                : null
            }
          />
          <MetricCard
            label="Total revenue"
            source={`${shopifySource} · currentTotalPriceSet`}
            value={
              shopifyConnected
                ? formatMoney({
                    amount: alignedShopify.revenue,
                    currencyCode: shopify.revenue?.currencyCode || "USD",
                  })
                : null
            }
          />
          <MetricCard
            label="Processing fees"
            source={
              alignedShopify.processingFees === null
                ? "Shopify Payments fees on successful sale/capture · none in this range"
                : `${shopifySource} · Shopify Payments sale/capture only`
            }
            value={
              shopifyConnected && alignedShopify.processingFees !== null
                ? formatMoney({
                    amount: alignedShopify.processingFees,
                    currencyCode: shopify.revenue?.currencyCode || "USD",
                  })
                : null
            }
          />
          <MetricCard
            label="Refund fees"
            source={
              alignedShopify.refundFees === null
                ? "Shopify Payments fees on successful refunds · none in this range"
                : `${shopifySource} · Shopify Payments refunds only`
            }
            value={
              shopifyConnected && alignedShopify.refundFees !== null
                ? formatMoney({
                    amount: alignedShopify.refundFees,
                    currencyCode: shopify.revenue?.currencyCode || "USD",
                  })
                : null
            }
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Shopify orders"
            source={shopifySource}
            value={shopifyConnected ? formatNumber(alignedShopify.orders) : null}
          />
          <MetricCard
            label="Stape purchase revenue"
            source={stapeSource}
            value={
              stapeConnected
                ? formatMoney({
                    amount: funnel.purchaseRevenue,
                    currencyCode: shopify.revenue?.currencyCode || "USD",
                  })
                : null
            }
          />
          <MetricCard
            label="Stape purchases"
            source={stapeSource}
            value={stapeConnected ? formatNumber(funnel.purchases) : null}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Sessions"
            source={stapeSource}
            value={
              stapeConnected ? formatNumber(funnel.sessions) : null
            }
          />
          <MetricCard
            label="Conversion Rate"
            source={conversionSource}
            value={
              conversion.rate === null ? null : formatPercent(conversion.rate)
            }
          />
        </div>
        {shopifyConnected ? (
          <RevenueBreakdown
            periodLabel={period.label}
            currencyCode={shopify.revenue?.currencyCode || "USD"}
            gross={alignedShopify.gross}
            subtotal={alignedShopify.subtotal}
            discounts={alignedShopify.discounts}
            shipping={alignedShopify.shipping}
            tax={alignedShopify.tax}
            refunded={alignedShopify.refunded}
            total={alignedShopify.revenue}
          />
        ) : null}
        <ConversionFunnel steps={funnel.steps} periodLabel={period.label} />
        <TopProductsPanel products={shopify.topProducts} />
      </section>
    </>
  );
}
