import type { Metadata } from "next";
import Link from "next/link";
import { AskAiPanel } from "@/components/dashboard/AskAiPanel";
import { EmptyPanel } from "@/components/dashboard/EmptyPanel";
import { FlyweelKeyForm } from "@/components/dashboard/FlyweelKeyForm";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { MetaPerformanceWorkspace } from "@/components/dashboard/MetaPerformanceWorkspace";
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
import { latestSuccessfulSync, latestSync } from "@/lib/platform/sync-runs";
import { shopifyMetricsSince } from "@/lib/dashboard/aligned-period";
import { DEFAULT_ATTRIBUTION_WINDOW_DAYS } from "@/lib/attribution/windows";
import { newCustomerCac, newCustomerRoas } from "@/lib/metrics/formulas";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";
import { MetaIdCoveragePanel } from "@/components/dashboard/MetaIdCoveragePanel";
import { UnmappedMetaBucket } from "@/components/dashboard/UnmappedMetaBucket";
import { joinMetaAndOurCampaigns } from "@/lib/attribution/campaign-map";
import { getWarehouseMetrics } from "@/lib/warehouse/get-warehouse-metrics";
import {
  getCanonicalAttributedOrders,
  newCustomerCreditByCampaign,
  newCustomerRevenueByCampaign,
  toMetaCreditOrders,
} from "@/lib/warehouse/canonical-orders";
import { getAdsetFacts, getAdFacts, getAdCreativeMap } from "@/lib/ads/meta-query";
import { FLYWEEL_PARTIAL_HEALTHY_MESSAGE, flyweelCampaignOnlyWarning } from "@/lib/ads/providers/config";
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
          <p className="text-sm text-muted">
            Provider jobs continue in the background. Open Health to retry a refresh.
          </p>
        </section>
      </>
    );
  }
}

async function renderMetaPage() {
  const period = await getSelectedPeriod();
  const [connection, facts, lastSync, lastAttempt, warehouse, shopify, adsetFacts, adFacts, creativeByAdId, attrWarehouseResult, canonicalResult] = await Promise.all([
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
    getWarehouseMetrics({
      lookbackDays: DEFAULT_ATTRIBUTION_WINDOW_DAYS,
    }).catch(loggedFallback("meta_attr_warehouse", null)),
    getCanonicalAttributedOrders({
      lookbackDays: DEFAULT_ATTRIBUTION_WINDOW_DAYS,
    }).catch(loggedFallback("meta_canonical", [] as Awaited<ReturnType<typeof getCanonicalAttributedOrders>>)),
  ]);
  const attrWarehouse: Awaited<ReturnType<typeof getWarehouseMetrics>> | null = attrWarehouseResult;
  const canonical: Awaited<ReturnType<typeof getCanonicalAttributedOrders>> = canonicalResult ?? [];
  let ourAttributionError: string | null = null;
  if (attrWarehouse?.status.state === "error") {
    ourAttributionError = attrWarehouse.status.message;
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
        {flyweelCampaignOnlyWarning(connection.provider) ? (
          <p className="text-xs text-muted">{FLYWEEL_PARTIAL_HEALTHY_MESSAGE}</p>
        ) : null}
        {lastSync && totals.spend === 0 && weekTotals.spend > 0 ? (
          <p className="text-sm text-muted">
            This date range has $0 platform spend. Last 7 days has{" "}
            {formatMoney({ amount: weekTotals.spend, currencyCode: currency })}.
          </p>
        ) : null}
        {facts.length === 0 && !lastSync ? (
          <EmptyPanel
            title="Meta campaign data is not loaded yet"
            description="Background Meta ingest fills this page. Open Health if you need to start a refresh."
          />
        ) : null}
        {/invalid api key|rejected the API key/i.test(lastAttempt?.error_message || "") ? (
          <FlyweelKeyForm accountId={connection.adAccountId} keyHint={connection.tokenHint} />
        ) : null}
        {!warehouse.ready ? (
          <p className="text-sm text-muted">{warehouse.message}</p>
        ) : null}
        {!connection.configured && facts.length === 0 ? (
          <EmptyPanel
            title="Meta is not connected"
            description="Add the Flyweel API key in Integrations. Dashboard pages never call Flyweel while you browse."
          />
        ) : null}
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
