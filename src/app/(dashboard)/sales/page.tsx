import type { Metadata } from "next";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { OrdersTable } from "@/components/dashboard/OrdersTable";
import { Header } from "@/components/layout/Header";
import { getAverageOrderValue } from "@/lib/dashboard/conversion";
import { formatMoney, formatNumber } from "@/lib/format";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sales",
};

export default async function SalesPage() {
  const shopify = await getShopifyOverviewMetrics();
  const shopifySource =
    shopify.status.state === "connected"
      ? `Shopify · ${shopify.periodLabel}`
      : "Shopify · no data yet";
  const averageOrderValue = getAverageOrderValue(
    shopify.revenue?.amount ?? null,
    shopify.orders,
  );
  const unitsSold = shopify.products.reduce(
    (total, product) => total + product.quantity,
    0,
  );

  return (
    <>
      <Header
        title="Sales"
        description="Shopify orders, revenue, and recent order activity."
      />
      <section className="flex flex-1 flex-col gap-6 p-8">
        <ConnectionStatus shopify={shopify.status} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total Revenue"
            source={shopifySource}
            value={shopify.revenue ? formatMoney(shopify.revenue) : null}
          />
          <MetricCard
            label="Orders"
            source={shopifySource}
            value={
              shopify.orders === null ? null : formatNumber(shopify.orders)
            }
          />
          <MetricCard
            label="Average Order Value"
            source={shopifySource}
            value={
              averageOrderValue === null || !shopify.revenue
                ? null
                : formatMoney({
                    amount: averageOrderValue,
                    currencyCode: shopify.revenue.currencyCode,
                  })
            }
          />
          <MetricCard
            label="Units sold"
            source={shopifySource}
            value={
              shopify.status.state === "connected"
                ? formatNumber(unitsSold)
                : null
            }
          />
        </div>
        <OrdersTable orders={shopify.recentOrders} />
      </section>
    </>
  );
}
