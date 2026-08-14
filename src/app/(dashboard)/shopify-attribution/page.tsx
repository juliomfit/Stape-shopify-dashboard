import type { Metadata } from "next";
import { Suspense } from "react";
import { AttributionAdminCompareTable } from "@/components/dashboard/AttributionAdminCompareTable";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { InfoPanel } from "@/components/dashboard/InfoPanel";
import { JourneyQualityPanel } from "@/components/dashboard/JourneyQualityPanel";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ShopifyAttributionChannelTable } from "@/components/dashboard/ShopifyAttributionChannelTable";
import { ShopifyAttributionControls } from "@/components/dashboard/ShopifyAttributionControls";
import { ShopifyAttributionReferrerTable } from "@/components/dashboard/ShopifyAttributionReferrerTable";
import { ShopifySessionPanel } from "@/components/dashboard/ShopifySessionPanel";
import { TruncationNotice } from "@/components/dashboard/TruncationNotice";
import { Header } from "@/components/layout/Header";
import { formatMoney, formatNumber } from "@/lib/format";
import { getAlignedPeriod } from "@/lib/dashboard/aligned-period";
import { getShopifyAttributionPage } from "@/lib/shopify/get-shopify-attribution";
import { SHOPIFY_ATTRIBUTION_MODELS } from "@/lib/shopify/shopifyql";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shopify Attribution",
};

type PageProps = {
  searchParams?: Promise<{ model?: string }>;
};

export default async function ShopifyAttributionPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const period = await getAlignedPeriod();
  const data = await getShopifyAttributionPage(period, params.model);
  const currency = data.shopify.revenue?.currencyCode || "USD";
  const modelLabel =
    SHOPIFY_ATTRIBUTION_MODELS.find((item) => item.key === data.model)?.label ??
    data.model;
  const inRange = data.shopify.orderPoints.filter((order) => {
    const created = new Date(order.createdAt).getTime();
    return created >= period.startMs && created < period.endMs;
  });
  const sessionTotal = data.sessionPoints.reduce(
    (total, point) => total + point.sessions,
    0,
  );

  return (
    <>
      <Header
        title="Shopify Attribution"
        description="Shopify Admin 30-day session journey. This is not gn_* True Performance and not Stape warehouse models."
      />
      <section className="flex flex-1 flex-col gap-5 p-6">
        <ConnectionStatus shopify={data.shopify.status} />
        {data.qlError ? (
          <p className="max-w-3xl rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
            ShopifyQL · {data.qlError.length > 220 ? `${data.qlError.slice(0, 220)}…` : data.qlError}
          </p>
        ) : (
          <p className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            ShopifyQL connected · {modelLabel}
          </p>
        )}
        <TruncationNotice
          truncated={data.shopify.truncated}
          fetched={inRange.length}
          reportedCount={data.shopify.reportedOrderCount}
        />
        <Suspense fallback={null}>
          <ShopifyAttributionControls model={data.model} />
        </Suspense>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Shopify orders"
            source={`${period.label} · currentTotalPriceSet count`}
            value={
              data.shopify.status.state === "connected"
                ? formatNumber(data.compare.orders)
                : null
            }
          />
          <MetricCard
            label="Shopify revenue"
            source={`${period.label} · currentTotalPriceSet`}
            value={
              data.shopify.status.state === "connected"
                ? formatMoney({ amount: data.compare.revenue, currencyCode: currency })
                : null
            }
          />
          <MetricCard
            label="Shopify sessions"
            source="ShopifyQL sessions · not Stape"
            value={
              data.sessionPoints.length > 0 ? formatNumber(sessionTotal) : null
            }
          />
          <MetricCard
            label="Marketing-app spend"
            source={data.marketingSpendNote}
            value={
              data.marketingSpend === null
                ? null
                : formatMoney({ amount: data.marketingSpend, currencyCode: currency })
            }
          />
        </div>
        <AttributionAdminCompareTable
          data={data.compare}
          currencyCode={currency}
          periodLabel={period.label}
        />
        <JourneyQualityPanel orders={inRange} />
        <ShopifyAttributionChannelTable
          rows={data.channelRows}
          currencyCode={currency}
          fallback={data.usedFirstVisitFallback}
        />
        <ShopifyAttributionReferrerTable
          rows={data.referrerRows}
          currencyCode={currency}
        />
        <ShopifySessionPanel
          points={data.sessionPoints}
          error={data.qlError}
        />
        <InfoPanel
          title="How to read this"
          items={[
            "Shopify Attribution uses a 30-day session window. True Performance uses gn_* on the order.",
            "Conversion on Overview is Shopify orders ÷ Stape sessions. Conversion here would be Shopify orders ÷ Shopify sessions.",
            "Cost / ROAS in Admin stay — unless a marketing app reports spend. Paste spend on True Performance is still the spend ledger.",
            "Facebook Unknown is not Paid. Direct includes empty and self referrers.",
            "Any click over-counts. Warehouse linear is a Stape path, not this Linear model.",
          ]}
        />
      </section>
    </>
  );
}
