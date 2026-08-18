import type { Metadata } from "next";
import Link from "next/link";
import { AskAiPanel } from "@/components/dashboard/AskAiPanel";
import { EmptyPanel } from "@/components/dashboard/EmptyPanel";
import { FlyweelKeyForm } from "@/components/dashboard/FlyweelKeyForm";
import { MetaEntityTable } from "@/components/dashboard/MetaEntityTable";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { MetaPerformanceChart } from "@/components/dashboard/MetaPerformanceChart";
import { RefreshControls } from "@/components/dashboard/RefreshControls";
import { Header } from "@/components/layout/Header";
import { getMetaConnectionPublic } from "@/lib/ads/meta-credentials";
import { resolveMetaClaim } from "@/lib/ads/resolve-meta-claim";
import {
  dailyMetricSeries,
  getCampaignFacts,
  rollupCampaigns,
  totalsFromFacts,
} from "@/lib/ads/meta-query";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { platformWarehouseStatus } from "@/lib/platform/bq";
import { getSelectedPeriod } from "@/lib/period-server";
import { getDashboardPeriod, pacificDaysInRange } from "@/lib/period";
import { loadMetaCache } from "@/lib/ads/meta-query";
import { latestSuccessfulSync, latestSync } from "@/lib/platform/sync-runs";
import { shopifyMetricsSince } from "@/lib/dashboard/aligned-period";
import { newCustomerCac, newCustomerRoas } from "@/lib/metrics/formulas";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";
import { OurCampaignTable } from "@/components/dashboard/OurCampaignTable";
import { joinMetaAndOurCampaigns } from "@/lib/attribution/campaign-map";
import { getWarehouseMetrics } from "@/lib/warehouse/get-warehouse-metrics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Meta Ads" };

export default async function MetaPage() {
  try {
    return await renderMetaPage();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meta page failed to load.";
    return (
      <>
        <Header
          title="Meta Ads"
          description="Platform-attributed Meta reporting. Warehouse-backed; not a live Flyweel request."
        />
        <section className="dash-page gap-6">
          <EmptyPanel title="Meta page hit a server error" description={message} />
          <RefreshControls />
        </section>
      </>
    );
  }
}

