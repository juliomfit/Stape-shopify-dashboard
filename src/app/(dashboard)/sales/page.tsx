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
import { blendedAdSpendSource } from "@/lib/metrics/source-lines";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sales",
};

function roasLabel(value: number | null) {
  return value === null ? null : `${value.toFixed(2)}x`;
}

export default async function SalesPage() {
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
    bySource,
    bySourceMedium,
    byCampaign,
    sourceMediumNote,
    inRange,
    cpa,
    profit,
    profitAfterCogs,
    profitRoasValue,
    profitRoasAfterCogs,
    beRoas,
    beCpa,
    ncCac,
    ncRoas,
    cogsRange,
    cogsSource,
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
  );
  const spendSource = blendedAdSpendSource(ads, period.label);

  return (
    <>
      <Header
        title="Sales"
        description="Shopify orders with first-touch from storefront gn_* cart attributes — not Shopify session."
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
            label="Profit ROAS"
            source={
              profitRoasValue === null
                ? "Needs ad spend · Pre-COGS contribution ÷ spend"
                : `${period.label} · Pre-COGS contribution ÷ blended ad spend`
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
            value={cogsRange.complete ? roasLabel(profitRoasAfterCogs) : null}
          />
          <MetricCard
            label="Break-even ROAS"
            source={
              beRoas === null
                ? "Needs a positive contribution margin"
                : cogsRange.complete
                  ? "1 ÷ contribution margin after COGS"
                  : "1 ÷ contribution margin (no COGS until ledger is complete)"
            }
            value={roasLabel(beRoas)}
          />
          <MetricCard
            label="Break-even CPA"
            source="AOV × contribution margin %"
            value={
              beCpa === null
                ? null
                : formatMoney({ amount: beCpa, currencyCode: currency })
            }
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
            label="New-customer ROAS"
            source={
              ncRoas === null
                ? spendSource
                : `${period.label} · new-customer revenue ÷ blended ad spend`
            }
            value={roasLabel(ncRoas)}
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
            cogs={cogsRange.cogsForRange}
            cogsComplete={cogsRange.complete}
            missingCogsDates={cogsRange.missingDates}
            cogsSource={cogsSource}
            profitAfterCogs={profitAfterCogs}
          />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <ExportCsvButton
            label="Export orders CSV"
            filename={`sales-orders-${period.startDate}-${period.endDate}.csv`}
            headers={[
              "Order",
              "Date",
              "First-touch",
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
          bySource={bySource}
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
