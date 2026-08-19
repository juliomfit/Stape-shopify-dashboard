import type { Metadata } from "next";
import { Suspense } from "react";
import { AttributionControls } from "@/components/dashboard/AttributionControls";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { EmptyPanel } from "@/components/dashboard/EmptyPanel";
import { IdentityMatchPanel } from "@/components/dashboard/IdentityMatchPanel";
import { JourneyExplorer } from "@/components/dashboard/JourneyExplorer";
import { Header } from "@/components/layout/Header";
import { ATTRIBUTION_GLOSSARY } from "@/lib/attribution/policy";
import { parseAttributionLookback } from "@/lib/attribution/windows";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";
import { getWarehouseMetrics } from "@/lib/warehouse/get-warehouse-metrics";
import {
  attributionResultsAvailable,
  getCanonicalAttributedOrders,
} from "@/lib/warehouse/canonical-orders";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Journeys",
};

type PageProps = {
  searchParams?: Promise<{ lookback?: string }>;
};

export default async function JourneysPage({ searchParams }: PageProps) {
  try {
    return await renderJourneys(searchParams);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Canonical attribution is unavailable.";
    return (
      <>
        <Header
          title="Customer journeys"
          description="Every tracked order's canonical session-touch path, with credit under each attribution model."
        />
        <section className="dash-page gap-6">
          <EmptyPanel title="Attribution unavailable" description={message} />
        </section>
      </>
    );
  }
}

async function renderJourneys(searchParams?: Promise<{ lookback?: string }>) {
  const params = (await searchParams) ?? {};
  const lookbackDays = parseAttributionLookback(params.lookback);
  const [canonical, warehouse, shopify] = await Promise.all([
    getCanonicalAttributedOrders({ lookbackDays }),
    getWarehouseMetrics({ lookbackDays }),
    getShopifyOverviewMetrics(),
  ]);
  const currency = shopify.revenue?.currencyCode || "USD";
  if (warehouse.status.state === "error") {
    throw new Error(warehouse.status.message);
  }
  if (shopify.status.state === "error") {
    throw new Error(`Shopify orders unavailable: ${shopify.status.message}`);
  }
  const attributionReady = attributionResultsAvailable({
    warehouseState: warehouse.status.state,
    shopifyState: shopify.status.state,
  });

  return (
    <>
      <Header
        title="Customer journeys"
        description="Every tracked order's canonical session-touch path, with credit under each attribution model. Attribution here is explainable: expand a row to audit exactly which eligible session touches produced the number."
      />
      <section className="dash-page gap-6">
        <ConnectionStatus shopify={shopify.status} stape={warehouse.status} />
        <Suspense fallback={null}>
          <AttributionControls lookbackDays={lookbackDays} />
        </Suspense>
        {attributionReady ? (
          <>
            <IdentityMatchPanel
              identity={{
                purchases: canonical.length,
                purchasesWithPerson: canonical.filter((order) => order.personKey).length,
                uniquePeople: new Set(canonical.map((order) => order.personKey).filter(Boolean)).size,
                uniqueBrowsers: new Set(canonical.map((order) => order.clientId).filter(Boolean)).size,
                crossDevicePeople: 0,
              }}
            />
            <JourneyExplorer
              orders={canonical}
              lookbackDays={lookbackDays}
              currencyCode={currency}
            />
          </>
        ) : (
          <EmptyPanel
            title="Attribution unavailable"
            description="Connect Shopify and BigQuery before treating an empty journey list as $0 attributed revenue."
          />
        )}
        <p className="text-xs leading-5 text-muted">
          {ATTRIBUTION_GLOSSARY.shopifyMoney} {ATTRIBUTION_GLOSSARY.internalNoise}{" "}
          {ATTRIBUTION_GLOSSARY.unknown}
        </p>
      </section>
    </>
  );
}
