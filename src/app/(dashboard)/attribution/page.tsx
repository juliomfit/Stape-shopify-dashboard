import type { Metadata } from "next";
import { CampaignSpendTable } from "@/components/dashboard/CampaignSpendTable";
import { ChannelContributionTable } from "@/components/dashboard/ChannelContributionTable";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { FirstTouchRollupTable } from "@/components/dashboard/FirstTouchRollupTable";
import { InfoPanel } from "@/components/dashboard/InfoPanel";
import { MetaSyncPanel } from "@/components/dashboard/MetaSyncPanel";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { MismatchBanner } from "@/components/dashboard/MismatchBanner";
import { PlatformCompareTable } from "@/components/dashboard/PlatformCompareTable";
import { SpendCoveragePanel } from "@/components/dashboard/SpendCoveragePanel";
import { TrackingHealth } from "@/components/dashboard/TrackingHealth";
import { TrafficSourcesPanel } from "@/components/dashboard/TrafficSourcesPanel";
import { TruncationNotice } from "@/components/dashboard/TruncationNotice";
import { Header } from "@/components/layout/Header";
import { getTruePerformance } from "@/lib/dashboard/true-performance";
import { getConversionRate } from "@/lib/dashboard/conversion";
import { shopifyStapeMismatch, unknownFirstTouch } from "@/lib/dashboard/kpis";
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
    totalSpend,
    mer,
    newCustomerRoas,
    blendedRoas,
    blendedCpa,
    campaignSpendCompare,
    spendCoverage,
    facebookRoas,
    googleRoas,
    facebookNewCustomerRoas,
    googleNewCustomerRoas,
    compare,
    shopifyFirstTouch,
    shopifyCampaigns,
    metaConnection,
    metaPaste,
    googlePaste,
  } = data;
  const conversion = getConversionRate(
    shopify.status.state === "connected" ? alignedShopify.orders : null,
    funnel.status.state === "connected" ? funnel.sessions : null,
  );
  const currency = shopify.revenue?.currencyCode || "USD";
  const shopifySource =
    shopify.status.state === "connected"
      ? `Shopify gn_* · ${period.label}`
      : "Shopify · no data yet";
  const spendMissing =
    totalSpend === null
      ? "Paste ad spend for this date range — we will not guess"
      : null;
  const roasNote =
    spendMissing ?? `${period.label} · total revenue ÷ blended ad spend`;
  const merNote =
    spendMissing ?? `${period.label} · blended ad spend ÷ total revenue`;
  const unknown = unknownFirstTouch(
    shopify.orderPoints.filter((order) => {
      const created = new Date(order.createdAt).getTime();
      return created >= period.startMs && created < period.endMs;
    }),
  );
  const mismatch = shopifyStapeMismatch({
    shopifyConnected: shopify.status.state === "connected",
    stapeConnected: funnel.status.state === "connected",
    shopifyOrders: alignedShopify.orders,
    shopifyRevenue: alignedShopify.revenue,
    stapePurchases: funnel.purchases,
    stapeRevenue: funnel.purchaseRevenue,
  });

  return (
    <>
      <Header
        title="True Performance"
        description="First-touch is the gn_* cart attribute written on the Shopify order. Stape is a comparison only."
      />
      <section className="flex flex-1 flex-col gap-6 p-8">
        <ConnectionStatus
          shopify={shopify.status}
          stape={attribution.status}
          facebook={platform.facebook}
          google={platform.google}
        />
        <TruncationNotice
          truncated={shopify.truncated}
          fetched={alignedShopify.orders}
          reportedCount={shopify.reportedOrderCount}
        />
        <MismatchBanner mismatch={mismatch} currencyCode={currency} />
        <MetaSyncPanel
          connection={metaConnection}
          periodLabel={period.label}
          startDate={period.startDate}
          endDate={period.endDate}
          paste={metaPaste}
          googlePaste={googlePaste}
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total revenue"
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
            label="True conversion rate"
            source={
              conversion.rate === null
                ? conversion.note
                : `Shopify orders ÷ Stape sessions · ${period.label}`
            }
            value={
              conversion.rate === null ? null : formatPercent(conversion.rate)
            }
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Blended ROAS"
            source={roasNote}
            value={roasLabel(blendedRoas)}
          />
          <MetricCard
            label="MER"
            source={merNote}
            value={mer === null ? null : formatPercent(mer)}
          />
          <MetricCard
            label="Blended CPA"
            source={
              blendedCpa === null
                ? spendMissing ?? "Needs spend and paid Shopify orders"
                : `${period.label} · spend ÷ orders with total > $0`
            }
            value={
              blendedCpa === null
                ? null
                : formatMoney({ amount: blendedCpa, currencyCode: currency })
            }
          />
          <MetricCard
            label="Meta ROAS"
            source={
              facebookRoas === null
                ? "Needs Meta spend + gn_* Facebook first-touch"
                : "gn_* Facebook revenue ÷ Meta spend"
            }
            value={roasLabel(facebookRoas)}
          />
          <MetricCard
            label="Google ROAS"
            source={
              googleRoas === null
                ? "Needs Google spend + gn_* Google Ads first-touch"
                : "gn_* Google Ads revenue ÷ Google spend"
            }
            value={roasLabel(googleRoas)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="New customer ROAS"
            source={roasNote}
            value={roasLabel(newCustomerRoas)}
          />
          <MetricCard
            label="Meta new-customer ROAS"
            source={
              facebookNewCustomerRoas === null
                ? "Needs Meta spend"
                : "New-customer Facebook gn_* revenue ÷ Meta spend"
            }
            value={roasLabel(facebookNewCustomerRoas)}
          />
          <MetricCard
            label="Google new-customer ROAS"
            source={
              googleNewCustomerRoas === null
                ? "Needs Google spend"
                : "New-customer Google gn_* revenue ÷ Google spend"
            }
            value={roasLabel(googleNewCustomerRoas)}
          />
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
            label="Unknown first-touch orders"
            source={`${shopifySource} · missing gn_*`}
            value={
              shopify.status.state === "connected"
                ? formatNumber(unknown.orders)
                : null
            }
          />
          <MetricCard
            label="Unknown first-touch revenue"
            source="Not counted as Direct"
            value={
              shopify.status.state === "connected"
                ? formatMoney({ amount: unknown.revenue, currencyCode: currency })
                : null
            }
          />
          <MetricCard
            label="Unknown % of orders"
            source="Missing gn_* ÷ Shopify orders"
            value={
              unknown.orderShare === null ? null : formatPercent(unknown.orderShare)
            }
          />
        </div>
        <PlatformCompareTable
          rows={compare}
          currencyCode={currency}
          facebookNote={platform.facebook.message}
          googleNote={platform.google.message}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <FirstTouchRollupTable
            title="First-touch channel (gn_*)"
            description="Source of truth. Written once on the cart. Unknown means the script did not run. ROAS fills in when that channel has spend."
            rows={shopifyFirstTouch}
            currencyCode={currency}
          />
          <FirstTouchRollupTable
            title="First-touch campaign (gn_utm_campaign)"
            description="Same orders, grouped by campaign on the order."
            rows={shopifyCampaigns}
            currencyCode={currency}
          />
        </div>
        <section className="rounded-2xl border border-dashed border-border bg-surface/60 p-6">
          <h2 className="text-sm font-semibold text-foreground">
            Stape comparison (not the source of truth)
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            Reconstructed from BigQuery page URLs. Use this when it disagrees
            with gn_* to debug tracking, not to pick a winner for media.
          </p>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <ChannelContributionTable
              title="Stape first-touch"
              description={`${attribution.lookbackDays}-day browser path`}
              rows={attribution.firstNonDirect}
              currencyCode={currency}
            />
            <ChannelContributionTable
              title="Stape last non-direct"
              description="Last real channel before checkout"
              rows={attribution.lastNonDirect}
              currencyCode={currency}
            />
            <ChannelContributionTable
              title="Stape linear"
              description="Even split across assisting channels"
              rows={attribution.linear}
              currencyCode={currency}
            />
            <TrafficSourcesPanel
              title="Stape sessions"
              sources={attribution.firstTouch}
              periodLabel={period.label}
              description={`Session first hit · ${period.label}`}
            />
          </div>
        </section>
        <InfoPanel
          title="How to read this"
          items={[
            "Trust Shopify gn_* first-touch for which channel gets the order.",
            "Platform vs real uses gn_* Facebook/Google orders vs Ads Manager claimed purchases.",
            "ROAS = total revenue ÷ blended ad spend. MER is the inverse: blended ad spend ÷ total revenue (currentTotalPriceSet). They are not the same number.",
            "Channel ROAS = gn_* channel revenue ÷ that channel’s spend. New-customer ROAS uses only first-time Shopify customers.",
            "Paste Meta Amount spent or upload an Ads Manager CSV for the same dates as the header toggle. Facebook will not connect without an app they control.",
            alignedShopify.guestOrders
              ? `${formatNumber(alignedShopify.guestOrders)} Shopify orders in this range have no customer record (guest checkout).`
              : "No guest checkouts in this range.",
            "New vs returning here is order grain (new-customer orders). Customers counts unique people with 1 lifetime order — those numbers will not match.",
          ]}
        />
        {attribution.gaps.length > 0 ? (
          <InfoPanel title="Stape data notes" items={attribution.gaps} />
        ) : null}
        {campaignSpendCompare ? (
          <CampaignSpendTable
            rows={campaignSpendCompare}
            currencyCode={currency}
            periodLabel={period.label}
          />
        ) : (
          <p className="text-xs leading-5 text-muted">
            Campaign spend vs gn_utm_campaign appears when an Ads Manager CSV
            includes campaign rows. Account-total paste stays blended only.
          </p>
        )}
        <SpendCoveragePanel
          rows={spendCoverage}
          currentStart={period.startDate}
          currentEnd={period.endDate}
        />
        <TrackingHealth fields={attribution.tracking} />
      </section>
    </>
  );
}
