import type { Metadata } from "next";
import Link from "next/link";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { ConversionFunnel } from "@/components/dashboard/ConversionFunnel";
import { DailyTrendChart } from "@/components/dashboard/DailyTrendChart";
import { DonutChart } from "@/components/dashboard/DonutChart";
import { HorizontalBarList } from "@/components/dashboard/HorizontalBarList";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { MismatchBanner } from "@/components/dashboard/MismatchBanner";
import { TopProductsPanel } from "@/components/dashboard/TopProductsPanel";
import { TruncationNotice } from "@/components/dashboard/TruncationNotice";
import { RevenueBreakdown } from "@/components/dashboard/RevenueBreakdown";
import { AskAiPanel } from "@/components/dashboard/AskAiPanel";
import { DailyCogsForm } from "@/components/dashboard/DailyCogsForm";
import { Header } from "@/components/layout/Header";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { getCoreDashboard } from "@/lib/dashboard/core-metrics";
import { blendedAdSpendSource } from "@/lib/metrics/source-lines";
import { pacificYesterdayYmd } from "@/lib/period";

export const metadata: Metadata = {
  title: "Overview",
};

function roasLabel(value: number | null) {
  return value === null ? null : `${value.toFixed(2)}x`;
}

export default async function OverviewPage() {
  const data = await getCoreDashboard();
  const {
    period,
    deltaLabel,
    shopify,
    funnel,
    alignedShopify,
    shopifyConnected,
    stapeConnected,
    currency,
    conversion,
    aov,
    totalSpend,
    unknown,
    mismatch,
    days,
    dailySessions,
    dailyPageviews,
    dailyOrders,
    feesAfter,
    profit,
    profitAfterCogs,
    cogsRange,
    cogsRecent,
    cogsSource,
    mer,
    blendedRoas,
    cpa,
    ncRoas,
    ncCac,
    profitRoasValue,
    profitRoasAfterCogs,
    beRoas,
    beCpa,
    ads,
    byChannel,
    deltas,
  } = data;

  const channelRevenue = byChannel.map((row) => ({
    label: row.channel,
    value: row.revenue,
  }));
  const channelOrders = byChannel.map((row) => ({
    label: row.channel,
    value: row.orders,
    secondary: formatMoney({ amount: row.revenue, currencyCode: currency }),
  }));

  const shopifySource = shopifyConnected
    ? `Shopify · ${period.label}`
    : "Shopify · no data yet";
  const stapeSource = stapeConnected
    ? `Stape · ${period.label}`
    : "Stape · no data yet";
  const conversionSource =
    conversion.rate === null
      ? conversion.note
      : `${conversion.note} · ${period.label}`;
  const spendSource = blendedAdSpendSource(ads, period.label);

  return (
    <>
      <Header
        title="Overview"
        description="Sales and funnel for the selected date range, using America/Los_Angeles calendar days."
      />
      <section className="dash-page gap-6">
        <ConnectionStatus shopify={shopify.status} stape={funnel.status} />
        <TruncationNotice
          truncated={shopify.truncated}
          fetched={alignedShopify.orders}
          reportedCount={shopify.reportedOrderCount}
        />
        <MismatchBanner mismatch={mismatch} currencyCode={currency} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Sessions"
            source={`${stapeSource} · same session definition as the funnel`}
            value={stapeConnected ? formatNumber(funnel.sessions) : null}
            delta={deltas.sessions}
            deltaLabel={deltaLabel}
            sparkline={dailySessions}
          />
          <MetricCard
            label="Users"
            source={`${stapeSource} · distinct client_id`}
            value={stapeConnected ? formatNumber(funnel.users) : null}
            delta={deltas.users}
            deltaLabel={deltaLabel}
          />
          <MetricCard
            label="Pageviews"
            source={`${stapeSource} · page_view events`}
            value={stapeConnected ? formatNumber(funnel.pageviews) : null}
            delta={deltas.pageviews}
            deltaLabel={deltaLabel}
            sparkline={dailyPageviews}
          />
          <MetricCard
            label="Shopify orders"
            source={shopifySource}
            value={shopifyConnected ? formatNumber(alignedShopify.orders) : null}
            delta={deltas.orders}
            deltaLabel={deltaLabel}
            sparkline={dailyOrders}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total revenue"
            source={`${shopifySource} · currentTotalPriceSet`}
            value={
              shopifyConnected
                ? formatMoney({
                    amount: alignedShopify.revenue,
                    currencyCode: currency,
                  })
                : null
            }
            delta={deltas.revenue}
            deltaLabel={deltaLabel}
          />
          <MetricCard
            label="Average Order Value"
            source={shopifySource}
            value={
              aov === null
                ? null
                : formatMoney({ amount: aov, currencyCode: currency })
            }
            delta={deltas.aov}
            deltaLabel={deltaLabel}
          />
          <MetricCard
            label="Conversion Rate"
            source={conversionSource}
            value={
              conversion.rate === null ? null : formatPercent(conversion.rate)
            }
            delta={deltas.conversion}
            deltaLabel={deltaLabel}
          />
          <MetricCard
            label="Gross revenue"
            source={`${shopifySource} · line items before discounts`}
            value={
              shopifyConnected
                ? formatMoney({
                    amount: alignedShopify.gross,
                    currencyCode: currency,
                  })
                : null
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
            label="MER"
            source={
              mer === null
                ? spendSource
                : `${period.label} · Shopify revenue ÷ blended ad spend`
            }
            value={mer === null ? null : `${mer.toFixed(2)}x`}
          />
          <MetricCard
            label="Blended ROAS"
            source={
              blendedRoas === null
                ? spendSource
                : `${period.label} · total revenue ÷ blended ad spend`
            }
            value={roasLabel(blendedRoas)}
          />
          <MetricCard
            label="Blended CPA"
            source={
              cpa === null
                ? spendSource
                : `${period.label} · spend ÷ Shopify orders with total > $0`
            }
            value={
              cpa === null
                ? null
                : formatMoney({ amount: cpa, currencyCode: currency })
            }
          />
        </div>
        <p className="text-xs leading-5 text-muted">
          Meta platform spend is{" "}
          {ads.facebook.spend === null
            ? "—"
            : formatMoney({ amount: ads.facebook.spend, currencyCode: currency })}
          {" · "}
          <Link prefetch={false} className="underline" href="/meta">
            Meta Ads
          </Link>
          {" · same warehouse numbers. First-touch stays "}
          <Link prefetch={false} className="underline" href="/attribution">
            gn_*
          </Link>
          . Google is paste, not a live API.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Net after fees"
            source={`${shopifySource} · total − Shopify Payments fees`}
            value={
              shopifyConnected
                ? formatMoney({ amount: feesAfter, currencyCode: currency })
                : null
            }
          />
          <MetricCard
            label="Pre-COGS contribution"
            source={
              profit === null
                ? "Needs ad spend for these dates · COGS/shipping not subtracted"
                : `${period.label} · total − fees − ad spend · Pre-COGS contribution · incomplete costs`
            }
            value={
              profit === null
                ? null
                : formatMoney({ amount: profit, currencyCode: currency })
            }
          />
          <MetricCard
            label="Profit after COGS"
            source={
              !cogsRange.complete
                ? cogsSource
                : profitAfterCogs === null
                  ? `Needs ad spend for these dates · ${cogsSource}`
                  : `${period.label} · total − fees − ad spend − ${cogsSource}`
            }
            value={
              cogsRange.complete && profitAfterCogs !== null
                ? formatMoney({ amount: profitAfterCogs, currencyCode: currency })
                : null
            }
          />
          <MetricCard
            label="New-customer orders"
            source={`${shopifySource} · numberOfOrders ≤ 1`}
            value={
              shopifyConnected
                ? formatNumber(alignedShopify.newCustomerOrders)
                : null
            }
            delta={deltas.newCustomerOrders}
            deltaLabel={deltaLabel}
          />
          <MetricCard
            label="New-customer revenue"
            source={shopifySource}
            value={
              shopifyConnected
                ? formatMoney({
                    amount: alignedShopify.newCustomerRevenue,
                    currencyCode: currency,
                  })
                : null
            }
            delta={deltas.newCustomerRevenue}
            deltaLabel={deltaLabel}
          />
        </div>
        <DailyCogsForm
          defaultDate={pacificYesterdayYmd()}
          recent={cogsRecent}
          currencyCode={currency}
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="New-customer ROAS"
            source={
              ncRoas === null
                ? spendSource
                : `${period.label} · new-customer revenue ÷ blended ad spend`
            }
            value={roasLabel(ncRoas)}
          />
          <MetricCard
            label="New-customer CAC"
            source={
              ncCac === null
                ? spendSource
                : `${period.label} · blended ad spend ÷ Shopify new-customer orders`
            }
            value={
              ncCac === null
                ? null
                : formatMoney({ amount: ncCac, currencyCode: currency })
            }
          />
          <MetricCard
            label="Profit ROAS"
            source={
              profitRoasValue === null
                ? "Needs ad spend · Pre-COGS contribution ÷ spend"
                : `${period.label} · Pre-COGS contribution ÷ blended ad spend · COGS not subtracted`
            }
            value={roasLabel(profitRoasValue)}
          />
          <MetricCard
            label="Profit ROAS after COGS"
            source={
              !cogsRange.complete
                ? cogsSource
                : profitRoasAfterCogs === null
                  ? `Needs ad spend · ${cogsSource}`
                  : `${period.label} · profit after COGS ÷ blended ad spend`
            }
            value={
              cogsRange.complete ? roasLabel(profitRoasAfterCogs) : null
            }
          />
          <MetricCard
            label="Break-even ROAS"
            source={
              beRoas === null
                ? cogsRange.complete
                  ? "Needs a positive contribution margin after COGS"
                  : "Needs a positive contribution margin (no COGS until ledger is complete)"
                : cogsRange.complete
                  ? "1 ÷ contribution margin after COGS"
                  : "1 ÷ contribution margin (fees + ad spend, no COGS)"
            }
            value={roasLabel(beRoas)}
          />
          <MetricCard
            label="Break-even CPA"
            source={
              beCpa === null
                ? "AOV × contribution margin % · needs positive margin"
                : "Most you can pay per order before contribution turns negative"
            }
            value={
              beCpa === null
                ? null
                : formatMoney({ amount: beCpa, currencyCode: currency })
            }
          />
          <MetricCard
            label="Unknown first-touch orders"
            source={`${shopifySource} · missing gn_* · often Shop Pay`}
            value={shopifyConnected ? formatNumber(unknown.orders) : null}
          />
          <MetricCard
            label="Unknown first-touch revenue"
            source={shopifySource}
            value={
              shopifyConnected
                ? formatMoney({ amount: unknown.revenue, currencyCode: currency })
                : null
            }
          />
          <MetricCard
            label="Unknown % of orders"
            source="Missing gn_* ÷ Shopify orders"
            value={
              unknown.orderShare === null
                ? null
                : formatPercent(unknown.orderShare)
            }
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Processing fees"
            source={
              alignedShopify.processingFees === null
                ? "Shopify Payments fees on successful sale/capture · none in this range"
                : `${shopifySource} · Shopify Payments sale/capture only`
            }
            value={
              shopifyConnected && alignedShopify.processingFees !== null
                ? formatMoney({
                    amount: alignedShopify.processingFees,
                    currencyCode: currency,
                  })
                : null
            }
          />
          <MetricCard
            label="Refund fees"
            source={
              alignedShopify.refundFees === null
                ? "Shopify Payments fees on successful refunds · none in this range"
                : `${shopifySource} · Shopify Payments refunds only`
            }
            value={
              shopifyConnected && alignedShopify.refundFees !== null
                ? formatMoney({
                    amount: alignedShopify.refundFees,
                    currencyCode: currency,
                  })
                : null
            }
          />
          <MetricCard
            label="Stape purchases"
            source={stapeSource}
            value={stapeConnected ? formatNumber(funnel.purchases) : null}
          />
          <MetricCard
            label="Stape purchase revenue"
            source={stapeSource}
            value={
              stapeConnected
                ? formatMoney({
                    amount: funnel.purchaseRevenue,
                    currencyCode: currency,
                  })
                : null
            }
          />
        </div>
        <DailyTrendChart
          title="Daily sessions and orders"
          description="Pacific calendar days for the header range. Sessions are Stape. Orders are Shopify. Not first-touch."
          days={days}
          seriesA={{ label: "Stape sessions", values: dailySessions }}
          seriesB={{
            label: "Shopify orders",
            values: dailyOrders,
          }}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <DonutChart
            title="Revenue by first-touch channel"
            description="Shopify gn_* first-touch · selected range"
            slices={channelRevenue}
            currencyCode={currency}
            emptyLabel="Channel revenue appears once Shopify orders carry gn_* attribution."
          />
          <HorizontalBarList
            title="Orders by first-touch channel"
            description="Shopify gn_* first-touch · selected range"
            rows={channelOrders}
            emptyLabel="Channel orders appear once Shopify orders carry gn_* attribution."
          />
        </div>
        {shopifyConnected ? (
          <RevenueBreakdown
            periodLabel={period.label}
            currencyCode={currency}
            gross={alignedShopify.gross}
            subtotal={alignedShopify.subtotal}
            discounts={alignedShopify.discounts}
            shipping={alignedShopify.shipping}
            tax={alignedShopify.tax}
            refunded={alignedShopify.refunded}
            total={alignedShopify.revenue}
            processingFees={alignedShopify.processingFees}
            refundFees={alignedShopify.refundFees}
            adSpend={ads.totalSpend}
            cogs={cogsRange.cogsForRange}
            cogsComplete={cogsRange.complete}
            missingCogsDates={cogsRange.missingDates}
            cogsSource={cogsSource}
            profitAfterCogs={profitAfterCogs}
          />
        ) : null}
        <ConversionFunnel
          steps={funnel.steps}
          periodLabel={period.label}
          shopifyOrders={shopifyConnected ? alignedShopify.orders : null}
        />
        <TopProductsPanel products={shopify.topProducts} />
        <AskAiPanel viewContext={`Overview · ${period.label}`} compact />
      </section>
    </>
  );
}
