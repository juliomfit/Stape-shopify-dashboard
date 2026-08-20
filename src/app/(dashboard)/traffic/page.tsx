import type { Metadata } from "next";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { TrafficSourcesPanel } from "@/components/dashboard/TrafficSourcesPanel";
import { Ga4BreakdownPanel, Ga4EngagementStrip } from "@/components/dashboard/Ga4Panels";
import { Header } from "@/components/layout/Header";
import { formatNumber } from "@/lib/format";
import { getGa4Snapshot } from "@/lib/ads/ga4-query";
import { getStapeFunnelMetrics } from "@/lib/stape/get-funnel-metrics";
import { getStapeTrafficMetrics } from "@/lib/stape/get-traffic-metrics";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";


export const metadata: Metadata = {
  title: "Traffic",
};

export default async function TrafficPage() {
  const [shopify, stape, funnel, ga4] = await Promise.all([
    getShopifyOverviewMetrics(),
    getStapeTrafficMetrics(),
    getStapeFunnelMetrics(),
    getGa4Snapshot().catch(() => null),
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
        description="Stape sessions from BigQuery. The source list is whatever utm_source (or click id / referrer) arrived — Sendvio does not need to be pre-listed. Channel buckets are separate."
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
        <TrafficSourcesPanel
          title="Sources (utm / click / referrer)"
          sources={stape.rawSources}
          periodLabel={stape.periodLabel}
          description={`Whatever landed on the first page of the session · ${stape.periodLabel} · not a dashboard allowlist · not gn_*`}
        />
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
        {ga4 ? (
          <>
            <Ga4EngagementStrip totals={ga4.totals} periodLabel={ga4.periodLabel} />
            <div className="grid gap-4 lg:grid-cols-2">
              <Ga4BreakdownPanel
                title="GA4 device"
                description="Google Analytics deviceCategory · not Stape"
                rows={ga4.devices.map((row) => ({
                  label: row.label,
                  sessions: row.sessions,
                }))}
              />
              <Ga4BreakdownPanel
                title="GA4 country"
                description="Google Analytics country · not Stape"
                rows={ga4.countries.map((row) => ({
                  label: row.label,
                  sessions: row.sessions,
                }))}
              />
              <Ga4BreakdownPanel
                title="GA4 landing page"
                description="Google Analytics landingPage · not gn_*"
                rows={ga4.landings.map((row) => ({
                  label: row.label,
                  sessions: row.sessions,
                }))}
              />
              <Ga4BreakdownPanel
                title="GA4 search terms"
                description="utm term / search term if GA4 returned it. Search Console queries need a Search Console link."
                rows={ga4.searchTerms.map((row) => ({
                  label: row.label,
                  sessions: row.sessions,
                }))}
              />
            </div>
            {ga4.googleAdsCampaigns.length > 0 ? (
              <Ga4BreakdownPanel
                title="GA4 Google Ads campaigns"
                description="Inside Analytics if the property is linked to Google Ads. Not Ads Manager spend paste."
                rows={ga4.googleAdsCampaigns.map((row) => ({
                  label: row.label,
                  sessions: row.sessions,
                  extra: row.extra,
                }))}
                extraLabel="cost"
              />
            ) : null}
          </>
        ) : null}
        <p className="text-xs leading-5 text-muted">
          Device, country, and landing page come from GA4 Data API after Refresh GA4.
          Stape dashboard_events still does not have those columns.
        </p>
      </section>
    </>
  );
}
