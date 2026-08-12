import type { Metadata } from "next";
import { ChannelContributionTable } from "@/components/dashboard/ChannelContributionTable";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { EmptyPanel } from "@/components/dashboard/EmptyPanel";
import { InfoPanel } from "@/components/dashboard/InfoPanel";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { PlatformCompareTable } from "@/components/dashboard/PlatformCompareTable";
import { TrackingHealth } from "@/components/dashboard/TrackingHealth";
import { TrafficSourcesPanel } from "@/components/dashboard/TrafficSourcesPanel";
import { Header } from "@/components/layout/Header";
import { getTruePerformance } from "@/lib/dashboard/true-performance";
import { getConversionRate } from "@/lib/dashboard/conversion";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "True Performance",
};

function roasLabel(value: number | null) {
  return value === null ? null : `${value.toFixed(2)}x`;
}

export default async function AttributionPage() {
  const data = await getTruePerformance();
  const {
    shopify,
    funnel,
    attribution,
    period,
    alignedShopify,
    platform,
    newCustomerByChannel,
    totalSpend,
    mer,
    newCustomerRoas,
    blendedRoas,
    compare,
    matchedOrders,
  } = data;
  const conversion = getConversionRate(
    attribution.hasPurchaseEvents ? attribution.attributedOrders : null,
    funnel.status.state === "connected" ? funnel.sessions : null,
  );
  const currency = shopify.revenue?.currencyCode || "USD";
  const shopifySource =
    shopify.status.state === "connected"
      ? `Shopify · ${period.label}`
      : "Shopify · no data yet";
  const stapeSource =
    attribution.status.state === "connected"
      ? `Stape · ${period.label}`
      : "Stape · no data yet";
  const spendNote =
    totalSpend === null
      ? "Connect Meta or add spend in .env.local — we will not guess"
      : `${period.label} · first-party revenue ÷ spend`;

  return (
    <>
      <Header
        title="True Performance"
        description="First-party attribution from Stape + Shopify, compared with what ads platforms claim."
      />
      <section className="flex flex-1 flex-col gap-6 p-8">
        <ConnectionStatus
          shopify={shopify.status}
          stape={attribution.status}
          facebook={platform.facebook}
          google={platform.google}
        />
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
            label="New customer ROAS"
            source={spendNote}
            value={roasLabel(newCustomerRoas)}
          />
          <MetricCard
            label="Blended ROAS"
            source={
              totalSpend === null
                ? spendNote
                : `Stape attributed revenue ÷ spend · ${period.label}`
            }
            value={roasLabel(blendedRoas)}
          />
          <MetricCard
            label="MER"
            source={
              totalSpend === null
                ? spendNote
                : `Shopify revenue ÷ spend · ${period.label}`
            }
            value={roasLabel(mer)}
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
            label="Purchases stitched to a person"
            source="Shopify customer ID from Stape Data Client, matched to the browser"
            value={formatNumber(attribution.identity.purchasesWithPerson)}
          />
          <MetricCard
            label="People with more than one browser"
            source="Same customer with page views from more than one browser"
            value={formatNumber(attribution.identity.crossDevicePeople)}
          />
        </div>
        <PlatformCompareTable
          rows={compare}
          currencyCode={currency}
          facebookNote={
            platform.facebook.state === "connected"
              ? platform.facebook.message
              : platform.facebook.message
          }
          googleNote={platform.google.message}
        />
        {attribution.hasPurchaseEvents ? (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <ChannelContributionTable
                title="First-touch (orders)"
                description={`First real channel in the ${attribution.lookbackDays}-day path, using the person ID when we have it.`}
                rows={attribution.firstNonDirect}
                currencyCode={currency}
              />
              <ChannelContributionTable
                title="Last non-direct (orders)"
                description="Last real channel before checkout. This is the ‘real’ last-click, not the checkout page."
                rows={attribution.lastNonDirect}
                currencyCode={currency}
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <ChannelContributionTable
                title="Linear (multi-touch)"
                description="Each order’s revenue is split evenly across unique non-direct channels on that person’s path."
                rows={attribution.linear}
                currencyCode={currency}
              />
              <ChannelContributionTable
                title="New customer revenue by first-touch"
                description={`${formatNumber(matchedOrders)} Stape purchases matched to a Shopify order. New = first Shopify order for that customer.`}
                rows={newCustomerByChannel}
                currencyCode={currency}
              />
            </div>
            <ChannelContributionTable
              title="Raw last-click (usually Direct)"
              description="Crediting the purchase page itself. Shown so you can see why Shopify Direct is often wrong."
              rows={attribution.lastClick}
              currencyCode={currency}
            />
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
            "Real purchases use last non-direct Stape paths. Platform purchases are what Meta/Google take credit for.",
            "New customer ROAS = Shopify new-customer revenue ÷ ad spend. Blended ROAS uses Stape attributed revenue.",
            `Lookback is ${attribution.lookbackDays} days. Paths now follow the Shopify customer ID when Stape Data Client sent user_id on purchase.`,
            alignedShopify.guestOrders
              ? `${formatNumber(alignedShopify.guestOrders)} Shopify orders in this range have no customer record (guest checkout).`
              : "Shopify new vs returning uses number of orders on the customer (1 = new).",
          ]}
        />
        {attribution.gaps.length > 0 ? (
          <InfoPanel title="Data quality notes" items={attribution.gaps} />
        ) : null}
        <TrackingHealth fields={attribution.tracking} />
      </section>
    </>
  );
}
