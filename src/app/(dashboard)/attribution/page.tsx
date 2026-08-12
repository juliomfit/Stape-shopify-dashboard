import type { Metadata } from "next";
import { ChannelContributionTable } from "@/components/dashboard/ChannelContributionTable";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { EmptyPanel } from "@/components/dashboard/EmptyPanel";
import { InfoPanel } from "@/components/dashboard/InfoPanel";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { TrackingHealth } from "@/components/dashboard/TrackingHealth";
import { TrafficSourcesPanel } from "@/components/dashboard/TrafficSourcesPanel";
import { Header } from "@/components/layout/Header";
import { getAlignedPeriod, shopifyMetricsSince } from "@/lib/dashboard/aligned-period";
import { getConversionRate } from "@/lib/dashboard/conversion";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";
import { getAttributionMetrics } from "@/lib/stape/get-attribution-metrics";
import { getStapeFunnelMetrics } from "@/lib/stape/get-funnel-metrics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "True Performance",
};

function marketingSpend() {
  const raw = process.env.MARKETING_SPEND_USD?.trim();
  if (!raw) {
    return null;
  }

  const amount = Number(raw);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export default async function AttributionPage() {
  const [shopify, funnel, attribution, period] = await Promise.all([
    getShopifyOverviewMetrics(),
    getStapeFunnelMetrics(),
    getAttributionMetrics(),
    getAlignedPeriod(),
  ]);
  const alignedShopify = shopifyMetricsSince(
    shopify.orderPoints,
    period.startMs,
    period.endMs,
  );
  const conversion = getConversionRate(
    attribution.hasPurchaseEvents ? attribution.attributedOrders : null,
    funnel.status.state === "connected" ? funnel.sessions : null,
  );
  const currency = shopify.revenue?.currencyCode || "USD";
  const spend = marketingSpend();
  const mer =
    spend && alignedShopify.revenue > 0 ? alignedShopify.revenue / spend : null;
  const shopifySource =
    shopify.status.state === "connected"
      ? `Shopify · ${period.label}`
      : "Shopify · no data yet";
  const stapeSource =
    attribution.status.state === "connected"
      ? `Stape · ${period.label}`
      : "Stape · no data yet";

  return (
    <>
      <Header
        title="True Performance"
        description="First-party attribution from Stape + Shopify. This is not Meta or Google’s reported numbers."
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
                    currencyCode: currency,
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
            label="Attributed Stape purchases"
            source={`${stapeSource} · unique order IDs`}
            value={
              attribution.status.state === "connected"
                ? formatNumber(attribution.attributedOrders)
                : null
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="New customer orders"
            source={shopifySource}
            value={
              shopify.status.state === "connected"
                ? formatNumber(alignedShopify.newCustomerOrders)
                : null
            }
          />
          <MetricCard
            label="Returning customer orders"
            source={shopifySource}
            value={
              shopify.status.state === "connected"
                ? formatNumber(alignedShopify.returningCustomerOrders)
                : null
            }
          />
          <MetricCard
            label="New customer revenue"
            source={shopifySource}
            value={
              shopify.status.state === "connected"
                ? formatMoney({
                    amount: alignedShopify.newCustomerRevenue,
                    currencyCode: currency,
                  })
                : null
            }
          />
          <MetricCard
            label="MER (blended)"
            source={
              mer === null
                ? "Add MARKETING_SPEND_USD in .env.local — we will not guess ad spend"
                : `Shopify revenue ÷ spend · ${period.label}`
            }
            value={mer === null ? null : `${mer.toFixed(2)}x`}
          />
        </div>
        {attribution.hasPurchaseEvents ? (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <ChannelContributionTable
                title="First-touch (orders)"
                description={`First real channel in the ${attribution.lookbackDays}-day path. Direct is used only when we never saw ads, email, or organic.`}
                rows={attribution.firstNonDirect}
                currencyCode={currency}
              />
              <ChannelContributionTable
                title="Last non-direct (orders)"
                description="Last real channel before checkout. Checkout pages have no UTMs, so a raw last-click model dumps almost everything into Direct."
                rows={attribution.lastNonDirect}
                currencyCode={currency}
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <ChannelContributionTable
                title="Linear (multi-touch)"
                description="Each order’s revenue is split evenly across the unique non-direct channels on that path. Direct-only orders stay Direct."
                rows={attribution.linear}
                currencyCode={currency}
              />
              <ChannelContributionTable
                title="Raw last-click (usually Direct)"
                description="This is what you get if you credit the purchase page itself. Shown so you can see why Shopify Direct is often wrong."
                rows={attribution.lastClick}
                currencyCode={currency}
              />
            </div>
          </>
        ) : (
          <EmptyPanel
            title="No purchase events in this date range"
            description="True Performance needs Stape purchase events with transaction_id. Check Conversions for Today, or widen the date range."
          />
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          <TrafficSourcesPanel
            title="Session first-touch"
            sources={attribution.firstTouch}
            periodLabel={period.label}
            description={`First hit in each session · ${period.label}`}
          />
          <TrafficSourcesPanel
            title="Session last-touch"
            sources={attribution.lastTouch}
            periodLabel={period.label}
            description={`Last hit in each session · ${period.label}`}
          />
        </div>
        <InfoPanel
          title="How to read this"
          items={[
            "Trust First-touch and Last non-direct more than raw last-click.",
            "Linear is the first multi-touch model: every assisting channel gets an equal share of that order.",
            "We are not showing Meta/Google claimed conversions. Those tools double-count. Connect spend later for MER and blended ROAS.",
            `Lookback is ${attribution.lookbackDays} days using client_id (same browser), because user_id is empty.`,
            alignedShopify.guestOrders
              ? `${formatNumber(alignedShopify.guestOrders)} Shopify orders in this range have no customer record (guest checkout).`
              : "Shopify new vs returning uses number of orders on the customer (1 = new).",
          ]}
        />
        <InfoPanel title="Still missing for Polar / Triple Whale-level reporting" items={attribution.gaps} />
        <TrackingHealth fields={attribution.tracking} />
      </section>
    </>
  );
}
