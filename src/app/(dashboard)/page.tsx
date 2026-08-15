import type { Metadata } from "next";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { ConversionFunnel } from "@/components/dashboard/ConversionFunnel";
import { DailyTrendChart } from "@/components/dashboard/DailyTrendChart";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { MismatchBanner } from "@/components/dashboard/MismatchBanner";
import { TopProductsPanel } from "@/components/dashboard/TopProductsPanel";
import { TruncationNotice } from "@/components/dashboard/TruncationNotice";
import { RevenueBreakdown } from "@/components/dashboard/RevenueBreakdown";
import { DataHealthStrip } from "@/components/dashboard/DataHealthStrip";
import { NeedsAttention } from "@/components/dashboard/NeedsAttention";
import { AskAiPanel } from "@/components/dashboard/AskAiPanel";
import { Header } from "@/components/layout/Header";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { getCoreDashboard } from "@/lib/dashboard/core-metrics";
import { getDataHealth } from "@/lib/platform/health";
import { computeAnomalies } from "@/lib/platform/anomalies";
import { getCampaignFacts, totalsFromFacts } from "@/lib/ads/meta-query";

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

  let health: Awaited<ReturnType<typeof getDataHealth>> = [];
  try {
    health = await getDataHealth();
  } catch {
    health = [];
  }

  let anomalies: ReturnType<typeof computeAnomalies> = [];
  try {
    const [metaNowFacts, metaPrevFacts] = await Promise.all([
      getCampaignFacts(period),
      getCampaignFacts(data.previous),
    ]);
    const metaNow = totalsFromFacts(metaNowFacts);
    const metaPrev = totalsFromFacts(metaPrevFacts);
    anomalies = computeAnomalies({
      revenue: shopifyConnected ? alignedShopify.revenue : null,
      previousRevenue:
        data.previousShopify.status.state === "connected"
          ? data.previousAligned.revenue
          : null,
      orders: shopifyConnected ? alignedShopify.orders : null,
      previousOrders:
        data.previousShopify.status.state === "connected"
          ? data.previousAligned.orders
          : null,
      spend: totalSpend,
      previousSpend: null,
      mer,
      previousMer: null,
      cpa,
      previousCpa: null,
      conversion: conversion.rate,
      previousConversion: data.previousConversion.rate,
      metaCpa: metaNow.cpa,
      previousMetaCpa: metaPrev.cpa,
    });
  } catch {
    anomalies = [];
  }
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
        description="Sales and funnel for the selected date range, using America/Los_Angeles calendar days."
      />
      <section className="flex flex-1 flex-col gap-6 p-8">
        <ConnectionStatus shopify={shopify.status} stape={funnel.status} />
        <DataHealthStrip sources={health} />
        <NeedsAttention anomalies={anomalies} />
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
                : `${period.label} · blended ad spend ÷ total revenue`
            }
            value={mer === null ? null : formatPercent(mer)}
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
            label="Contribution profit"
            source={
              profit === null
                ? "Needs ad spend for these dates · COGS not subtracted"
                : `${period.label} · total − fees − ad spend · not net profit (no COGS)`
            }
            value={
              profit === null
                ? null
                : formatMoney({ amount: profit, currencyCode: currency })
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
        <AskAiPanel viewContext={`Overview · ${period.label}`} compact />
      </section>
    </>
  );
}
