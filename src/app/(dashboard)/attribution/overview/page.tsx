import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AttributionControls } from "@/components/dashboard/AttributionControls";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ModelComparisonTable } from "@/components/dashboard/ModelComparisonTable";
import { PlatformVsOurTable } from "@/components/dashboard/PlatformVsOurTable";
import { WarehouseChannelTable } from "@/components/dashboard/WarehouseChannelTable";
import { Header } from "@/components/layout/Header";
import { getPlatformReported } from "@/lib/ads/get-platform-reported";
import { attributionCoverage } from "@/lib/attribution/coverage";
import {
  ATTRIBUTION_MODEL_LABELS,
  ATTRIBUTION_MODELS,
  compareModels,
  type AttributionModel,
} from "@/lib/attribution/engine";
import { ATTRIBUTION_GLOSSARY } from "@/lib/attribution/policy";
import {
  PLATFORM_ENGINE_CHANNELS,
  buildPlatformVsOurRows,
} from "@/lib/attribution/platform-compare";
import { CAMPAIGN_MAPPING_STATUS } from "@/lib/attribution/campaign-map";
import { parseAttributionLookback } from "@/lib/attribution/windows";
import { getAlignedPeriod } from "@/lib/dashboard/aligned-period";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { blendedNcac, merRatio, ratio } from "@/lib/metrics/formulas";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";
import {
  canonicalToEngineOrders,
  getCanonicalAttributedOrders,
  metaAttributedRevenue,
  paidAttributedRevenue,
} from "@/lib/warehouse/canonical-orders";
import { getWarehouseMetrics } from "@/lib/warehouse/get-warehouse-metrics";
import { isWarehouseModel, type WarehouseModel } from "@/lib/warehouse/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Attribution overview",
};

type PageProps = {
  searchParams?: Promise<{ model?: string; lookback?: string }>;
};

function merLabel(value: number | null) {
  return value === null ? null : `${value.toFixed(2)}x`;
}

