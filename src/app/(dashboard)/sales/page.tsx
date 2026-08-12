import type { Metadata } from "next";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Header } from "@/components/layout/Header";
import { formatMoney, formatNumber } from "@/lib/format";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sales",
};

export default async function SalesPage() {
  const metrics = await getShopifyOverviewMetrics();
  const shopifySource =
    metrics.status.state === "connected"
      ? `Shopify · ${metrics.periodLabel}`
      : "Shopify · no data yet";

  return (
    <>
      <Header
        title="Sales"
        description="Shopify orders, revenue, and related sales metrics."
      />
      <section className="flex flex-1 flex-col gap-6 p-8">
        <ConnectionStatus status={metrics.status} />
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard
            label="Total Revenue"
            source={shopifySource}
            value={metrics.revenue ? formatMoney(metrics.revenue) : null}
          />
          <MetricCard
            label="Orders"
            source={shopifySource}
            value={
              metrics.orders === null ? null : formatNumber(metrics.orders)
            }
          />
        </div>
      </section>
    </>
  );
}
