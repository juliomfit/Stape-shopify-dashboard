import type { Metadata } from "next";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { EmptyPanel } from "@/components/dashboard/EmptyPanel";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { TrackingHealth } from "@/components/dashboard/TrackingHealth";
import { TrafficSourcesPanel } from "@/components/dashboard/TrafficSourcesPanel";
import { Header } from "@/components/layout/Header";
import { getAlignedPeriod, shopifyMetricsSince } from "@/lib/dashboard/aligned-period";
import { getConversionRate } from "@/lib/dashboard/conversion";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";
import { getAttributionMetrics } from "@/lib/stape/get-attribution-metrics";
import { getStapeTrafficMetrics } from "@/lib/stape/get-traffic-metrics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Attribution",
};

export default async function AttributionPage() {
  const [shopify, stape, attribution, period] = await Promise.all([
    getShopifyOverviewMetrics(),
    getStapeTrafficMetrics(),
    getAttributionMetrics(),
    getAlignedPeriod(),
  ]);
  const alignedShopify = shopifyMetricsSince(
    shopify.orderPoints,
    period.startMs,
    period.endMs,
  );
  const conversion = getConversionRate(
    shopify.status.state === "connected" ? alignedShopify.orders : null,
    stape.sessions,
  );
  const shopifySource =
    shopify.status.state === "connected"
      ? `Shopify · ${period.label}`
      : "Shopify · no data yet";
  const stapeSource =
    stape.status.state === "connected"
      ? `Stape · ${period.label}`
      : "Stape · no data yet";

  return (
    <>
      <Header
        title="Attribution"
        description="True performance from first-party Stape data, compared with Shopify revenue — not Meta or Google’s reported numbers."
      />
      <section className="flex flex-1 flex-col gap-6 p-8">
        <ConnectionStatus shopify={shopify.status} stape={attribution.status} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Shopify revenue"
            source={shopifySource}
            value={
              shopify.status.state === "connected"
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
            value={
              shopify.status.state === "connected"
                ? formatNumber(alignedShopify.orders)
                : null
            }
          />
          <MetricCard
            label="Stape sessions"
            source={stapeSource}
            value={
              stape.sessions === null ? null : formatNumber(stape.sessions)
            }
          />
          <MetricCard
            label="True conversion rate"
            source={
              conversion.rate === null
                ? conversion.note
                : `${conversion.note} · ${period.label}`
            }
            value={
              conversion.rate === null ? null : formatPercent(conversion.rate)
            }
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <TrafficSourcesPanel
            title="First-touch"
            sources={attribution.firstTouch}
            periodLabel={attribution.periodLabel || period.label}
          />
          <TrafficSourcesPanel
            title="Last-touch"
            sources={attribution.lastTouch}
            periodLabel={attribution.periodLabel || period.label}
          />
        </div>
        {attribution.hasPurchaseEvents ? null : (
          <EmptyPanel
            title="Purchase events are not in BigQuery yet"
            description="No purchase rows in the connected BigQuery events yet. The live Stape table is stape_data.dashboard_events — check that BIGQUERY_DATASET and BIGQUERY_TABLE point there."
          />
        )}
        <TrackingHealth fields={attribution.tracking} />
      </section>
    </>
  );
}
