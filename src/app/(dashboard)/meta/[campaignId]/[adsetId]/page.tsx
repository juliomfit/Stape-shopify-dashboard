import type { Metadata } from "next";
import Link from "next/link";
import { AskAiPanel } from "@/components/dashboard/AskAiPanel";
import { EmptyPanel } from "@/components/dashboard/EmptyPanel";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ObservedAdTable } from "@/components/dashboard/ObservedChildTable";
import { ObservedBarChart } from "@/components/dashboard/MetaAnalyticsChart";
import { OurAttributedOrders } from "@/components/dashboard/OurAttributedOrders";
import { CopyIdButton } from "@/components/dashboard/CopyIdButton";
import { FirstPartyIdBadge } from "@/components/dashboard/MetaSourceBadges";
import { Header } from "@/components/layout/Header";
import { getMetaConnectionPublic } from "@/lib/ads/meta-credentials";
import { flyweelCampaignOnlyWarning } from "@/lib/ads/providers/config";
import {
  getAdFacts,
  getAdsetFacts,
  getCampaignFacts,
  getAdCreativeMap,
  rollupCampaigns,
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
} from "@/lib/attribution/meta-credit";
import { adsetLabel, rollupObservedMetaChildren } from "@/lib/attribution/observed-meta-grain";
import { displayCampaignName, shortenId } from "@/lib/attribution/campaign-map";
import { formatMoney, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Meta ads" };

export default async function MetaAdsetPage({
  params,
}: {
  params: Promise<{ campaignId: string; adsetId: string }>;
}) {
  const { campaignId, adsetId } = await params;
  const period = await getSelectedPeriod();
  const [campaignFacts, adsetFacts, allAdFacts, creativeByAdId, connection] = await Promise.all([
    getCampaignFacts(period).catch(() => []),
    getAdsetFacts(period, campaignId).catch(() => []),
    getAdFacts(period, { campaignId }).catch(() => []),
    getAdCreativeMap().catch(() => new Map<string, string>()),
    getMetaConnectionPublic().catch(() => ({ provider: "none" as const })),
  ]);
  const platformChildUnavailable = Boolean(flyweelCampaignOnlyWarning(connection.provider));
  const campaign = rollupCampaigns(campaignFacts).find((row) => row.id === campaignId);
  const currency = "USD";

  let canonical: Awaited<ReturnType<typeof getCanonicalAttributedOrders>> = [];
  let ourError: string | null = null;
  try {
    canonical = await getCanonicalAttributedOrders({
      lookbackDays: DEFAULT_ATTRIBUTION_WINDOW_DAYS,
    });
  } catch (error) {
    ourError = error instanceof Error ? error.message : "OUR attribution unavailable.";
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
    ads: allAdFacts.map((row) => ({
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
  const adsetCredits = metaOur.credits.filter(
    (credit) => credit.observedAdsetId === adsetId || credit.metaAdsetId === adsetId,
  );
  const observed = rollupObservedMetaChildren(adsetCredits);
  const ordersById = new Map(canonical.map((order) => [order.transactionId, order]));
  const title = adsetLabel(adsetId);

  return (
    <>
      <Header
        title={title}
        description={`GoodsNova first-party ads under this ad set. ${period.label}.`}
      />
      <section className="dash-page gap-6">
        <p className="text-sm text-muted">
          <Link prefetch={false} href={`/meta/${campaignId}`} className="text-accent hover:underline">
            ← {displayCampaignName(campaign?.name || "Campaign")}
          </Link>
          {" · "}
          <Link prefetch={false} href="/meta/creatives" className="text-accent hover:underline">
            Creatives
          </Link>
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {shortenId(adsetId)}
          <CopyIdButton value={adsetId} />
          <FirstPartyIdBadge />
        </div>
        {ourError ? (
          <EmptyPanel title="OUR ad attribution unavailable" description={ourError} />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="OUR revenue"
                source="GoodsNova attribution"
                value={formatMoney({ amount: observed.parentRevenue, currencyCode: currency })}
              />
              <MetricCard
                label="OUR orders"
                source="Existing model credit"
                value={formatNumber(Math.round(observed.parentAttributedOrders * 10) / 10)}
              />
              <MetricCard
                label="New customer credit"
                source="Fractional new-customer credit"
                value={formatNumber(
                  Math.round(
                    adsetCredits.reduce((sum, credit) => sum + credit.newCustomerCredit, 0) * 100,
                  ) / 100,
                )}
              />
              <MetricCard
                label="Ads observed"
                source="First-party ad IDs"
                value={formatNumber(observed.ads.length)}
              />
            </div>
            <ObservedBarChart
              title="OUR attributed revenue by ad"
              grain="ad"
              rows={observed.ads.map((row) => ({
                label: row.adLabel,
                revenue: row.attributedRevenue,
                attributedOrders: row.attributedOrders,
              }))}
              currencyCode={currency}
              emptyLabel="No observed ad IDs in this ad set."
            />
            <ObservedAdTable
              ads={observed.ads}
              unidentified={observed.unidentifiedAd}
              conflict={observed.conflict}
              currencyCode={currency}
              parentRevenue={observed.parentRevenue}
            />
            {platformChildUnavailable ? (
              <p className="text-[11px] text-muted">Platform ad metrics unavailable from Flyweel.</p>
            ) : null}
            <OurAttributedOrders
              title="Orders behind OUR ad-set revenue"
              credits={adsetCredits}
              ordersById={ordersById}
              currencyCode={currency}
            />
          </>
        )}
        <AskAiPanel
          viewContext={`Meta ads · campaign ${campaignId} · adset ${adsetId} · ${period.label}`}
        />
      </section>
    </>
  );
}
