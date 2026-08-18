import type { Metadata } from "next";
import { Suspense } from "react";
import { AttributionLookbackControls } from "@/components/dashboard/AttributionLookbackControls";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { IdentityMatchPanel } from "@/components/dashboard/IdentityMatchPanel";
import { JourneyExplorer } from "@/components/dashboard/JourneyExplorer";
import { Header } from "@/components/layout/Header";
import { parseAttributionLookback } from "@/lib/attribution/windows";
import { getAttributionMetrics } from "@/lib/stape/get-attribution-metrics";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Journeys",
};

type PageProps = {
  searchParams?: Promise<{ lookback?: string }>;
};

export default async function JourneysPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const lookbackDays = parseAttributionLookback(params.lookback);
  const [attribution, shopify] = await Promise.all([
    getAttributionMetrics({ lookbackDays }),
    getShopifyOverviewMetrics(),
  ]);
  const currency = shopify.revenue?.currencyCode || "USD";

  return (
    <>
      <Header
        title="Customer journeys"
        description="Every attributed order's stitched first-party touch path, with credit under each attribution model. Attribution here is explainable: expand a row to audit exactly which touches produced the number."
      />
      <section className="dash-page gap-6">
        <ConnectionStatus shopify={shopify.status} stape={attribution.status} />
        <Suspense fallback={null}>
          <AttributionLookbackControls lookbackDays={lookbackDays} />
        </Suspense>
        <IdentityMatchPanel identity={attribution.identity} />
        <JourneyExplorer
          orders={attribution.orders}
          lookbackDays={lookbackDays}
          currencyCode={currency}
        />
      </section>
    </>
  );
}
