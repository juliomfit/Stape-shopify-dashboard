import type { Metadata } from "next";
import Link from "next/link";
import { EmptyPanel } from "@/components/dashboard/EmptyPanel";
import { Header } from "@/components/layout/Header";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { OurAttributedOrders } from "@/components/dashboard/OurAttributedOrders";
import { ObservedAdsetTable, ObservedAdTable } from "@/components/dashboard/ObservedChildTable";
import { ObservedBarChart } from "@/components/dashboard/MetaAnalyticsChart";
import { CopyIdButton } from "@/components/dashboard/CopyIdButton";
import { FirstPartyIdBadge } from "@/components/dashboard/MetaSourceBadges";
import {
  getAdCreativeMap,
  getAdFacts,
  getAdsetFacts,
  getCampaignFacts,
} from "@/lib/ads/meta-query";
import { getSelectedPeriod } from "@/lib/period-server";
import { DEFAULT_ATTRIBUTION_WINDOW_DAYS } from "@/lib/attribution/windows";
import {
  getCanonicalAttributedOrders,
  toMetaCreditOrders,
} from "@/lib/warehouse/canonical-orders";
import {
  buildMetaFactIndexes,
  metaCreditForOrders,
  UNMAPPED_META_LABEL,
} from "@/lib/attribution/meta-credit";
import {
  adLabel,
  adsetLabel,
  metaCreditsForCampaign,
  rollupObservedMetaChildren,
} from "@/lib/attribution/observed-meta-grain";
import { displayCampaignName, shortenId } from "@/lib/attribution/campaign-map";
import { formatMoney, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "OUR Meta orders" };

export default async function MetaOurOrdersPage({
  params,
}: {
  params: Promise<{ grain: string; id: string }>;
}) {
  const { grain, id } = await params;
  const decodedId = decodeURIComponent(id);
  const period = await getSelectedPeriod();
  const [campaignFacts, adsetFacts, adFacts, creativeByAdId] = await Promise.all([
    getCampaignFacts(period).catch(() => []),
    getAdsetFacts(period).catch(() => []),
    getAdFacts(period).catch(() => []),
    getAdCreativeMap().catch(() => new Map<string, string>()),
  ]);

  let canonical: Awaited<ReturnType<typeof getCanonicalAttributedOrders>> = [];
  let ourError: string | null = null;
  try {
    canonical = await getCanonicalAttributedOrders({
      lookbackDays: DEFAULT_ATTRIBUTION_WINDOW_DAYS,
    });
  } catch (error) {
    ourError =
      error instanceof Error ? error.message : "Canonical attribution is unavailable.";
  }

  const indexes = buildMetaFactIndexes({
    campaigns: campaignFacts.map((row) => ({
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
  const credits =
    grain === "campaign"
      ? metaCreditsForCampaign(metaOur.credits, {
          platformCampaignId: decodedId,
          campaignName: decodedId,
        })
      : grain === "adset"
        ? metaOur.credits.filter(
            (credit) => credit.observedAdsetId === decodedId || credit.metaAdsetId === decodedId,
          )
        : grain === "ad"
          ? metaOur.credits.filter(
              (credit) => credit.observedAdId === decodedId || credit.metaAdId === decodedId,
            )
          : metaOur.credits.filter(
              (credit) =>
                credit.campaignMappingMethod === "unmapped" ||
                credit.campaignMappingMethod === "ambiguous_name" ||
                credit.sessionIdConflict ||
                credit.hierarchyConflict,
            );
  const observed = rollupObservedMetaChildren(credits);
  const ordersById = new Map(canonical.map((order) => [order.transactionId, order]));
  const currency = "USD";
  const title =
    grain === "unmapped"
      ? `${UNMAPPED_META_LABEL} orders`
      : grain === "campaign"
        ? displayCampaignName(credits[0]?.campaign || decodedId)
        : grain === "adset"
          ? adsetLabel(decodedId)
          : grain === "ad"
            ? adLabel(decodedId)
            : `OUR ${grain} ${decodedId}`;

  return (
    <>
      <Header
        title={title}
        description={`Last non-direct · ${DEFAULT_ATTRIBUTION_WINDOW_DAYS}d window · ${period.label}. Credit weights are unchanged; Meta IDs are enrichment.`}
      />
      <section className="dash-page gap-6">
        <p className="text-sm text-muted">
          <Link prefetch={false} href="/meta" className="text-accent hover:underline">
            ← Meta Ads
          </Link>
          {grain === "ad" && credits[0]?.observedAdsetId ? (
            <>
              {" · "}
              <Link
                prefetch={false}
                href={`/meta/our/adset/${encodeURIComponent(credits[0].observedAdsetId)}`}
                className="text-accent hover:underline"
              >
                Ad set
              </Link>
            </>
          ) : null}
          {grain === "adset" && credits[0]?.metaCampaignId ? (
            <>
              {" · "}
              <Link
                prefetch={false}
                href={`/meta/${encodeURIComponent(credits[0].metaCampaignId)}`}
                className="text-accent hover:underline"
              >
                Campaign
              </Link>
            </>
          ) : null}
        </p>
        {grain !== "unmapped" ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            {shortenId(decodedId) || decodedId}
            <CopyIdButton value={decodedId} />
            <FirstPartyIdBadge />
          </div>
        ) : null}
        {ourError ? (
          <EmptyPanel title="OUR attribution unavailable" description={ourError} />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="OUR attributed revenue"
                source="GoodsNova attribution"
                value={formatMoney({ amount: observed.parentRevenue, currencyCode: currency })}
              />
              <MetricCard
                label="Attributed orders"
                source="Existing model credit"
                value={formatNumber(Math.round(observed.parentAttributedOrders * 10) / 10)}
              />
              <MetricCard
                label="New customer credit"
                source="Fractional new-customer credit"
                value={formatNumber(
                  Math.round(credits.reduce((sum, credit) => sum + credit.newCustomerCredit, 0) * 100) /
                    100,
                )}
              />
              <MetricCard
                label="New customer revenue"
                source="Existing new-customer credit × revenue"
                value={formatMoney({
                  amount: credits.reduce((sum, credit) => sum + credit.newCustomerRevenue, 0),
                  currencyCode: currency,
                })}
              />
            </div>
            {grain === "campaign" ? (
              <>
                <ObservedBarChart
                  title="OUR attributed revenue by ad set"
                  rows={observed.adsets.map((row) => ({
                    label: row.adsetLabel,
                    revenue: row.attributedRevenue,
                    orders: row.attributedOrders,
                  }))}
                  currencyCode={currency}
                />
                <ObservedAdsetTable
                  adsets={observed.adsets}
                  unidentified={observed.unidentifiedAdset}
                  conflict={observed.conflict}
                  currencyCode={currency}
                  parentRevenue={observed.parentRevenue}
                />
              </>
            ) : null}
            {grain === "adset" ? (
              <>
                <ObservedBarChart
                  title="OUR attributed revenue by ad"
                  rows={observed.ads.map((row) => ({
                    label: row.adLabel,
                    revenue: row.attributedRevenue,
                    orders: row.attributedOrders,
                  }))}
                  currencyCode={currency}
                />
                <ObservedAdTable
                  ads={observed.ads}
                  unidentified={observed.unidentifiedAd}
                  conflict={observed.conflict}
                  currencyCode={currency}
                  parentRevenue={observed.parentRevenue}
                />
              </>
            ) : null}
            <OurAttributedOrders
              title={grain === "ad" ? "Orders behind this ad" : title}
              credits={credits}
              ordersById={ordersById}
              currencyCode={currency}
            />
          </>
        )}
      </section>
    </>
  );
}
