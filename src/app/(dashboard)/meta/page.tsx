import type { Metadata } from "next";
import Link from "next/link";
import { AskAiPanel } from "@/components/dashboard/AskAiPanel";
import { EmptyPanel } from "@/components/dashboard/EmptyPanel";
import { MetaEntityTable } from "@/components/dashboard/MetaEntityTable";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { MetaPerformanceChart } from "@/components/dashboard/MetaPerformanceChart";
import { RefreshControls } from "@/components/dashboard/RefreshControls";
import { Header } from "@/components/layout/Header";
import { getMetaConnectionPublic } from "@/lib/ads/meta-credentials";
import {
  dailyMetricSeries,
  getCampaignFacts,
  rollupCampaigns,
  totalsFromFacts,
} from "@/lib/ads/meta-query";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { platformWarehouseStatus } from "@/lib/platform/bq";
import { getSelectedPeriod } from "@/lib/period-server";
import { pacificDaysInRange } from "@/lib/period";
import { loadMetaCache } from "@/lib/ads/meta-query";
import { latestSuccessfulSync, latestSync } from "@/lib/platform/sync-runs";

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
        <section className="flex flex-1 flex-col gap-6 p-8">
          <EmptyPanel title="Meta page hit a server error" description={message} />
          <RefreshControls />
        </section>
      </>
    );
  }
}

async function renderMetaPage() {
  const period = await getSelectedPeriod();
  const [connection, facts, cache, lastSync, lastAttempt, warehouse] = await Promise.all([
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
  ]);
  const totals = totalsFromFacts(facts);
  const campaigns = rollupCampaigns(facts);
  const days = pacificDaysInRange(period.startDate, period.endDate);
  const currency = "USD";
  const viewContext = `Meta Ads · ${period.label} · ${period.startDate} to ${period.endDate}`;

  return (
    <>
      <Header
        title="Meta Ads"
        description="Platform-attributed Meta reporting (Ads Manager matching). Not Shopify gn_* first-touch. Timezone America/Los_Angeles."
      />
      <section className="flex flex-1 flex-col gap-6 p-8">
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
        {/invalid api key|FLYWEEL_API_KEY/i.test(lastAttempt?.error_message || "") ? (
          <article className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-950">
            <h2 className="font-semibold">The Flyweel key on Vercel is wrong</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Open Flyweel → Settings → API &amp; MCP → Advanced: use an API key.</li>
              <li>Generate a new key and copy the full <code className="rounded bg-white px-1">fwl_</code> string immediately. You cannot copy it later from the list.</li>
              <li>Vercel → Project → Settings → Environment Variables → Production: set <code className="rounded bg-white px-1">FLYWEEL_API_KEY</code> to that full value. Redeploy Production.</li>
              <li>Do not use Add to Cursor, mcp.json, or the <code className="rounded bg-white px-1">fwl_abcd…</code> prefix shown in the token list.</li>
              <li>Come back here and press Refresh Meta.</li>
            </ol>
          </article>
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
            source="Meta insights · platform"
            value={facts.length ? formatMoney({ amount: totals.spend, currencyCode: currency }) : null}
          />
          <MetricCard
            label="Purchase value"
            source="Meta actions purchase value"
            value={facts.length ? formatMoney({ amount: totals.purchaseValue, currencyCode: currency }) : null}
          />
          <MetricCard
            label="Purchases"
            source="Meta attributed purchases"
            value={facts.length ? formatNumber(totals.purchases) : null}
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Reach"
            source="Do not sum reach across ads"
            value={facts.length ? formatNumber(totals.reach) : null}
          />
          <MetricCard
            label="Impressions"
            source="Campaign-level insights"
            value={facts.length ? formatNumber(totals.impressions) : null}
          />
          <MetricCard
            label="Frequency"
            source="Reach / impressions at campaign grain"
            value={facts.length ? totals.frequency.toFixed(2) : null}
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
        </p>
          <div className="mt-4">
            <MetaEntityTable
              rows={campaigns}
              currency={currency}
              hrefPrefix="/meta"
            />
          </div>
        </article>
        <AskAiPanel viewContext={viewContext} />
      </section>
    </>
  );
}
