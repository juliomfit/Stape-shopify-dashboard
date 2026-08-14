import type { Metadata } from "next";
import { Suspense } from "react";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { InfoPanel } from "@/components/dashboard/InfoPanel";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { WarehouseChannelTable } from "@/components/dashboard/WarehouseChannelTable";
import { WarehouseControls } from "@/components/dashboard/WarehouseControls";
import { WarehouseQualityPanel } from "@/components/dashboard/WarehouseQualityPanel";
import { Header } from "@/components/layout/Header";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";
import {
  DEFAULT_LOOKBACK,
  DEFAULT_MODEL,
  WAREHOUSE_MODELS,
  isLookbackDays,
  isWarehouseModel,
} from "@/lib/warehouse/constants";
import { getWarehouseMetrics } from "@/lib/warehouse/get-warehouse-metrics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Warehouse attribution",
};

type PageProps = {
  searchParams?: Promise<{ model?: string; lookback?: string }>;
};

export default async function WarehousePage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
    const model = isWarehouseModel(params.model ?? "")
    ? (params.model as typeof DEFAULT_MODEL)
    : DEFAULT_MODEL;
  const lookbackRaw = Number(params.lookback);
  const lookbackDays = isLookbackDays(lookbackRaw)
    ? lookbackRaw
    : DEFAULT_LOOKBACK;
  const [data, shopify] = await Promise.all([
    getWarehouseMetrics({ model, lookbackDays }),
    getShopifyOverviewMetrics("kpis"),
  ]);
  const currency = shopify.revenue?.currencyCode || "USD";
  const modelLabel =
    WAREHOUSE_MODELS.find((item) => item.key === data.model)?.label ??
    data.model;
  const source = `Warehouse ${modelLabel} · ${data.lookbackDays}d lookback · ${data.periodLabel}`;

  return (
    <>
      <Header
        title="Warehouse attribution"
        description="Observed click and session paths in BigQuery. Changing the model reallocates credit; canonical Shopify order totals do not change. True Performance remains gn_* first-touch."
      />
      <section className="dash-page">
        <ConnectionStatus shopify={shopify.status} stape={data.status} />
        <Suspense fallback={null}>
          <WarehouseControls model={data.model} lookbackDays={data.lookbackDays} />
        </Suspense>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Canonical revenue"
            source={`${data.periodLabel} · 1 row per transaction_id`}
            value={formatMoney({ amount: data.revenue, currencyCode: currency })}
          />
          <MetricCard
            label="Canonical orders"
            source="Deduped GA4 + Data Client purchase copies"
            value={formatNumber(data.orders)}
          />
          <MetricCard
            label="AOV"
            source="Canonical revenue ÷ orders"
            value={
              data.orders > 0
                ? formatMoney({ amount: data.aov, currencyCode: currency })
                : null
            }
          />
          <MetricCard
            label="New / returning"
            source="Shopify order grain (warehouse is_new_customer not in BQ yet)"
            value={
              data.newCustomerOrders == null
                ? null
                : `${formatNumber(data.newCustomerOrders)} / ${formatNumber(data.returningCustomerOrders ?? 0)}`
            }
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Attributed revenue"
            source={source}
            value={formatMoney({
              amount: data.attributedRevenue,
              currencyCode: currency,
            })}
          />
          <MetricCard
            label="Attributed orders"
            source={source}
            value={formatNumber(data.attributedOrders)}
          />
          <MetricCard
            label="Attribution coverage"
            source="Orders with a credited warehouse touch"
            value={
              data.coverageRate == null ? null : formatPercent(data.coverageRate)
            }
          />
          <MetricCard
            label="High-confidence %"
            source="Known customer_id on the canonical purchase"
            value={
              data.highConfidenceRate == null
                ? null
                : formatPercent(data.highConfidenceRate)
            }
          />
          <MetricCard
            label="Direct %"
            source="Selected model credited Direct"
            value={
              data.directRate == null ? null : formatPercent(data.directRate)
            }
          />
          <MetricCard
            label="Unknown %"
            source="No credited warehouse touch in the lookback"
            value={
              data.unknownRate == null ? null : formatPercent(data.unknownRate)
            }
          />
          <MetricCard
            label="Days to purchase"
            source="First warehouse touch → order"
            value={
              data.avgDaysToPurchase == null
                ? null
                : data.avgDaysToPurchase.toFixed(1)
            }
          />
          <MetricCard
            label="Touches / sessions before purchase"
            source="Mean in lookback"
            value={
              data.avgTouchesToPurchase == null
                ? null
                : `${data.avgTouchesToPurchase.toFixed(1)} / ${data.avgSessionsToPurchase?.toFixed(1) ?? "—"}`
            }
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <WarehouseChannelTable
            title="Selected model"
            description={source}
            rows={data.byChannel}
            currencyCode={currency}
          />
          <WarehouseChannelTable
            title="Acquiring channels"
            description="First Touch (always shown)"
            rows={data.acquiring}
            currencyCode={currency}
          />
          <WarehouseChannelTable
            title="Closing channels"
            description="Last Non-Direct"
            rows={data.closing}
            currencyCode={currency}
          />
          <WarehouseChannelTable
            title="Assisting channels"
            description="Linear credit across qualifying touches"
            rows={data.assisting}
            currencyCode={currency}
          />
        </div>
        <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">
            Cross-channel journeys
          </h2>
          <p className="mt-1 text-xs text-muted">
            Non-direct warehouse touches on the same person_id, then purchase.
          </p>
          <ul className="mt-4 divide-y divide-border">
            {data.journeys.length === 0 ? (
              <li className="py-2 text-sm text-muted">No journeys in range</li>
            ) : (
              data.journeys.map((row) => (
                <li
                  key={row.path}
                  className="flex items-center justify-between gap-4 py-2.5 text-sm"
                >
                  <span className="text-foreground">{row.path}</span>
                  <span className="text-muted">
                    {formatNumber(row.orders)} ·{" "}
                    {formatMoney({ amount: row.revenue, currencyCode: currency })}
                  </span>
                </li>
              ))
            )}
          </ul>
        </article>
        <WarehouseQualityPanel
          quality={data.quality}
          totalOrders={data.orders}
        />
        <InfoPanel title="How to read this" items={data.gaps} />
      </section>
    </>
  );
}
