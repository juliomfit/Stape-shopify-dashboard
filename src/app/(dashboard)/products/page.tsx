import type { Metadata } from "next";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ProductTable } from "@/components/dashboard/ProductTable";
import { TruncationNotice } from "@/components/dashboard/TruncationNotice";
import { Header } from "@/components/layout/Header";
import { formatMoney, formatNumber } from "@/lib/format";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Products",
};

export default async function ProductsPage() {
  const shopify = await getShopifyOverviewMetrics();
  const shopifySource =
    shopify.status.state === "connected"
      ? `Shopify · ${shopify.periodLabel}`
      : "Shopify · no data yet";
  const unitsSold = shopify.products.reduce(
    (total, product) => total + product.quantity,
    0,
  );
  const productRevenue = shopify.products.reduce(
    (total, product) => total + product.revenue.amount,
    0,
  );

  return (
    <>
      <Header
        title="Products"
        description="Shopify product sales for the selected date range."
      />
      <section className="flex flex-1 flex-col gap-6 p-8">
        <ConnectionStatus shopify={shopify.status} />
        <TruncationNotice
          truncated={shopify.truncated}
          fetched={shopify.orderPoints.length}
          reportedCount={shopify.reportedOrderCount}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard
            label="Products"
            source={shopifySource}
            value={
              shopify.status.state === "connected"
                ? formatNumber(shopify.products.length)
                : null
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
          <MetricCard
            label="Line-item revenue"
            source={`${shopifySource} · excludes shipping and tax`}
            value={
              shopify.revenue
                ? formatMoney({
                    amount: productRevenue,
                    currencyCode: shopify.revenue.currencyCode,
                  })
                : null
            }
          />
        </div>
        <ProductTable
          products={shopify.products}
          periodLabel={shopify.periodLabel}
          connected={shopify.status.state === "connected"}
        />
      </section>
    </>
  );
}