async function renderMetaPage() {
  const period = await getSelectedPeriod();
  const [connection, facts, cache, lastSync, lastAttempt, warehouse, shopify, attrWarehouse] = await Promise.all([
    getMetaConnectionPublic().catch(() => ({
      configured: false,
      source: "none" as const,
      adAccountId: "",
      tokenHint: "",
      canDisconnect: false,
      oauthReady: false,
      pendingAccounts: [],
      provider: "none" as const,
    })),
    getCampaignFacts(period).catch(() => []),
    loadMetaCache().catch(() => ({ syncedAt: undefined })),
    latestSuccessfulSync("meta").catch(() => null),
    latestSync("meta").catch(() => null),
    platformWarehouseStatus().catch(() => ({
      ready: false,
      projectId: "",
      dataset: "goodsnova_platform",
      serviceAccount: "",
      message: "Warehouse check failed.",
    })),
    getShopifyOverviewMetrics().catch(() => null),
    getWarehouseMetrics().catch(() => null),
  ]);
  const totals = totalsFromFacts(facts);
  const claimed = resolveMetaClaim({
    warehouse: facts.length
      ? {
          spend: totals.spend,
          purchases: totals.purchases,
          purchaseValue: totals.purchaseValue,
        }
      : null,
    lastSuccessfulSync: Boolean(lastSync),
    periodDayCount: period.dayCount,
    periodLabel: period.label,
    paste: null,
    flyweelConfigured: connection.provider === "flyweel",
    graph: null,
  });
  const weekFacts =
    totals.spend > 0 ? [] : await getCampaignFacts(getDashboardPeriod("7d")).catch(() => []);
  const weekTotals = totalsFromFacts(weekFacts);
  const campaigns = rollupCampaigns(facts);
  const days = pacificDaysInRange(period.startDate, period.endDate);
  const currency = "USD";
  const viewContext = `Meta Ads · ${period.label} · ${period.startDate} to ${period.endDate}`;
  const alignedShopify = shopify
    ? shopifyMetricsSince(shopify.orderPoints, period.startMs, period.endMs)
    : null;
  const shopifyConnected = shopify?.status.state === "connected";
  const metaNcCac = newCustomerCac(
    claimed.spend,
    shopifyConnected ? alignedShopify?.newCustomerOrders ?? null : null,
  );
  const metaNcRoas = newCustomerRoas(
    alignedShopify?.newCustomerRevenue ?? 0,
    claimed.spend,
  );

  return (
    <>
      <Header
        title="Meta Ads"
        description="Platform-attributed Meta reporting (Ads Manager matching). Not Shopify gn_* first-touch. Timezone America/Los_Angeles."
      />
      <section className="dash-page gap-6">
        <p className="text-xs text-muted">
          Provider: {connection.provider === "flyweel" ? "Flyweel" : connection.provider === "meta_graph" ? "Meta Graph" : "none"}
          {" · "}
          {connection.adAccountId ? `Account ${connection.adAccountId}` : "No account id yet"}
          {" · "}
          {lastSync?.completed_at
            ? `Last successful sync ${lastSync.completed_at}`
            : cache.syncedAt
              ? `Local cache ${cache.syncedAt}`
              : "No Meta platform sync yet"}
        </p>
        {lastAttempt?.error_message ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
            Last sync error: {lastAttempt.error_message}
          </p>
        ) : null}
        {lastSync && totals.spend === 0 && weekTotals.spend > 0 ? (
          <article className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
            <h2 className="font-semibold text-foreground">Spend is in BigQuery — this date is $0</h2>
            <p className="mt-2">
              You do not need to update BigQuery. The last sync wrote campaign rows. This header range (
              {period.startDate} to {period.endDate}) has no spend yet. Last 7 days has{" "}
              {formatMoney({ amount: weekTotals.spend, currencyCode: currency })}.
              Click <strong>Yesterday</strong> or <strong>7d</strong> in the header. Charts still read BigQuery, not Flyweel live.
            </p>
          </article>
        ) : null}
        {facts.length === 0 && !lastSync ? (
          <article className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
            <h2 className="font-semibold text-foreground">Close the Flyweel “Connect your AI” tab</h2>
            <p className="mt-2">
              That page is for Cursor and ChatGPT. GoodsNova does not use it. The API key is already working.
              Refresh Meta now selects account 209273195421975 in Flyweel, then pulls campaigns. That does not pause or edit ads.
            </p>
            <ol className="mt-3 list-decimal space-y-1 pl-5">
              <li>Wait until Vercel finishes deploying if a deploy is in progress.</li>
              <li>Stay on this /meta page.</li>
              <li>Press <strong>Refresh Meta</strong> once and wait up to a minute.</li>
            </ol>
          </article>
        ) : null}
        {/invalid api key|rejected the API key/i.test(lastAttempt?.error_message || "") ? (
          <FlyweelKeyForm accountId={connection.adAccountId} keyHint={connection.tokenHint} />
        ) : null}
        <p className="text-xs text-muted">
          Meta-attributed purchases are Ads Manager matching, not Shopify orders and not sGTM event delivery. Use 7d in the header, then press Refresh Meta.
        </p>
        {!warehouse.ready ? (
          <article className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-950">
            <h2 className="font-semibold">This is why Meta is empty</h2>
            <p className="mt-2">{warehouse.message}</p>
            <p className="mt-3">
              Open Google Cloud → BigQuery (project {warehouse.projectId || "stape-analytics-487802"}). Create dataset{" "}
              <code className="rounded bg-white px-1">{warehouse.dataset}</code> in location US. Share it with{" "}
              <code className="rounded bg-white px-1">
                {warehouse.serviceAccount || "stape-shopify-dashboard-cursor@stape-analytics-487802.iam.gserviceaccount.com"}
              </code>{" "}
              as <strong>BigQuery Data Editor</strong>. Then press Refresh Meta.
            </p>
          </article>
        ) : null}
        {!connection.configured && facts.length === 0 ? (
          <EmptyPanel
            title="Flyweel is not on this deploy yet"
            description="Set FLYWEEL_API_KEY and FLYWEEL_META_ACCOUNT_ID on Vercel Production, wait for the latest deploy, then Refresh Meta. Ignore Cursor mcp.json."
          />
        ) : null}
        <RefreshControls />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Spend"
            source={claimed.message || "Meta insights · platform warehouse"}
            value={
              claimed.spend === null
                ? null
                : formatMoney({ amount: claimed.spend, currencyCode: currency })
            }
          />
          <MetricCard
            label="Purchase value"
            source="Meta actions purchase value · platform"
            value={
              claimed.revenue === null
                ? null
                : formatMoney({ amount: claimed.revenue, currencyCode: currency })
            }
          />
          <MetricCard
            label="Purchases"
            source="Meta attributed purchases · not Shopify gn_*"
            value={
              claimed.purchases === null ? null : formatNumber(claimed.purchases)
            }
          />
          <MetricCard
            label="ROAS"
            source="Purchase value ÷ spend"
            value={totals.roas === null ? null : `${totals.roas.toFixed(2)}x`}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="CPA"
            source="Spend ÷ purchases"
            value={
              totals.cpa === null
                ? null
                : formatMoney({ amount: totals.cpa, currencyCode: currency })
            }
          />
          <MetricCard
            label="CPM"
            source="Spend / impressions × 1000"
            value={
              totals.cpm === null
                ? null
                : formatMoney({ amount: totals.cpm, currencyCode: currency })
            }
          />
          <MetricCard
            label="CTR"
            source="Clicks ÷ impressions"
            value={totals.ctr === null ? null : formatPercent(totals.ctr)}
          />
          <MetricCard
            label="CPC"
            source="Spend ÷ clicks"
            value={
              totals.cpc === null
                ? null
                : formatMoney({ amount: totals.cpc, currencyCode: currency })
            }
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="New-customer CAC"
            source="Meta spend ÷ Shopify new-customer orders (store-wide, not campaign-attributed)"
            value={
              metaNcCac === null
                ? null
                : formatMoney({ amount: metaNcCac, currencyCode: currency })
            }
          />
          <MetricCard
            label="New-customer ROAS"
            source="Shopify new-customer revenue ÷ Meta spend (store-wide)"
            value={metaNcRoas === null ? null : `${metaNcRoas.toFixed(2)}x`}
          />
          <MetricCard
            label="New-customer orders"
            source="Shopify numberOfOrders ≤ 1 · not Meta new-customer conversions"
            value={
              shopifyConnected && alignedShopify
                ? formatNumber(alignedShopify.newCustomerOrders)
                : null
            }
          />
          <MetricCard
            label="Returning-customer orders"
            source="Shopify numberOfOrders > 1 · store-wide"
            value={
              shopifyConnected && alignedShopify
                ? formatNumber(alignedShopify.returningCustomerOrders)
                : null
            }
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Reach"
            source="Do not sum reach across ads"
            value={facts.length || claimed.spend === 0 ? formatNumber(totals.reach) : null}
          />
          <MetricCard
            label="Impressions"
            source="Campaign-level insights"
            value={facts.length || claimed.spend === 0 ? formatNumber(totals.impressions) : null}
          />
          <MetricCard
            label="Frequency"
            source="Reach / impressions at campaign grain"
            value={facts.length || claimed.spend === 0 ? totals.frequency.toFixed(2) : null}
          />
        </div>
        <MetaPerformanceChart
          days={days}
          series={{
            spend: dailyMetricSeries(facts, days, "spend"),
            purchase_value: dailyMetricSeries(facts, days, "purchase_value"),
            purchases: dailyMetricSeries(facts, days, "purchases"),
            roas: dailyMetricSeries(facts, days, "roas"),
            cpa: dailyMetricSeries(facts, days, "cpa"),
            cpm: dailyMetricSeries(facts, days, "cpm"),
            ctr: dailyMetricSeries(facts, days, "ctr"),
            cpc: dailyMetricSeries(facts, days, "cpc"),
            frequency: dailyMetricSeries(facts, days, "frequency"),
          }}
        />
        <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Campaigns</h2>
        <p className="mt-1 text-xs text-muted">
          Click a campaign for ad sets. Sorted by spend.{" "}
          <Link className="underline" href="/meta/creatives">
            Creatives
          </Link>
          . Campaign nCAC is not invented from store-wide Shopify new customers.
          OUR campaign revenue is shown below only where UTM/name mapping exists.
        </p>
          <div className="mt-4">
            <MetaEntityTable
              rows={campaigns}
              currency={currency}
              hrefPrefix="/meta"
            />
          </div>
        </article>
        <OurCampaignTable
          rows={joinMetaAndOurCampaigns(
            facts,
            attrWarehouse?.campaigns.filter(
              (row: { channel: string }) => row.channel === "Facebook / Meta Ads",
            ) ?? [],
          )}
          currencyCode={currency}
        />
        <AskAiPanel viewContext={viewContext} />
      </section>
    </>
  );
}
