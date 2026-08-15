import type { Metadata } from "next";
import { DataHealthStrip } from "@/components/dashboard/DataHealthStrip";
import { Header } from "@/components/layout/Header";
import { RefreshControls } from "@/components/dashboard/RefreshControls";
import { getDataHealth } from "@/lib/platform/health";
import { listSyncRuns } from "@/lib/platform/sync-runs";
import { getCoreDashboard } from "@/lib/dashboard/core-metrics";
import { coverageRatio } from "@/lib/metrics/formulas";
import { getSelectedPeriod } from "@/lib/period-server";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { getAttributionMetrics } from "@/lib/stape/get-attribution-metrics";
import { getCampaignFacts, totalsFromFacts } from "@/lib/ads/meta-query";
import { blendedAdSpendSource } from "@/lib/metrics/source-lines";
import { EmptyTable } from "@/components/dashboard/EmptyTable";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Data health" };

export default async function HealthPage() {
  const period = await getSelectedPeriod();
  const [sources, runs, data, attribution, metaFacts] = await Promise.all([
    getDataHealth().catch(() => []),
    listSyncRuns().catch(() => []),
    getCoreDashboard(),
    getAttributionMetrics().catch(() => ({ tracking: [] as { label: string; filled: number; total: number }[] })),
    getCampaignFacts(period).catch(() => []),
  ]);
  const shopifyOrders = data.shopifyConnected ? data.alignedShopify.orders : null;
  const stapePurchases = data.stapeConnected ? data.funnel.purchases : null;
  const warehouseMeta = totalsFromFacts(metaFacts);
  const overviewMeta = data.ads.facebook.spend;
  const spendMismatch =
    metaFacts.length > 0 &&
    overviewMeta !== null &&
    Math.abs(warehouseMeta.spend - overviewMeta) > 0.01;
  const ga4Note = "GA4 purchases are not in this table unless GA4_PROPERTY_ID sync succeeded.";
  const rows = [
    { label: "Shopify orders", value: shopifyOrders, kind: "capture" },
    { label: "Server GTM / Stape purchases", value: stapePurchases, kind: "capture" },
    {
      label: "Meta attributed purchases",
      value: data.ads.facebook.purchases,
      kind: "attribution",
    },
    {
      label: "Google attributed conversions",
      value: data.ads.google.purchases,
      kind: "attribution",
    },
  ];

  return (
    <>
      <Header
        title="Data health"
        description="Sync freshness and tracking reconciliation. Attribution numbers are not event-delivery coverage."
      />
      <section className="dash-page gap-6">
        <DataHealthStrip sources={sources} />
        <RefreshControls />
        <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Spend correlation</h2>
          <p className="mt-1 text-xs text-muted">{blendedAdSpendSource(data.ads, data.period.label)}</p>
          <ul className="mt-4 divide-y divide-border text-sm">
            <li className="flex justify-between py-3">
              <span>Overview Meta (same resolver as cards)</span>
              <span>
                {overviewMeta === null
                  ? "—"
                  : formatMoney({ amount: overviewMeta, currencyCode: "USD" })}
              </span>
            </li>
            <li className="flex justify-between py-3">
              <span>Warehouse campaign facts (/meta)</span>
              <span>
                {metaFacts.length === 0
                  ? "—"
                  : formatMoney({ amount: warehouseMeta.spend, currencyCode: "USD" })}
              </span>
            </li>
            <li className="flex justify-between py-3">
              <span>Google paste</span>
              <span>
                {data.ads.google.spend === null
                  ? "—"
                  : formatMoney({ amount: data.ads.google.spend, currencyCode: "USD" })}
              </span>
            </li>
          </ul>
          {spendMismatch ? (
            <p className="mt-3 text-sm text-red-800">
              Overview Meta spend does not match warehouse campaign facts. File a bug — they share one resolver now.
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted">
              Today $0 with Yesterday spend is Flyweel lag, not a missing BigQuery dataset. True Performance stays gn_*.
            </p>
          )}
        </article>
        {runs.length === 0 ? (
          <EmptyTable
            title="No sync runs recorded"
            why="Refresh Meta writes sync_runs after Flyweel ingest. Charts never call Flyweel on page load."
            next={[{ kind: "href", href: "/meta", label: "Refresh Meta" }]}
          />
        ) : null}
        <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Tracking reconciliation</h2>
          <p className="mt-1 text-xs text-muted">{ga4Note}</p>
          <ul className="mt-4 divide-y divide-border">
            {rows.map((row) => (
              <li key={row.label} className="flex justify-between py-3 text-sm">
                <span>
                  {row.label}
                  <span className="ml-2 text-xs text-muted">{row.kind}</span>
                </span>
                <span>{row.value === null ? "—" : formatNumber(row.value)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">
            sGTM vs Shopify{" "}
            {coverageRatio(stapePurchases, shopifyOrders) === null
              ? "—"
              : formatPercent(coverageRatio(stapePurchases, shopifyOrders) as number)}
          </p>
        </article>
        <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Recent sync runs</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {runs.slice(0, 20).map((run) => (
              <li key={run.id}>
                {run.source} · {run.sync_type} · {run.status} · {run.started_at}
                {run.error_message ? ` · ${run.error_message}` : ""}
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Stape field fill</h2>
          <ul className="mt-3 space-y-1 text-sm text-muted">
            {attribution.tracking.slice(0, 12).map((field) => (
              <li key={field.label}>
                {field.label}: {field.total ? Math.round((field.filled / field.total) * 100) : 0}%
              </li>
            ))}
          </ul>
        </article>
      </section>
    </>
  );
}
