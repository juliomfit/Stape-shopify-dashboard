import type { Metadata } from "next";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { OrdersTable } from "@/components/dashboard/OrdersTable";
import { Header } from "@/components/layout/Header";
import { getAlignedPeriod, shopifyMetricsSince } from "@/lib/dashboard/aligned-period";
import { getAverageOrderValue } from "@/lib/dashboard/conversion";
import { formatMoney, formatNumber } from "@/lib/format";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";
import { getStapeFunnelMetrics } from "@/lib/stape/get-funnel-metrics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sales",
};

export default async function SalesPage() {
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
  const averageOrderValue = getAverageOrderValue(
    shopifyConnected ? alignedShopify.revenue : null,
    shopifyConnected ? alignedShopify.orders : null,
  );
  const unitsSold = shopify.products.reduce(
    (total, product) => total + product.quantity,
    0,
  );

  return (
    <>
      <Header
        title="Sales"
        description="Shopify orders next to unique Stape purchases for the same date range."
      />
      <section className="flex flex-1 flex-col gap-6 p-8">
        <ConnectionStatus shopify={shopify.status} stape={funnel.status} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Shopify revenue"
            source={shopifySource}
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
        <div className="grid gap-4 sm:grid-cols-2">
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
          <MetricCard
            label="Units sold"
            source={shopifySource}
            value={shopifyConnected ? formatNumber(unitsSold) : null}
          />
        </div>
        <OrdersTable
          orders={shopify.recentOrders}
          periodLabel={period.label}
        />
      </section>
    </>
  );
}
