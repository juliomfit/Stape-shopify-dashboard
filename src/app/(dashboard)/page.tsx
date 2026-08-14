import type { Metadata } from "next";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { ConversionFunnel } from "@/components/dashboard/ConversionFunnel";
import { DailyTrendChart } from "@/components/dashboard/DailyTrendChart";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { MismatchBanner } from "@/components/dashboard/MismatchBanner";
import { TopProductsPanel } from "@/components/dashboard/TopProductsPanel";
import { TruncationNotice } from "@/components/dashboard/TruncationNotice";
import { RevenueBreakdown } from "@/components/dashboard/RevenueBreakdown";
import { Header } from "@/components/layout/Header";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { getCoreDashboard } from "@/lib/dashboard/core-metrics";

export const dynamic = "force-dynamic";

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
    mer,
    blendedRoas,
    cpa,
    ncRoas,
    ads,
    deltas,
  } = data;
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
  const spendSource =
    totalSpend === null
      ? "No ad spend saved for these dates"
      : `Meta + Google · ${period.label}`;

  return (
    <>
      <Header
        title="Overview"
        description="Pacific calendar days. Revenue and orders are Shopify. Sessions are Stape."
      />
      <section className="flex flex-1 flex-col gap-5 p-6">
        <ConnectionStatus shopify={shopify.status} stape={funnel.status} />
        <TruncationNotice
          truncated={shopify.truncated}
          fetched={alignedShopify.orders}
          reportedCount={shopify.reportedOrderCount}
        />
        <MismatchBanner mismatch={mismatch} currencyCode={currency} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total revenue"
            source={shopifySource}
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
            label="Shopify orders"
            source={shopifySource}
            value={shopifyConnected ? formatNumber(alignedShopify.orders) : null}
            delta={deltas.orders}
            deltaLabel={deltaLabel}
            sparkline={dailyOrders}
          />
          <MetricCard
            label="Sessions"
            source={stapeSource}
            value={stapeConnected ? formatNumber(funnel.sessions) : null}
            delta={deltas.sessions}
            deltaLabel={deltaLabel}
            sparkline={dailySessions}
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
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
            source={
              blendedRoas === null
                ? spendSource
                : `${period.label} · revenue ÷ spend`
            }
            value={roasLabel(blendedRoas)}
          />
          <MetricCard
            label="MER"
            source={
              mer === null ? spendSource : `${period.label} · spend ÷ revenue`
            }
            value={mer === null ? null : formatPercent(mer)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Users"
            source={stapeSource}
            value={stapeConnected ? formatNumber(funnel.users) : null}
            delta={deltas.users}
            deltaLabel={deltaLabel}
          />
          <MetricCard
            label="Pageviews"
            source={stapeSource}
            value={stapeConnected ? formatNumber(funnel.pageviews) : null}
            delta={deltas.pageviews}
            deltaLabel={deltaLabel}
            sparkline={dailyPageviews}
          />
          <MetricCard
            label="Unknown first-touch"
            source="Missing gn_* · often Shop Pay"
            value={
              shopifyConnected
                ? `${formatNumber(unknown.orders)} · ${
                    unknown.orderShare === null
                      ? "—"
                      : formatPercent(unknown.orderShare)
                  }`
                : null
            }
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Blended CPA"
            source={
              cpa === null
                ? spendSource
                : `${period.label} · spend ÷ paid orders`
            }
            value={
              cpa === null
                ? null
                : formatMoney({ amount: cpa, currencyCode: currency })
            }
          />
          <MetricCard
            label="Net after fees"
            source="Total − Shopify Payments fees"
            value={
              shopifyConnected
                ? formatMoney({ amount: feesAfter, currencyCode: currency })
                : null
            }
          />
          <MetricCard
            label="Net profit"
            source={
              profit === null
                ? "Needs ad spend · no COGS"
                : "Total − fees − spend · no COGS"
            }
            value={
              profit === null
                ? null
                : formatMoney({ amount: profit, currencyCode: currency })
            }
          />
          <MetricCard
            label="New-customer ROAS"
            source={
              ncRoas === null
                ? spendSource
                : "New-customer revenue ÷ spend"
            }
            value={roasLabel(ncRoas)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Gross revenue"
            source="Line items before discounts"
            value={
              shopifyConnected
                ? formatMoney({
                    amount: alignedShopify.gross,
                    currencyCode: currency,
                  })
                : null
            }
          />
          <MetricCard
            label="New-customer orders"
            source={shopifySource}
            value={
              shopifyConnected
                ? formatNumber(alignedShopify.newCustomerOrders)
                : null
            }
            delta={deltas.newCustomerOrders}
            deltaLabel={deltaLabel}
          />
          <MetricCard
            label="Processing fees"
            source={
              alignedShopify.processingFees === null
                ? "None in this range"
                : "Shopify Payments sale/capture"
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
                ? "None in this range"
                : "Shopify Payments refunds"
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
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
          />
        ) : null}
        <ConversionFunnel
          steps={funnel.steps}
          periodLabel={period.label}
          shopifyOrders={shopifyConnected ? alignedShopify.orders : null}
        />
        <TopProductsPanel products={shopify.topProducts} />
      </section>
    </>
  );
}
