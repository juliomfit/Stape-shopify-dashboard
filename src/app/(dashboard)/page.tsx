import type { Metadata } from "next";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { TopProductsPanel } from "@/components/dashboard/TopProductsPanel";
import { Header } from "@/components/layout/Header";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";
import { getStapeTrafficMetrics } from "@/lib/stape/get-traffic-metrics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Overview",
};

export default async function OverviewPage() {
  const [shopify, stape] = await Promise.all([
    getShopifyOverviewMetrics(),
    getStapeTrafficMetrics(),
  ]);

  const shopifySource =
    shopify.status.state === "connected"
      ? `Shopify · ${shopify.periodLabel}`
      : "Shopify · no data yet";
  const stapeSource =
    stape.status.state === "connected"
      ? `Stape · ${stape.periodLabel}`
      : "Stape · no data yet";

  const conversionRate =
    shopify.orders !== null && stape.sessions && stape.sessions > 0
      ? shopify.orders / stape.sessions
      : null;

  return (
    <>
      <Header
        title="Overview"
        description="A high-level view of Shopify and Stape performance."
      />
      <section className="flex flex-1 flex-col gap-6 p-8">
        <ConnectionStatus shopify={shopify.status} stape={stape.status} />
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
            label="Conversion Rate"
            source={
              conversionRate === null
                ? "Shopify + Stape · no data yet"
                : `Orders ÷ sessions · ${shopify.periodLabel}`
            }
            value={
              conversionRate === null ? null : formatPercent(conversionRate)
            }
          />
          <MetricCard
            label="Sessions / Traffic"
            source={stapeSource}
            value={
              stape.sessions === null ? null : formatNumber(stape.sessions)
            }
          />
        </div>
        <TopProductsPanel products={shopify.topProducts} />
      </section>
    </>
  );
}
