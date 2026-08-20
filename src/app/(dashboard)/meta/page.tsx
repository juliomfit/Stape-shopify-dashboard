import type { Metadata } from "next";
import Link from "next/link";
import { AskAiPanel } from "@/components/dashboard/AskAiPanel";
import { EmptyPanel } from "@/components/dashboard/EmptyPanel";
import { FlyweelKeyForm } from "@/components/dashboard/FlyweelKeyForm";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { MetaPerformanceWorkspace } from "@/components/dashboard/MetaPerformanceWorkspace";
import { RefreshControls } from "@/components/dashboard/RefreshControls";
import { Header } from "@/components/layout/Header";
import { getMetaConnectionPublic } from "@/lib/ads/meta-credentials";
import { resolveMetaClaim } from "@/lib/ads/resolve-meta-claim";
import {
  dailyMetricSeries,
  getCampaignFacts,
  totalsFromFacts,
} from "@/lib/ads/meta-query";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { platformWarehouseStatus } from "@/lib/platform/bq";
import { getSelectedPeriod } from "@/lib/period-server";
import { getDashboardPeriod, pacificDaysInRange } from "@/lib/period";
import { loadMetaCache } from "@/lib/ads/meta-query";
import { latestSuccessfulSync, latestSync } from "@/lib/platform/sync-runs";
import { shopifyMetricsSince } from "@/lib/dashboard/aligned-period";
import { DEFAULT_ATTRIBUTION_WINDOW_DAYS } from "@/lib/attribution/windows";
import { newCustomerCac, newCustomerRoas } from "@/lib/metrics/formulas";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";
import { MetaIdCoveragePanel } from "@/components/dashboard/MetaIdCoveragePanel";
import { UnmappedMetaBucket } from "@/components/dashboard/UnmappedMetaBucket";
import { MetaIngestHealthPanel } from "@/components/dashboard/MetaIngestHealthPanel";
import { joinMetaAndOurCampaigns } from "@/lib/attribution/campaign-map";
import { getWarehouseMetrics } from "@/lib/warehouse/get-warehouse-metrics";
import {
  getCanonicalAttributedOrders,
  newCustomerCreditByCampaign,
  newCustomerRevenueByCampaign,
  toMetaCreditOrders,
} from "@/lib/warehouse/canonical-orders";
import { getAdsetFacts, getAdFacts, getAdCreativeMap } from "@/lib/ads/meta-query";
import { getMetaFactTableCounts } from "@/lib/ads/meta-fact-counts";
import { FLYWEEL_CAMPAIGN_ONLY_WARNING, FLYWEEL_PARTIAL_HEALTHY_MESSAGE, flyweelCampaignOnlyWarning } from "@/lib/ads/providers/config";
import { warehouseFinishErrorFromMetadata, parseSyncRunMetadata } from "@/lib/platform/sync-run-state";
import { sanitizeFlyweelUserError } from "@/lib/ads/providers/flyweel-errors";
import {
  buildMetaFactIndexes,
  metaCreditForOrders,
} from "@/lib/attribution/meta-credit";
import {
  ALL_CAMPAIGNS_KEY,
  dailyObservedByEntity,
  dailyObservedMetaRevenue,
  measureMetaIdCoverage,
  rollupObservedMetaChildren,
} from "@/lib/attribution/observed-meta-grain";
import { ratio } from "@/lib/metrics/formulas";
import { loggedFallback } from "@/lib/observability/loader-log";


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
  const [connection, facts, cache, lastSync, lastAttempt, warehouse, shopify, adsetFacts, adFacts, creativeByAdId, ingestCounts] = await Promise.all([
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
    getCampaignFacts(period),
    loadMetaCache().catch(loggedFallback("meta_cache_file", { syncedAt: undefined })),
    latestSuccessfulSync("meta").catch(loggedFallback("meta_last_sync", null)),
    latestSync("meta").catch(loggedFallback("meta_last_attempt", null)),
    platformWarehouseStatus().catch(
      loggedFallback("meta_warehouse_status", {
        ready: false,
        projectId: "",
        dataset: "goodsnova_platform",
        serviceAccount: "",
        message: "Warehouse check failed.",
      }),
    ),
    getShopifyOverviewMetrics().catch(loggedFallback("meta_shopify", null)),
    getAdsetFacts(period).catch(loggedFallback("meta_adset_facts", [])),
    getAdFacts(period).catch(loggedFallback("meta_ad_facts", [])),
    getAdCreativeMap().catch(loggedFallback("meta_creative_map", new Map<string, string>())),
    getMetaFactTableCounts(),
  ]);
  let attrWarehouse: Awaited<ReturnType<typeof getWarehouseMetrics>> | null = null;
  let canonical: Awaited<ReturnType<typeof getCanonicalAttributedOrders>> = [];
  let ourAttributionError: string | null = null;
  try {
    attrWarehouse = await getWarehouseMetrics({
      lookbackDays: DEFAULT_ATTRIBUTION_WINDOW_DAYS,
    });
    if (attrWarehouse.status.state === "error") {
      ourAttributionError = attrWarehouse.status.message;
    } else {
      canonical = await getCanonicalAttributedOrders({
        lookbackDays: DEFAULT_ATTRIBUTION_WINDOW_DAYS,
      });
    }
  } catch (error) {
    ourAttributionError =
      error instanceof Error ? error.message : "Canonical attribution is unavailable.";
  }
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
    totals.spend > 0 ? [] : await getCampaignFacts(getDashboardPeriod("7d"));
  const weekTotals = totalsFromFacts(weekFacts);
  const days = pacificDaysInRange(period.startDate, period.endDate);
  const currency = "USD";
  const viewContext = `Meta Ads · ${period.label} · ${period.startDate} to ${period.endDate}`;
  const flyweelSyncMeta = parseSyncRunMetadata(lastSync?.metadata || lastAttempt?.metadata);
  const flyweelHealthNote =
    typeof flyweelSyncMeta.flyweel_health_message === "string"
      ? flyweelSyncMeta.flyweel_health_message
      : null;
  const skippedFlyweelMetrics = Array.isArray(flyweelSyncMeta.flyweel_unknown_metrics)
    ? flyweelSyncMeta.flyweel_unknown_metrics.filter((name): name is string => typeof name === "string")
    : [];
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

  const indexes = buildMetaFactIndexes({
    campaigns: facts.map((row) => ({
      campaign_id: row.campaign_id,
      campaign_name: row.campaign_name,
    })),
    adsets: adsetFacts.map((row) => ({
      adset_id: row.adset_id || "",
      campaign_id: row.campaign_id,
    })),
    ads: adFacts.map((row) => ({
      ad_id: row.ad_id || "",
      adset_id: row.adset_id || "",
      campaign_id: row.campaign_id,
    })),
    creativeByAdId,
  });
  const metaOur = metaCreditForOrders({
    orders: toMetaCreditOrders(canonical),
    model: "last_non_direct",
    windowDays: DEFAULT_ATTRIBUTION_WINDOW_DAYS,
    indexes,
  });
  const observed = rollupObservedMetaChildren(metaOur.credits);
  const idCoverage = measureMetaIdCoverage({
    touches: canonical.flatMap((order) => order.touches),
    credits: metaOur.credits,
  });
  const campaignSeries = dailyObservedByEntity(metaOur.credits, days, "campaign");
  const adsetSeries = dailyObservedByEntity(metaOur.credits, days, "adset");
  const adSeries = dailyObservedByEntity(metaOur.credits, days, "ad");
  const allCampaignPoints = dailyObservedMetaRevenue(metaOur.credits, days, "campaign");
  const allCampaigns = {
    key: ALL_CAMPAIGNS_KEY,
    label: "All campaigns",
    revenue: allCampaignPoints.reduce((sum, point) => sum + point.revenue, 0),
    attributedOrders: allCampaignPoints.reduce((sum, point) => sum + point.attributedOrders, 0),
    uniqueOrders: allCampaignPoints.reduce((sum, point) => sum + point.uniqueOrders, 0),
    newCustomerCredit: allCampaignPoints.reduce((sum, point) => sum + point.newCustomerCredit, 0),
    newCustomerRevenue: allCampaignPoints.reduce((sum, point) => sum + point.newCustomerRevenue, 0),
    points: allCampaignPoints,
  };
  const ourRoas = ratio(observed.parentRevenue, claimed.spend);
  const campaignRows = joinMetaAndOurCampaigns(
    facts,
    attrWarehouse?.campaigns.filter(
      (row: { channel: string }) => row.channel === "Facebook / Meta Ads",
    ) ?? [],
    newCustomerCreditByCampaign(
      canonical,
      "last_non_direct",
      DEFAULT_ATTRIBUTION_WINDOW_DAYS,
    ),
    newCustomerRevenueByCampaign(
      canonical,
      "last_non_direct",
      DEFAULT_ATTRIBUTION_WINDOW_DAYS,
    ),
  );
  const platformDaily = {
    spend: dailyMetricSeries(facts, days, "spend"),
    purchase_value: dailyMetricSeries(facts, days, "purchase_value"),
    purchases: dailyMetricSeries(facts, days, "purchases"),
    roas: dailyMetricSeries(facts, days, "roas"),
    cpa: dailyMetricSeries(facts, days, "cpa"),
    cpm: dailyMetricSeries(facts, days, "cpm"),
    ctr: dailyMetricSeries(facts, days, "ctr"),
    cpc: dailyMetricSeries(facts, days, "cpc"),
    frequency: dailyMetricSeries(facts, days, "frequency"),
  };
  const platformDailyByCampaign: Record<string, typeof platformDaily> = {};
  for (const id of [...new Set(facts.map((row) => row.campaign_id).filter(Boolean))]) {
    const slice = facts.filter((row) => row.campaign_id === id);
    platformDailyByCampaign[id] = {
      spend: dailyMetricSeries(slice, days, "spend"),
      purchase_value: dailyMetricSeries(slice, days, "purchase_value"),
      purchases: dailyMetricSeries(slice, days, "purchases"),
      roas: dailyMetricSeries(slice, days, "roas"),
      cpa: dailyMetricSeries(slice, days, "cpa"),
      cpm: dailyMetricSeries(slice, days, "cpm"),
      ctr: dailyMetricSeries(slice, days, "ctr"),
      cpc: dailyMetricSeries(slice, days, "cpc"),
      frequency: dailyMetricSeries(slice, days, "frequency"),
    };
  }

  return (
    <>
      <Header
        title="Meta Ads"
        description="Platform campaign reporting from Flyweel with GoodsNova first-party attribution down to ad set and ad when captured."
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
        {lastAttempt?.status === "failed" && lastAttempt.error_message ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
            Last sync error: {sanitizeFlyweelUserError(lastAttempt.error_message)}
          </p>
        ) : null}
        {warehouseFinishErrorFromMetadata(lastAttempt?.metadata) ||
        warehouseFinishErrorFromMetadata(lastSync?.metadata) ? (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Warehouse sync history write failed:{" "}
            {warehouseFinishErrorFromMetadata(lastAttempt?.metadata) ||
              warehouseFinishErrorFromMetadata(lastSync?.metadata)}
          </p>
        ) : null}
        {flyweelCampaignOnlyWarning(connection.provider) ? (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {FLYWEEL_PARTIAL_HEALTHY_MESSAGE} {FLYWEEL_CAMPAIGN_ONLY_WARNING}
          </p>
        ) : null}
        {flyweelHealthNote ? (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {flyweelHealthNote}
            {skippedFlyweelMetrics.length ? (
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer">View technical details</summary>
                <p className="mt-1">Skipped unsupported Flyweel metrics: {skippedFlyweelMetrics.join(", ")}</p>
              </details>
            ) : null}
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
              <li>Press <strong>Refresh Meta</strong> once and wait up to 5 minutes.</li>
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
        <MetaIngestHealthPanel
          providerId={connection.provider}
          counts={ingestCounts}
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Spend"
            source="Meta platform · Flyweel · campaign level"
            value={
              claimed.spend === null
                ? null
                : formatMoney({ amount: claimed.spend, currencyCode: currency })
            }
          />
          <MetricCard
            label="Meta revenue"
            source="Meta platform purchase value"
            value={
              claimed.revenue === null
                ? null
                : formatMoney({ amount: claimed.revenue, currencyCode: currency })
            }
          />
          <MetricCard
            label="OUR attributed revenue"
            source="GoodsNova first-party attribution"
            value={
              ourAttributionError
                ? null
                : formatMoney({ amount: observed.parentRevenue, currencyCode: currency })
            }
          />
          <MetricCard
            label="Meta ROAS"
            source="Meta purchase value ÷ spend"
            value={totals.roas === null ? null : `${totals.roas.toFixed(2)}x`}
          />
          <MetricCard
            label="OUR ROAS"
            source="OUR Meta revenue ÷ Flyweel campaign spend"
            value={ourAttributionError || ourRoas == null ? null : `${ourRoas.toFixed(2)}x`}
          />
          <MetricCard
            label="OUR attributed orders"
            source="Existing model credit"
            value={
              ourAttributionError
                ? null
                : formatNumber(Math.round(observed.parentAttributedOrders * 10) / 10)
            }
          />
        </div>
        <MetaPerformanceWorkspace
          currencyCode={currency}
          days={days}
          campaigns={campaignRows}
          adsets={observed.adsets}
          ads={observed.ads}
          campaignSeries={campaignSeries}
          adsetSeries={adsetSeries}
          adSeries={adSeries}
          allCampaigns={allCampaigns}
          platformDaily={platformDaily}
          platformDailyByCampaign={platformDailyByCampaign}
        />
        <p className="text-xs text-muted">
          <Link prefetch={false} className="underline" href="/meta/creatives">
            Creatives / content
          </Link>
          {" · labeled from utm_content / ad name when captured, not a Meta creative ID unless Flyweel supplies one."}
        </p>
        <details>
          <summary className="cursor-pointer text-xs text-muted">More platform metrics</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
            <MetricCard
              label="Blended nCAC (Meta is current paid spend source)"
              source="Meta spend ÷ Shopify new-customer orders (store-wide, not Meta-attributed new customers)"
              value={
                metaNcCac === null
                  ? null
                  : formatMoney({ amount: metaNcCac, currencyCode: currency })
              }
            />
            <MetricCard
              label="New-customer ROAS (store-wide)"
              source="Shopify new-customer revenue ÷ Meta spend. Not Meta-attributed new-customer ROAS."
              value={metaNcRoas === null ? null : `${metaNcRoas.toFixed(2)}x`}
            />
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
          </div>
        </details>
        {ourAttributionError ? (
          <EmptyPanel
            title="OUR campaign attribution unavailable"
            description={ourAttributionError}
          />
        ) : (
          <details>
            <summary className="cursor-pointer text-xs text-muted">Tracking health / mapping diagnostics</summary>
            <div className="mt-4 space-y-4">
              <MetaIdCoveragePanel coverage={idCoverage} />
              <UnmappedMetaBucket
                currencyCode={currency}
                channelRevenue={metaOur.channelCredit}
                campaignMappedRevenue={metaOur.campaignMappedCredit}
                adsetMappedRevenue={observed.adsets.reduce((sum, row) => sum + row.attributedRevenue, 0)}
                adMappedRevenue={observed.ads.reduce((sum, row) => sum + row.attributedRevenue, 0)}
              />
            </div>
          </details>
        )}
        <AskAiPanel viewContext={viewContext} />
      </section>
    </>
  );
}
