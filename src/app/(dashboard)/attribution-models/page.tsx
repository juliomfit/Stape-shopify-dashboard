import type { Metadata } from "next";
import { Suspense } from "react";
import { AttributionControls } from "@/components/dashboard/AttributionControls";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { EmptyPanel } from "@/components/dashboard/EmptyPanel";
import { IdentityMatchPanel } from "@/components/dashboard/IdentityMatchPanel";
import { ModelComparisonTable } from "@/components/dashboard/ModelComparisonTable";
import { PlatformVsOurTable } from "@/components/dashboard/PlatformVsOurTable";
import { Header } from "@/components/layout/Header";
import { getPlatformReported } from "@/lib/ads/get-platform-reported";
import {
  ATTRIBUTION_MODEL_LABELS,
  compareModels,
  type AttributionModel,
} from "@/lib/attribution/engine";
import { ATTRIBUTION_GLOSSARY } from "@/lib/attribution/policy";
import {
  PLATFORM_ENGINE_CHANNELS,
  buildPlatformVsOurRows,
} from "@/lib/attribution/platform-compare";
import { parseAttributionLookback } from "@/lib/attribution/windows";
import { getAlignedPeriod } from "@/lib/dashboard/aligned-period";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";
import { getWarehouseMetrics } from "@/lib/warehouse/get-warehouse-metrics";
import {
  attributionResultsAvailable,
  canonicalToEngineOrders,
  getCanonicalAttributedOrders,
} from "@/lib/warehouse/canonical-orders";


export const metadata: Metadata = {
  title: "Attribution models",
};

const DISPLAY_MODELS: AttributionModel[] = [
  "first_touch",
  "last_touch",
  "last_non_direct",
  "linear",
  "position_based",
  "paid_only",
  "time_decay",
];

const COMPARE_MODEL: AttributionModel = "last_non_direct";

type PageProps = {
  searchParams?: Promise<{ lookback?: string }>;
};

export default async function AttributionModelsPage({ searchParams }: PageProps) {
  try {
    return await renderAttributionModels(searchParams);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Canonical attribution is unavailable.";
    return (
      <>
        <Header
          title="Attribution models"
          description="How much Shopify revenue each channel earns under every first-party model, over the same canonical session journeys."
        />
        <section className="dash-page gap-6">
          <EmptyPanel title="Attribution unavailable" description={message} />
        </section>
      </>
    );
  }
}

async function renderAttributionModels(searchParams?: Promise<{ lookback?: string }>) {
  const params = (await searchParams) ?? {};
  const lookbackDays = parseAttributionLookback(params.lookback);
  const [canonical, warehouse, shopify, period] = await Promise.all([
    getCanonicalAttributedOrders({ lookbackDays }),
    getWarehouseMetrics({ lookbackDays }),
    getShopifyOverviewMetrics(),
    getAlignedPeriod(),
  ]);
  const platform = await getPlatformReported(period);
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

  const comparison = compareModels(
    canonicalToEngineOrders(canonical),
    DISPLAY_MODELS,
    { windowDays: lookbackDays },
  );
  const ourLastNonDirect = comparison.cells[COMPARE_MODEL] ?? {};
  const platformRows = buildPlatformVsOurRows(
    [
      {
        channel: PLATFORM_ENGINE_CHANNELS.facebook,
        spend: platform.facebook.spend,
        purchases: platform.facebook.purchases,
        revenue: platform.facebook.revenue,
      },
      {
        channel: PLATFORM_ENGINE_CHANNELS.google,
        spend: platform.google.spend,
        purchases: platform.google.purchases,
        revenue: platform.google.revenue,
      },
    ],
    ourLastNonDirect,
  );

  return (
    <>
      <Header
        title="Attribution models"
        description="How much Shopify revenue each channel earns under every first-party model, over the same canonical session journeys. See how attribution assumptions change the decision — before trusting a single number."
      />
      <section className="dash-page gap-6">
        <ConnectionStatus shopify={shopify.status} stape={warehouse.status} />
        <Suspense fallback={null}>
          <AttributionControls lookbackDays={lookbackDays} />
        </Suspense>
        {attributionReady ? (
          <>
            <ModelComparisonTable comparison={comparison} currencyCode={currency} />
            <PlatformVsOurTable
              rows={platformRows}
              modelLabel={ATTRIBUTION_MODEL_LABELS[COMPARE_MODEL]}
              currencyCode={currency}
            />
            <IdentityMatchPanel
              identity={{
                purchases: canonical.length,
                purchasesWithPerson: canonical.filter((order) => order.personKey).length,
                uniquePeople: new Set(canonical.map((order) => order.personKey).filter(Boolean)).size,
                uniqueBrowsers: new Set(canonical.map((order) => order.clientId).filter(Boolean)).size,
                crossDevicePeople: 0,
              }}
            />
          </>
        ) : (
          <EmptyPanel
            title="Attribution unavailable"
            description="Connect Shopify and BigQuery before treating model comparison as attributed results. Empty tables are not $0 attributed revenue."
          />
        )}
        <p className="text-xs leading-5 text-muted">
          Orders are credited by the canonical engine from one eligible session
          touch per acquisition session within a {lookbackDays}-day lookback.
          Shopify currentTotalPriceSet is money truth.{" "}
          {ATTRIBUTION_GLOSSARY.realDirect} {ATTRIBUTION_GLOSSARY.internalNoise} Platform vs our uses{" "}
          {ATTRIBUTION_MODEL_LABELS[COMPARE_MODEL]} — not Ads Manager matching
          and not Shopify gn_* first-touch. Expand any order on{" "}
          <a className="underline" href="/journeys">
            Journeys
          </a>{" "}
          to audit exactly how a number was produced.
        </p>
      </section>
    </>
  );
}
