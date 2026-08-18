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
  type OrderInput,
} from "@/lib/attribution/engine";
import { orderToTouchpoints } from "@/lib/attribution/journey";
import {
  PLATFORM_ENGINE_CHANNELS,
  buildPlatformVsOurRows,
} from "@/lib/attribution/platform-compare";
import { CAMPAIGN_MAPPING_STATUS } from "@/lib/attribution/campaign-map";
import { parseAttributionLookback } from "@/lib/attribution/windows";
import { getAlignedPeriod } from "@/lib/dashboard/aligned-period";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { attributedNcac, ratio } from "@/lib/metrics/formulas";
import { getAttributionMetrics } from "@/lib/stape/get-attribution-metrics";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";
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

  const [warehouse, attribution, shopify, period] = await Promise.all([
    getWarehouseMetrics({
      model: warehouseModel,
      lookbackDays,
    }),
    getAttributionMetrics({ lookbackDays }),
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
  const orders: OrderInput[] = attribution.orders.map((order) => ({
    id: order.transactionId,
    revenue: order.revenue,
    purchaseTs: order.purchaseTs,
    touchpoints: orderToTouchpoints(order),
  }));
  const comparison = compareModels(orders, [...ATTRIBUTION_MODELS], {
    windowDays: lookbackDays,
  });
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
  const ourRoas = ratio(warehouse.attributedRevenue, warehouse.totalSpend);
  const ncac = attributedNcac(
    warehouse.totalSpend,
    shopify.status.state === "connected" ? shopify.newCustomerOrders : null,
  );
  const modelLabel = ATTRIBUTION_MODEL_LABELS[engineModel];

  return (
    <>
      <Header
        title="Attribution"
        description={`${modelLabel} · ${lookbackDays}d window · Shopify is money truth. Unknown is not Direct. Campaign mapping coverage is ${CAMPAIGN_MAPPING_STATUS}.`}
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
            source={`${modelLabel} · ${lookbackDays}d`}
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
            label="Our ROAS"
            source="Our attributed revenue ÷ blended spend"
            value={merLabel(ourRoas)}
          />
          <MetricCard
            label="Blended nCAC"
            source="Total ad spend ÷ Shopify new-customer orders"
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
          description={`${modelLabel} · click a journeys link to audit orders`}
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
          Drill to{" "}
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
