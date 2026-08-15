import type { Metadata } from "next";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { TrafficSourcesPanel } from "@/components/dashboard/TrafficSourcesPanel";
import { Header } from "@/components/layout/Header";
import { formatNumber } from "@/lib/format";
import { getStapeFunnelMetrics } from "@/lib/stape/get-funnel-metrics";
import { getStapeTrafficMetrics } from "@/lib/stape/get-traffic-metrics";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";

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
  const paidSessions = stape.paidSources.reduce(
    (total, row) => total + row.sessions,
    0,
  );
  const organicSessions = stape.organicSources.reduce(
    (total, row) => total + row.sessions,
    0,
  );

  return (
    <>
      <Header
        title="Traffic"
        description="Stape sessions from BigQuery. Channel names match gn_* (Google Ads, Facebook / Meta Ads, and so on). This is not first-touch truth."
      />
      <section className="dash-page gap-6">
        <ConnectionStatus shopify={shopify.status} stape={funnel.status} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Sessions"
            source={`${stapeSource} · same session definition as the funnel`}
            value={stapeConnected ? formatNumber(funnel.sessions) : null}
          />
          <MetricCard
            label="Users"
            source={`${stapeSource} · distinct client_id`}
            value={stapeConnected ? formatNumber(funnel.users) : null}
          />
          <MetricCard
            label="Pageviews"
            source={`${stapeSource} · page_view events`}
            value={stapeConnected ? formatNumber(funnel.pageviews) : null}
          />
          <MetricCard
            label="Events"
            source={
              stape.status.state === "connected"
                ? `Stape · ${stape.periodLabel}`
                : "Stape · no data yet"
            }
            value={stape.events === null ? null : formatNumber(stape.events)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard
            label="Paid sessions"
            source="Stape · Google Ads, Facebook / Meta Ads, TikTok, Microsoft Ads"
            value={
              stape.status.state === "connected"
                ? formatNumber(paidSessions)
                : null
            }
          />
          <MetricCard
            label="Organic / other sessions"
            source="Stape · Google Organic, Meta Organic, Email, Direct, Other"
            value={
              stape.status.state === "connected"
                ? formatNumber(organicSessions)
                : null
            }
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <TrafficSourcesPanel
            title="Paid (Stape)"
            sources={stape.paidSources}
            periodLabel={stape.periodLabel}
            description={`Stape reconstructed path · ${stape.periodLabel} · not gn_*`}
          />
          <TrafficSourcesPanel
            title="Organic / other (Stape)"
            sources={stape.organicSources}
            periodLabel={stape.periodLabel}
            description={`Stape reconstructed path · ${stape.periodLabel} · not gn_*`}
          />
        </div>
        <p className="text-xs leading-5 text-muted">
          Device, country, and landing-page tables are omitted: those columns
          are not in stape_data.dashboard_events.
        </p>
      </section>
    </>
  );
}
