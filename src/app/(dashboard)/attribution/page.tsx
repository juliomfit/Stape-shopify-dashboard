import type { Metadata } from "next";
import { AttributionSourceTable } from "@/components/dashboard/AttributionSourceTable";
import { CampaignSpendTable } from "@/components/dashboard/CampaignSpendTable";
import { ChannelContributionTable } from "@/components/dashboard/ChannelContributionTable";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
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
import { blendedAdSpendSource, firstTouchSourceLine } from "@/lib/metrics/source-lines";
import { getGa4Snapshot } from "@/lib/ads/ga4-query";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "First-touch attribution",
};

function roasLabel(value: number | null) {
  return value === null ? null : `${value.toFixed(2)}x`;
}

export default async function AttributionPage() {
  const [data, ga4] = await Promise.all([
    getTruePerformance(),
    getGa4Snapshot().catch(() => null),
  ]);
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
    shopifySources,
    shopifySourceMedium,
    shopifyCampaigns,
    sourceMediumSpendNote,
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
      ? firstTouchSourceLine(period.label)
      : "Shopify · no data yet";
  const spendMissing =
    totalSpend === null
      ? blendedAdSpendSource(platform, period.label)
      : null;
  const spendSource = blendedAdSpendSource(platform, period.label);
  const roasNote =
    spendMissing ?? `${period.label} · total revenue ÷ blended ad spend`;
  const merNote =
    spendMissing ?? `${period.label} · Shopify revenue ÷ blended ad spend (MER)`;
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
        title="First-touch attribution"
        description="Cart gn_* first-touch written on the Shopify order. This is one model, not the singular true answer. Multi-touch lives under Attribution. Stape is a comparison only."
      />
      <section className="dash-page gap-6">
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
            label="Ad spend"
            source={spendSource}
            value={
              totalSpend === null
                ? null
                : formatMoney({ amount: totalSpend, currencyCode: currency })
            }
          />
          <MetricCard
            label="Blended ROAS"
            source={roasNote}
            value={roasLabel(blendedRoas)}
          />
          <MetricCard
            label="MER"
            source={merNote}
            value={mer === null ? null : `${mer.toFixed(2)}x`}
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
                ? `Needs Meta ${spendSource} plus gn_* Facebook first-touch`
                : `gn_* Facebook revenue ÷ Meta platform spend · not Ads Manager ROAS`
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
        <AttributionSourceTable
          currencyCode={currency}
          periodLabel={period.label}
          byChannel={shopifyFirstTouch}
          bySource={shopifySources}
          bySourceMedium={shopifySourceMedium}
          byCampaign={shopifyCampaigns}
          sourceMediumSpendNote={sourceMediumSpendNote}
        />
        <PlatformCompareTable
          rows={compare}
          currencyCode={currency}
          facebookNote={platform.facebook.message}
          googleNote={platform.google.message}
        />
        {ga4 ? (
          <article className="rounded-2xl border border-dashed border-border bg-surface/60 p-6">
            <h2 className="text-sm font-semibold text-foreground">
              GA4 session source / medium (not gn_*)
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              Google Analytics last-click-style session source. Do not use this instead of
              First-touch above. Property {ga4.propertyId || "unset"}
              {ga4.streamId ? ` · stream ${ga4.streamId}` : ""}.
            </p>
            {ga4.sources.length === 0 ? (
              <p className="mt-4 text-sm text-muted">
                No GA4 source rows. Refresh GA4 for this header range.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted">
                      <th className="pb-2 pr-3 font-medium">Source</th>
                      <th className="pb-2 pr-3 font-medium">Medium</th>
                      <th className="pb-2 pr-3 font-medium">Sessions</th>
                      <th className="pb-2 pr-3 font-medium">Purchases</th>
                      <th className="pb-2 font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ga4.sources.map((row) => (
                      <tr
                        key={`${row.source}/${row.medium}/${row.campaign}`}
                        className="border-b border-border"
                      >
                        <td className="py-2 pr-3 font-medium text-foreground">{row.source}</td>
                        <td className="py-2 pr-3 text-muted">{row.medium}</td>
                        <td className="py-2 pr-3 text-muted">{formatNumber(row.sessions)}</td>
                        <td className="py-2 pr-3 text-muted">{formatNumber(row.purchases)}</td>
                        <td className="py-2 text-muted">
                          {formatMoney({
                            amount: row.purchaseRevenue,
                            currencyCode: currency,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        ) : null}
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
              description="Linear split across eligible touches (including Direct)"
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
            "Trust Shopify gn_* first-touch. The Source tab is the raw utm_source on the order (sendvio, klaviyo, or any new tag). It is not a dashboard allowlist.",
            "GA4 source / medium is Google Analytics. It is a comparison only. Trust gn_* for first-touch attribution.",
            "Channel Email is a bucket for email/SMS mediums and known ESPs. A new ESP with utm_medium=email still gets its own Source row.",
            "Unknown means the stitch did not write gn_*. Direct means gn_* ran with no source. They are not the same.",
            "Platform vs real uses gn_* Facebook/Google orders vs Ads Manager claimed purchases.",
            "ROAS = total revenue ÷ blended ad spend. MER is the same ratio, labeled MER (e.g. 2.5). Marketing cost ratio is spend ÷ revenue (e.g. 40%). They are not interchangeable names.",
            "Row ROAS / CPA only when that row has real Meta or Google spend for these dates. Account spend is not split across multiple source/medium rows.",
            "Paste Meta Amount spent or upload an Ads Manager CSV for the same dates as the header toggle. Campaign ROAS needs campaign rows in the CSV.",
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
