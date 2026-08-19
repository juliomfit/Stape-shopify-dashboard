import type { Metadata } from "next";
import { Suspense } from "react";
import { AttributionControls } from "@/components/dashboard/AttributionControls";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { IdentityMatchPanel } from "@/components/dashboard/IdentityMatchPanel";
import { JourneyExplorer } from "@/components/dashboard/JourneyExplorer";
import { Header } from "@/components/layout/Header";
import { ATTRIBUTION_GLOSSARY } from "@/lib/attribution/policy";
import { parseAttributionLookback } from "@/lib/attribution/windows";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";
import { getWarehouseMetrics } from "@/lib/warehouse/get-warehouse-metrics";
import { getCanonicalAttributedOrders } from "@/lib/warehouse/canonical-orders";

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
  const [canonical, warehouse, shopify] = await Promise.all([
    getCanonicalAttributedOrders({ lookbackDays }),
    getWarehouseMetrics({ lookbackDays }),
    getShopifyOverviewMetrics(),
  ]);
  const currency = shopify.revenue?.currencyCode || "USD";

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
        <p className="text-xs leading-5 text-muted">
          {ATTRIBUTION_GLOSSARY.shopifyMoney} {ATTRIBUTION_GLOSSARY.internalNoise}{" "}
          {ATTRIBUTION_GLOSSARY.unknown}
        </p>
      </section>
    </>
  );
}
