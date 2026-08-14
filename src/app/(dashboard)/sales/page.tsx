import type { Metadata } from "next";
import { AttributionSourceTable } from "@/components/dashboard/AttributionSourceTable";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { ExportCsvButton } from "@/components/dashboard/ExportCsvButton";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { MismatchBanner } from "@/components/dashboard/MismatchBanner";
import { OrdersTable } from "@/components/dashboard/OrdersTable";
import { TruncationNotice } from "@/components/dashboard/TruncationNotice";
import { RevenueBreakdown } from "@/components/dashboard/RevenueBreakdown";
import { Header } from "@/components/layout/Header";
import { getCoreDashboard } from "@/lib/dashboard/core-metrics";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { clickIdLabel } from "@/lib/shopify/first-touch";
import { matchesJourneyFilter } from "@/lib/shopify/compare";
import { mismatchLabel } from "@/lib/shopify/journey";
import { SalesJourneyFilter } from "@/components/dashboard/SalesJourneyFilter";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sales",
};

type PageProps = {
  searchParams?: Promise<{ filter?: string }>;
};

export default async function SalesPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const filter = params.filter || "";
  const data = await getCoreDashboard();
  const {
    period,
    shopify,
    funnel,
    alignedShopify,
    shopifyConnected,
    stapeConnected,
    currency,
    aov,
    unknown,
    mismatch,
    ads,
    byChannel,
    bySourceMedium,
    byCampaign,
    sourceMediumNote,
    inRange,
    totalSpend,
    cpa,
  } = data;
  const shopifySource = shopifyConnected
    ? `Shopify · ${period.label}`
    : "Shopify · no data yet";
  const stapeSource = stapeConnected
    ? `Stape · ${period.label}`
    : "Stape · no data yet";
  const unitsSold = shopify.products.reduce(
    (total, product) => total + product.quantity,
    0,
  );
  const inRangeIds = new Set(inRange.map((order) => order.legacyId));
  const tableOrders = shopify.recentOrders.filter((order) =>
    inRangeIds.has(order.legacyId),
  ).filter((order) => matchesJourneyFilter(order.journeyMismatch, filter));
  const spendSource =
    totalSpend === null
      ? "No ad spend saved for these dates"
      : `Meta + Google · ${period.label}`;

  return (
    <>
      <Header
        title="Sales"
        description="Shopify orders with first-touch from storefront gn_* cart attributes — not Shopify session."
      />
      <section className="flex flex-1 flex-col gap-6 p-8">
        <ConnectionStatus shopify={shopify.status} stape={funnel.status} />
        <TruncationNotice
          truncated={shopify.truncated}
          fetched={alignedShopify.orders}
          reportedCount={shopify.reportedOrderCount}
        />
        <MismatchBanner mismatch={mismatch} currencyCode={currency} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          />
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
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Shopify orders"
            source={shopifySource}
            value={shopifyConnected ? formatNumber(alignedShopify.orders) : null}
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
          <MetricCard
            label="Stape purchases"
            source={stapeSource}
            value={stapeConnected ? formatNumber(funnel.purchases) : null}
          />
          <MetricCard
            label="Blended CPA"
            source={
              cpa === null
                ? spendSource
                : `${period.label} · spend ÷ orders with total > $0`
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
            label="Average Order Value"
            source={shopifySource}
            value={
              aov === null
                ? null
                : formatMoney({
                    amount: aov,
                    currencyCode: currency,
                  })
            }
          />
          <MetricCard
            label="Units sold"
            source={shopifySource}
            value={shopifyConnected ? formatNumber(unitsSold) : null}
          />
          <MetricCard
            label="Unknown first-touch orders"
            source={`${shopifySource} · missing gn_*`}
            value={shopifyConnected ? formatNumber(unknown.orders) : null}
          />
          <MetricCard
            label="Unknown % of orders"
            source="Often Shop Pay Express — not fake Direct"
            value={
              unknown.orderShare === null
                ? null
                : formatPercent(unknown.orderShare)
            }
          />
        </div>
        {unknown.orders > 0 ? (
          <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm leading-6 text-muted">
            {formatNumber(unknown.orders)} orders ({unknown.orderShare === null ? "—" : formatPercent(unknown.orderShare)})
            and{" "}
            {formatMoney({ amount: unknown.revenue, currencyCode: currency })} are
            Unknown first-touch because gn_* was missing on the Shopify order.
          </p>
        ) : null}
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
        <div className="flex flex-wrap items-end gap-4">
          <Suspense fallback={null}>
            <SalesJourneyFilter filter={filter} />
          </Suspense>
          <ExportCsvButton
            label="Export orders CSV"
            filename={`sales-orders-${period.startDate}-${period.endDate}.csv`}
            headers={[
              "Order",
              "Date",
              "gn_* first-touch",
              "Shopify first-click",
              "Mismatch",
              "Campaign",
              "Click ID",
              "Gross",
              "Total",
              "Fees",
            ]}
            rows={tableOrders.map((order) => [
              order.name,
              order.createdAt,
              order.firstTouchChannel,
              order.journey?.firstClick.label || "",
              mismatchLabel(order.journeyMismatch),
              order.firstTouch.utmCampaign,
              clickIdLabel(order.firstTouch),
              order.gross.amount,
              order.total.amount,
              order.processingFees?.amount ?? "",
            ])}
          />
          <ExportCsvButton
            label="Export first-touch CSV"
            filename={`sales-first-touch-${period.startDate}-${period.endDate}.csv`}
            headers={["Source", "Medium", "Orders", "Revenue", "New-customer orders"]}
            rows={byChannel.map((row) => [
              row.source,
              row.medium,
              row.orders,
              row.revenue,
              row.newCustomerOrders,
            ])}
          />
        </div>
        <AttributionSourceTable
          currencyCode={currency}
          periodLabel={period.label}
          byChannel={byChannel}
          bySourceMedium={bySourceMedium}
          byCampaign={byCampaign}
          sourceMediumSpendNote={sourceMediumNote}
        />
        <OrdersTable
          orders={tableOrders}
          periodLabel={period.label}
          connected={shopifyConnected}
        />
      </section>
    </>
  );
}
