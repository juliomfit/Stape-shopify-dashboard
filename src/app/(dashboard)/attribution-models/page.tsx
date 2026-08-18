import type { Metadata } from "next";
import { Suspense } from "react";
import { AttributionControls } from "@/components/dashboard/AttributionControls";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { IdentityMatchPanel } from "@/components/dashboard/IdentityMatchPanel";
import { ModelComparisonTable } from "@/components/dashboard/ModelComparisonTable";
import { PlatformVsOurTable } from "@/components/dashboard/PlatformVsOurTable";
import { Header } from "@/components/layout/Header";
import { getPlatformReported } from "@/lib/ads/get-platform-reported";
import {
  ATTRIBUTION_MODEL_LABELS,
  compareModels,
  type AttributionModel,
  type OrderInput,
} from "@/lib/attribution/engine";
import { orderToTouchpoints } from "@/lib/attribution/journey";
import {
  PLATFORM_ENGINE_CHANNELS,
  buildPlatformVsOurRows,
} from "@/lib/attribution/platform-compare";
import { parseAttributionLookback } from "@/lib/attribution/windows";
import { getAlignedPeriod } from "@/lib/dashboard/aligned-period";
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
  "paid_only",
  "time_decay",
];

const COMPARE_MODEL: AttributionModel = "last_non_direct";

type PageProps = {
  searchParams?: Promise<{ lookback?: string }>;
};

export default async function AttributionModelsPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const lookbackDays = parseAttributionLookback(params.lookback);
  const [attribution, shopify, period] = await Promise.all([
    getAttributionMetrics({ lookbackDays }),
    getShopifyOverviewMetrics(),
    getAlignedPeriod(),
  ]);
  const platform = await getPlatformReported(period);
  const currency = shopify.revenue?.currencyCode || "USD";

  const orders: OrderInput[] = attribution.orders.map((order) => ({
    id: order.transactionId,
    revenue: order.revenue,
    purchaseTs: order.purchaseTs,
    touchpoints: orderToTouchpoints(order),
  }));
  const comparison = compareModels(orders, DISPLAY_MODELS, {
    windowDays: lookbackDays,
  });
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
        description="How much revenue each channel earns under every first-party model, over the same stitched orders. See how attribution assumptions change the decision — before trusting a single number."
      />
      <section className="dash-page gap-6">
        <ConnectionStatus shopify={shopify.status} stape={attribution.status} />
        <Suspense fallback={null}>
          <AttributionControls lookbackDays={lookbackDays} />
        </Suspense>
        <ModelComparisonTable comparison={comparison} currencyCode={currency} />
        <PlatformVsOurTable
          rows={platformRows}
          modelLabel={ATTRIBUTION_MODEL_LABELS[COMPARE_MODEL]}
          currencyCode={currency}
        />
        <IdentityMatchPanel identity={attribution.identity} />
        <p className="text-xs leading-5 text-muted">
          Orders are credited by our engine from first-party touches within a{" "}
          {lookbackDays}-day lookback. Linear / position / time-decay credit
          non-direct marketing touches (Direct is excluded unless the whole
          journey is Direct). Platform vs our uses {ATTRIBUTION_MODEL_LABELS[COMPARE_MODEL]}{" "}
          — not Ads Manager matching and not Shopify gn_* first-touch. Expand
          any order on{" "}
          <a className="underline" href="/journeys">
            Journeys
          </a>{" "}
          to audit exactly how a number was produced.
        </p>
      </section>
    </>
  );
}
