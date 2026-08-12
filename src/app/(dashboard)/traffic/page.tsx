import type { Metadata } from "next";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { TrafficSourcesPanel } from "@/components/dashboard/TrafficSourcesPanel";
import { Header } from "@/components/layout/Header";
import { formatNumber } from "@/lib/format";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";
import { getStapeTrafficMetrics } from "@/lib/stape/get-traffic-metrics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Traffic",
};

export default async function TrafficPage() {
  const [shopify, stape] = await Promise.all([
    getShopifyOverviewMetrics(),
    getStapeTrafficMetrics(),
  ]);
  const stapeSource =
    stape.status.state === "connected"
      ? `Stape · ${stape.periodLabel}`
      : "Stape · no data yet";

  return (
    <>
      <Header
        title="Traffic"
        description="First-party sessions and sources from Stape via BigQuery."
      />
      <section className="flex flex-1 flex-col gap-6 p-8">
        <ConnectionStatus shopify={shopify.status} stape={stape.status} />
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard
            label="Sessions"
            source={stapeSource}
            value={
              stape.sessions === null ? null : formatNumber(stape.sessions)
            }
          />
          <MetricCard
            label="Users"
            source={stapeSource}
            value={stape.users === null ? null : formatNumber(stape.users)}
          />
          <MetricCard
            label="Events"
            source={stapeSource}
            value={stape.events === null ? null : formatNumber(stape.events)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard
            label="Google Ads"
            source={stapeSource}
            value={
              stape.sessions === null
                ? null
                : formatNumber(
                    stape.sources.find((item) => item.source === "Google Ads")
                      ?.sessions ?? 0,
                  )
            }
          />
          <MetricCard
            label="Facebook / Meta Ads"
            source={stapeSource}
            value={
              stape.sessions === null
                ? null
                : formatNumber(
                    stape.sources.find(
                      (item) => item.source === "Facebook / Meta Ads",
                    )?.sessions ?? 0,
                  )
            }
          />
        </div>
        <TrafficSourcesPanel
          sources={stape.sources}
          periodLabel={stape.periodLabel}
        />
      </section>
    </>
  );
}
