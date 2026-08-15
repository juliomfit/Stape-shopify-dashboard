import type { Metadata } from "next";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { ConversionFunnel } from "@/components/dashboard/ConversionFunnel";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { MismatchBanner } from "@/components/dashboard/MismatchBanner";
import { TruncationNotice } from "@/components/dashboard/TruncationNotice";
import { Header } from "@/components/layout/Header";
import { getCoreDashboard } from "@/lib/dashboard/core-metrics";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { blendedAdSpendSource } from "@/lib/metrics/source-lines";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Conversions",
};

export default async function ConversionsPage() {
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
    mismatch,
    deltas,
    cpa,
    totalSpend,
  } = data;
  const shopifySource = shopifyConnected
    ? `Shopify · ${period.label}`
    : "Shopify · no data yet";
  const stapeSource = stapeConnected
    ? `Stape · ${period.label}`
    : "Stape · no data yet";
  const bothSource =
    conversion.rate === null
      ? conversion.note
      : `${conversion.note} · ${period.label}`;
  const spendSource = blendedAdSpendSource(data.ads, period.label);

  return (
    <>
      <Header
        title="Conversions"
        description="Clicks to purchase for the selected date range. Landing page views are page_view sessions, not product views."
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
            label="Conversion Rate"
            source={bothSource}
            value={
              conversion.rate === null ? null : formatPercent(conversion.rate)
            }
            delta={deltas.conversion}
            deltaLabel={deltaLabel}
          />
          <MetricCard
            label="Shopify orders"
            source={shopifySource}
            value={shopifyConnected ? formatNumber(alignedShopify.orders) : null}
            delta={deltas.orders}
            deltaLabel={deltaLabel}
          />
          <MetricCard
            label="Stape purchases"
            source={stapeSource}
            value={stapeConnected ? formatNumber(funnel.purchases) : null}
          />
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
            delta={deltas.aov}
            deltaLabel={deltaLabel}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Sessions"
            source={`${stapeSource} · funnel sessions`}
            value={stapeConnected ? formatNumber(funnel.sessions) : null}
            delta={deltas.sessions}
            deltaLabel={deltaLabel}
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
        <ConversionFunnel
          periodLabel={period.label}
          steps={funnel.steps}
          showTable
          shopifyOrders={shopifyConnected ? alignedShopify.orders : null}
        />
      </section>
    </>
  );
}
