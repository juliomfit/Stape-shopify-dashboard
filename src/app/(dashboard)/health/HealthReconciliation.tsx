import { getCoreDashboard } from "@/lib/dashboard/core-metrics";
import { coverageRatio } from "@/lib/metrics/formulas";
import { getSelectedPeriod } from "@/lib/period-server";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { getAttributionMetrics } from "@/lib/stape/get-attribution-metrics";
import { getCampaignFacts, totalsFromFacts } from "@/lib/ads/meta-query";
import { blendedAdSpendSource } from "@/lib/metrics/source-lines";
import { Ga4CaptureCompare } from "@/components/dashboard/Ga4Panels";
import { IdentityMatchPanel } from "@/components/dashboard/IdentityMatchPanel";
import { getGa4Snapshot } from "@/lib/ads/ga4-query";
import { latestSuccessfulSync } from "@/lib/platform/sync-runs";
import { loggedFallback } from "@/lib/observability/loader-log";

export async function HealthReconciliation() {
  const period = await getSelectedPeriod();
  const [data, attribution, metaFacts, ga4, ga4Ok] = await Promise.all([
    getCoreDashboard(),
    getAttributionMetrics().catch(
      loggedFallback("health_attribution", {
        tracking: [] as { label: string; filled: number; total: number }[],
        identity: {
          purchases: 0,
          purchasesWithPerson: 0,
          uniquePeople: 0,
          uniqueBrowsers: 0,
          crossDevicePeople: 0,
        },
      }),
    ),
    getCampaignFacts(period).catch(loggedFallback("health_meta_facts", [])),
    getGa4Snapshot(period).catch(loggedFallback("health_ga4", null)),
    latestSuccessfulSync("ga4").catch(loggedFallback("health_ga4_sync", null)),
  ]);
  const shopifyOrders = data.shopifyConnected ? data.alignedShopify.orders : null;
  const stapePurchases = data.stapeConnected ? data.funnel.purchases : null;
  const warehouseMeta = totalsFromFacts(metaFacts);
  const overviewMeta = data.ads.facebook.spend;
  const spendMismatch =
    metaFacts.length > 0 &&
    overviewMeta !== null &&
    Math.abs(warehouseMeta.spend - overviewMeta) > 0.01;
  const ga4Note =
    "GA4 is Google Analytics (browser property), not gn_* and not Stape. Enable Data API on the service-account GCP project, then Refresh GA4.";
  const ga4Ready = Boolean(ga4Ok);
  const rows = [
    { label: "Shopify orders", value: shopifyOrders, kind: "capture" },
    { label: "Server GTM / Stape purchases", value: stapePurchases, kind: "capture" },
    {
      label: "GA4 purchases",
      value: ga4Ready && ga4 ? ga4.totals.purchases : null,
      kind: "capture",
    },
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
      <Ga4CaptureCompare
        shopifyOrders={shopifyOrders}
        shopifyRevenue={data.shopifyConnected ? data.alignedShopify.revenue : null}
        stapePurchases={stapePurchases}
        stapeRevenue={data.stapeConnected ? data.funnel.purchaseRevenue : null}
        ga4Purchases={ga4Ready && ga4 ? ga4.totals.purchases : null}
        ga4Revenue={ga4Ready && ga4 ? ga4.totals.purchaseRevenue : null}
        ga4Sessions={ga4Ready && ga4 ? ga4.totals.sessions : null}
        currencyCode={data.currency}
        periodLabel={data.period.label}
        propertyId={ga4?.propertyId || ""}
        streamId={ga4?.streamId || ""}
        hasRows={ga4Ready}
      />
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
            Today $0 with Yesterday spend is Flyweel lag, not a missing BigQuery dataset. First-touch stays gn_*.
          </p>
        )}
      </article>
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
      <IdentityMatchPanel identity={attribution.identity} />
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
    </>
  );
}
