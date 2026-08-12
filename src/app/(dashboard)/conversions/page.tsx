import type { Metadata } from "next";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { ConversionFunnel } from "@/components/dashboard/ConversionFunnel";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Header } from "@/components/layout/Header";
import {
  findEventCount,
  getAverageOrderValue,
  getConversionRate,
} from "@/lib/dashboard/conversion";
import { getAlignedPeriod, shopifyMetricsSince } from "@/lib/dashboard/aligned-period";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";
import { getStapeTrafficMetrics } from "@/lib/stape/get-traffic-metrics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Conversions",
};

export default async function ConversionsPage() {
  const [shopify, stape, period] = await Promise.all([
    getShopifyOverviewMetrics(),
    getStapeTrafficMetrics(),
    getAlignedPeriod(),
  ]);
  const alignedShopify = shopifyMetricsSince(shopify.orderPoints, period.startMs);
  const alignedLabel = period.label;

  const shopifySource =
    shopify.status.state === "connected"
      ? `Shopify · ${alignedLabel}`
      : "Shopify · no data yet";
  const stapeSource =
    stape.status.state === "connected"
      ? `Stape · ${alignedLabel}`
      : "Stape · no data yet";
  const conversion = getConversionRate(
    shopify.status.state === "connected" ? alignedShopify.orders : null,
    stape.sessions,
  );
  const bothSource =
    conversion.rate === null
      ? conversion.note
      : `${conversion.note} · ${alignedLabel}`;
  const averageOrderValue = getAverageOrderValue(
    shopify.status.state === "connected" ? alignedShopify.revenue : null,
    shopify.status.state === "connected" ? alignedShopify.orders : null,
  );
  const viewItem = findEventCount(stape.eventCounts, ["view_item"]);
  const addToCart = findEventCount(stape.eventCounts, ["add_to_cart"]);
  const beginCheckout = findEventCount(stape.eventCounts, ["begin_checkout"]);
  const stapePurchase = findEventCount(stape.eventCounts, [
    "purchase",
    "order_completed",
  ]);
  const addToCartRate =
    stape.sessions && stape.sessions > 0
      ? addToCart.sessions / stape.sessions
      : null;

  return (
    <>
      <Header
        title="Conversions"
        description="Shopify purchases compared with first-party Stape funnel events, using the same date range."
      />
      <section className="flex flex-1 flex-col gap-6 p-8">
        <ConnectionStatus shopify={shopify.status} stape={stape.status} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Conversion Rate"
            source={bothSource}
            value={
              conversion.rate === null ? null : formatPercent(conversion.rate)
            }
          />
          <MetricCard
            label="Orders"
            source={shopifySource}
            value={
              shopify.status.state === "connected"
                ? formatNumber(alignedShopify.orders)
                : null
            }
          />
          <MetricCard
            label="Sessions"
            source={stapeSource}
            value={
              stape.sessions === null ? null : formatNumber(stape.sessions)
            }
          />
          <MetricCard
            label="Average Order Value"
            source={shopifySource}
            value={
              averageOrderValue === null || !shopify.revenue
                ? null
                : formatMoney({
                    amount: averageOrderValue,
                    currencyCode: shopify.revenue.currencyCode,
                  })
            }
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard
            label="Add to Cart Rate"
            source={
              addToCartRate === null
                ? "Stape · no data yet"
                : `Add to cart sessions ÷ sessions · ${stape.periodLabel}`
            }
            value={
              addToCartRate === null ? null : formatPercent(addToCartRate)
            }
          />
          <MetricCard
            label="Stape Purchase Events"
            source={stapeSource}
            value={
              stape.sessions === null
                ? null
                : formatNumber(stapePurchase.events)
            }
          />
        </div>
        <ConversionFunnel
          periodLabel={alignedLabel}
          steps={[
            {
              label: "Sessions",
              value: stape.sessions ?? 0,
              source: "Stape",
            },
            {
              label: "View item",
              value: viewItem.sessions,
              source: "Stape",
            },
            {
              label: "Add to cart",
              value: addToCart.sessions,
              source: "Stape",
            },
            {
              label: "Begin checkout",
              value: beginCheckout.sessions,
              source: "Stape",
            },
            {
              label: "Stape purchase",
              value: stapePurchase.sessions,
              source: "Stape",
            },
          ]}
        />
      </section>
    </>
  );
}
