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
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";
import { getStapeTrafficMetrics } from "@/lib/stape/get-traffic-metrics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Conversions",
};

export default async function ConversionsPage() {
  const [shopify, stape] = await Promise.all([
    getShopifyOverviewMetrics(),
    getStapeTrafficMetrics(),
  ]);

  const shopifySource =
    shopify.status.state === "connected"
      ? `Shopify · ${shopify.periodLabel}`
      : "Shopify · no data yet";
  const stapeSource =
    stape.status.state === "connected"
      ? `Stape · ${stape.periodLabel}`
      : "Stape · no data yet";
  const bothSource =
    shopify.status.state === "connected" && stape.status.state === "connected"
      ? `Orders ÷ sessions · ${shopify.periodLabel}`
      : "Shopify + Stape · no data yet";

  const conversionRate = getConversionRate(shopify.orders, stape.sessions);
  const averageOrderValue = getAverageOrderValue(
    shopify.revenue?.amount ?? null,
    shopify.orders,
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
        description="Shopify purchases compared with first-party Stape funnel events."
      />
      <section className="flex flex-1 flex-col gap-6 p-8">
        <ConnectionStatus shopify={shopify.status} stape={stape.status} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Conversion Rate"
            source={bothSource}
            value={
              conversionRate === null ? null : formatPercent(conversionRate)
            }
          />
          <MetricCard
            label="Orders"
            source={shopifySource}
            value={
              shopify.orders === null ? null : formatNumber(shopify.orders)
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
