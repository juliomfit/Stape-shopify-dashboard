import type { Metadata } from "next";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { ModelComparisonTable } from "@/components/dashboard/ModelComparisonTable";
import { Header } from "@/components/layout/Header";
import {
  compareModels,
  type AttributionModel,
  type OrderInput,
} from "@/lib/attribution/engine";
import { orderToTouchpoints } from "@/lib/attribution/journey";
import { getAttributionMetrics } from "@/lib/stape/get-attribution-metrics";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Attribution models",
};

const DISPLAY_MODELS: AttributionModel[] = [
  "first_touch",
  "last_touch",
  "last_non_direct",
  "linear",
  "position_based",
];

export default async function AttributionModelsPage() {
  const [attribution, shopify] = await Promise.all([
    getAttributionMetrics(),
    getShopifyOverviewMetrics(),
  ]);
  const currency = shopify.revenue?.currencyCode || "USD";

  const orders: OrderInput[] = attribution.orders.map((order) => ({
    id: order.transactionId,
    revenue: order.revenue,
    purchaseTs: order.purchaseTs,
    touchpoints: orderToTouchpoints(order),
  }));
  const comparison = compareModels(orders, DISPLAY_MODELS, {
    windowDays: attribution.lookbackDays,
  });

  return (
    <>
      <Header
        title="Attribution models"
        description="How much revenue each channel earns under every first-party model, over the same stitched orders. See how attribution assumptions change the decision — before trusting a single number."
      />
      <section className="dash-page">
        <ConnectionStatus shopify={shopify.status} stape={attribution.status} />
        <ModelComparisonTable comparison={comparison} currencyCode={currency} />
        <p className="text-xs leading-5 text-muted">
          Orders are credited by our engine from first-party touches within a{" "}
          {attribution.lookbackDays}-day lookback. Linear / position / time-decay
          credit non-direct marketing touches (Direct is excluded unless the whole
          journey is Direct). Expand any order on{" "}
          <a className="underline" href="/journeys">
            Journeys
          </a>{" "}
          to audit exactly how a number was produced.
        </p>
      </section>
    </>
  );
}