export default async function AttributionOverviewPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const lookbackDays = parseAttributionLookback(params.lookback);
  const warehouseModel: WarehouseModel = isWarehouseModel(params.model ?? "")
    ? (params.model as WarehouseModel)
    : "last_non_direct";
  const engineModel: AttributionModel = ATTRIBUTION_MODELS.includes(
    warehouseModel as AttributionModel,
  )
    ? (warehouseModel as AttributionModel)
    : "last_non_direct";

  const [warehouse, canonical, shopify, period] = await Promise.all([
    getWarehouseMetrics({
      model: warehouseModel,
      lookbackDays,
    }),
    getCanonicalAttributedOrders({ lookbackDays }),
    getShopifyOverviewMetrics(),
    getAlignedPeriod(),
  ]);
  const platform = await getPlatformReported(period);
  const currency = shopify.revenue?.currencyCode || "USD";
  const coverage = attributionCoverage({
    shopifyOrders: shopify.orders ?? 0,
    trackedPurchases: warehouse.quality.canonicalOrders,
    identityMatched: warehouse.quality.ordersWithPersonId,
    journeyMatched: warehouse.quality.ordersWithPrepurchasesSession,
    attributedOrders: warehouse.quality.attributedOrders,
  });
  const comparison = compareModels(
    canonicalToEngineOrders(canonical),
    [...ATTRIBUTION_MODELS],
    { windowDays: lookbackDays },
  );
  const our = comparison.cells[engineModel] ?? {};
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
    our,
  );
  const shopifyMer = merRatio(warehouse.totalSpend, shopify.revenue?.amount ?? 0);
  const ourPaidRoas = ratio(
    paidAttributedRevenue(canonical, engineModel, lookbackDays),
    warehouse.totalSpend,
  );
  const ourMetaRoas = ratio(
    metaAttributedRevenue(canonical, engineModel, lookbackDays),
    warehouse.metaSpend,
  );
  const ncac = blendedNcac(
    warehouse.totalSpend,
    shopify.status.state === "connected" ? shopify.newCustomerOrders : null,
  );
  const modelLabel = ATTRIBUTION_MODEL_LABELS[engineModel];
  const googleRoas = warehouse.googleSpend == null ? null : null;

  return (
    <>
      <Header
        title="Attribution"
        description="Shopify is money truth. Unknown is not Direct. Checkout noise is not Direct. Model and window live in the controls and URL. Campaign mapping coverage is VALIDATION REQUIRED until Julio runs bigquery/validation/05_meta_campaign_mapping_coverage.sql."
      />
      <section className="dash-page gap-6">
        <ConnectionStatus shopify={shopify.status} stape={warehouse.status} />
        <Suspense fallback={null}>
          <AttributionControls
            lookbackDays={lookbackDays}
            model={engineModel}
            showModel
          />
        </Suspense>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Our attributed revenue"
            source={`${modelLabel} · ${lookbackDays}d · Shopify × credit`}
            value={formatMoney({
              amount: warehouse.attributedRevenue,
              currencyCode: currency,
            })}
          />
          <MetricCard
            label="Our attributed orders"
            source="Fractional credit summed to orders"
            value={formatNumber(Math.round(warehouse.attributedOrders * 10) / 10)}
          />
          <MetricCard
            label="Attribution coverage"
            source="Attributed warehouse orders ÷ Shopify orders"
            value={
              coverage.attributionCoverage == null
                ? null
                : formatPercent(coverage.attributionCoverage)
            }
          />
          <MetricCard
            label="Unattributed orders"
            source="Not forced into Direct"
            value={formatNumber(coverage.unattributedOrders)}
          />
          <MetricCard
            label="New-customer revenue"
            source="Shopify currentTotalPriceSet · new-customer orders"
            value={formatMoney({
              amount: shopify.newCustomerRevenue,
              currencyCode: currency,
            })}
          />
          <MetricCard
            label="Shopify MER"
            source={ATTRIBUTION_GLOSSARY.mer}
            value={merLabel(shopifyMer)}
          />
          <MetricCard
            label="Our Paid ROAS"
            source={ATTRIBUTION_GLOSSARY.ourPaidRoas}
            value={merLabel(ourPaidRoas)}
          />
          <MetricCard
            label="Our Meta ROAS"
            source="Meta-attributed Shopify revenue ÷ Meta spend"
            value={merLabel(ourMetaRoas)}
          />
          <MetricCard
            label="Our Google ROAS"
            source="Google spend is not connected"
            value={googleRoas}
          />
          <MetricCard
            label="Blended nCAC"
            source={ATTRIBUTION_GLOSSARY.blendedNcac}
            value={
              ncac === null
                ? null
                : formatMoney({ amount: ncac, currencyCode: currency })
            }
          />
          <MetricCard
            label="Campaign mapping"
            source="Live % requires BigQuery validation"
            value={CAMPAIGN_MAPPING_STATUS}
          />
        </div>
        <WarehouseChannelTable
          title="Channel · selected model"
          description={`${modelLabel} · Shopify money × canonical session credit`}
          rows={warehouse.byChannel}
          currencyCode={currency}
        />
        <PlatformVsOurTable
          rows={platformRows}
          modelLabel={modelLabel}
          currencyCode={currency}
        />
        <ModelComparisonTable comparison={comparison} currencyCode={currency} />
        <p className="text-xs text-muted">
          {ATTRIBUTION_GLOSSARY.realDirect} {ATTRIBUTION_GLOSSARY.internalNoise}{" "}
          {ATTRIBUTION_GLOSSARY.unknown} Drill to{" "}
          <Link className="underline" href={`/journeys?lookback=${lookbackDays}`}>
            journeys / order debugger
          </Link>
          {" · "}
          <Link className="underline" href={`/attribution?lookback=${lookbackDays}`}>
            first-touch (cart gn_*)
          </Link>
          {" · "}
          <Link className="underline" href={`/meta`}>
            Meta platform facts
          </Link>
          . Changing model/window updates OUR numbers only. Shopify totals do not change.
        </p>
      </section>
    </>
  );
}
