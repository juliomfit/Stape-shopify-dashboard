import type { Metadata } from "next";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { TrafficSourcesPanel } from "@/components/dashboard/TrafficSourcesPanel";
import { Header } from "@/components/layout/Header";
import { formatNumber } from "@/lib/format";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";
import { getStapeFunnelMetrics } from "@/lib/stape/get-funnel-metrics";
import { getStapeTrafficMetrics } from "@/lib/stape/get-traffic-metrics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Traffic",
};

export default async function TrafficPage() {
  const [shopify, stape, funnel] = await Promise.all([
    getShopifyOverviewMetrics(),
    getStapeTrafficMetrics(),
    getStapeFunnelMetrics(),
  ]);
  const stapeConnected = funnel.status.state === "connected";
  const stapeSource = stapeConnected
    ? `Stape · ${funnel.periodLabel}`
    : "Stape · no data yet";
  const trafficSource =
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
        <ConnectionStatus shopify={shopify.status} stape={funnel.status} />
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard
            label="Sessions"
            source={stapeSource}
            value={stapeConnected ? formatNumber(funnel.sessions) : null}
          />
          <MetricCard
            label="Users"
            source={trafficSource}
            value={stape.users === null ? null : formatNumber(stape.users)}
          />
          <MetricCard
            label="Events"
            source={trafficSource}
            value={stape.events === null ? null : formatNumber(stape.events)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard
            label="Google Ads"
            source={trafficSource}
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
              stapeConnected
                ? formatNumber(funnel.facebookSessions)
                : null
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
