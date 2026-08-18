import type { Metadata } from "next";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { JourneyExplorer } from "@/components/dashboard/JourneyExplorer";
import { Header } from "@/components/layout/Header";
import { getAttributionMetrics } from "@/lib/stape/get-attribution-metrics";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Journeys",
};

export default async function JourneysPage() {
  const [attribution, shopify] = await Promise.all([
    getAttributionMetrics(),
    getShopifyOverviewMetrics(),
  ]);
  const currency = shopify.revenue?.currencyCode || "USD";

  return (
    <>
      <Header
        title="Customer journeys"
        description="Every attributed order's stitched first-party touch path, with credit under each attribution model. Attribution here is explainable: expand a row to audit exactly which touches produced the number."
      />
      <section className="dash-page">
        <ConnectionStatus shopify={shopify.status} stape={attribution.status} />
        <JourneyExplorer
          orders={attribution.orders}
          lookbackDays={attribution.lookbackDays}
          currencyCode={currency}
        />
      </section>
    </>
  );
}
