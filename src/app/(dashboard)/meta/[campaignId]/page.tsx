import type { Metadata } from "next";
import Link from "next/link";
import { AskAiPanel } from "@/components/dashboard/AskAiPanel";
import { EmptyPanel } from "@/components/dashboard/EmptyPanel";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ObservedAdsetTable } from "@/components/dashboard/ObservedChildTable";
import { ObservedBarChart } from "@/components/dashboard/MetaAnalyticsChart";
import { OurAttributedOrders } from "@/components/dashboard/OurAttributedOrders";
import { CopyIdButton } from "@/components/dashboard/CopyIdButton";
import { Header } from "@/components/layout/Header";
import { getMetaConnectionPublic } from "@/lib/ads/meta-credentials";
import { flyweelCampaignOnlyWarning } from "@/lib/ads/providers/config";
import {
  getAdsetFacts,
  getCampaignFacts,
  getAdFacts,
  getAdCreativeMap,
  rollupCampaigns,
} from "@/lib/ads/meta-query";
import { formatMoney, formatNumber } from "@/lib/format";
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
import {
  metaCreditsForCampaign,
  rollupObservedMetaChildren,
} from "@/lib/attribution/observed-meta-grain";
import { displayCampaignName, shortenId } from "@/lib/attribution/campaign-map";
import { ratio } from "@/lib/metrics/formulas";

export const metadata: Metadata = { title: "Meta campaign" };

export default async function MetaCampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const period = await getSelectedPeriod();
  const [campaignFacts, adsetFacts, adFacts, creativeByAdId, connection, canonicalLoad] =
    await Promise.all([
      getCampaignFacts(period).catch(() => []),
      getAdsetFacts(period, campaignId).catch(() => []),
      getAdFacts(period, { campaignId }).catch(() => []),
      getAdCreativeMap().catch(() => new Map<string, string>()),
      getMetaConnectionPublic().catch(() => ({ provider: "none" as const })),
      getCanonicalAttributedOrders({
        lookbackDays: DEFAULT_ATTRIBUTION_WINDOW_DAYS,
      }).then(
        (rows) => ({ rows, error: null as string | null }),
        (error) => ({
          rows: [] as Awaited<ReturnType<typeof getCanonicalAttributedOrders>>,
          error: error instanceof Error ? error.message : "OUR attribution unavailable.",
        }),
      ),
    ]);
  const canonical = canonicalLoad.rows;
  const ourError = canonicalLoad.error;
  const platformChildUnavailable = Boolean(flyweelCampaignOnlyWarning(connection.provider));
  const campaign = rollupCampaigns(campaignFacts).find((row) => row.id === campaignId);
  const currency = "USD";
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
  const campaignCredits = metaCreditsForCampaign(metaOur.credits, {
    platformCampaignId: campaignId,
    campaignName: campaign?.name,
  });
  const observed = rollupObservedMetaChildren(campaignCredits);
  const ordersById = new Map(canonical.map((order) => [order.transactionId, order]));
  const title = displayCampaignName(campaign?.name || campaignCredits[0]?.campaign || "Campaign");
  const ourRoas = ratio(observed.parentRevenue, campaign?.spend ?? null);
  const newCustomerCredit = campaignCredits.reduce((sum, credit) => sum + credit.newCustomerCredit, 0);
  const attributedNcac =
    campaign && campaign.spend > 0 && newCustomerCredit > 0 ? campaign.spend / newCustomerCredit : null;

  return (
    <>
      <Header
        title={title}
        description={`Platform campaign reporting from Flyweel with GoodsNova first-party attribution down to ad set and ad when captured. ${period.label}.`}
      />
      <section className="dash-page gap-6">
        <p className="text-sm text-muted">
          <Link prefetch={false} href="/meta" className="text-accent hover:underline">
            ← Meta Ads
          </Link>
          {" · "}
          <Link prefetch={false} href="/meta/creatives" className="text-accent hover:underline">
            Creatives
          </Link>
        </p>
        {campaign?.id ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            Flyweel campaign ID
            <span className="font-mono text-foreground">{shortenId(campaign.id)}</span>
            <CopyIdButton value={campaign.id} />
            <span>not native Meta campaign ID</span>
          </div>
        ) : null}

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Platform performance</h2>
          <p className="mt-1 text-[11px] text-muted">Meta platform · Flyweel · campaign level</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
            <MetricCard
              label="Spend"
              source="Flyweel · campaign level"
              value={campaign ? formatMoney({ amount: campaign.spend, currencyCode: currency }) : null}
            />
            <MetricCard
              label="Impressions"
              source="Campaign-level insights"
              value={campaign ? formatNumber(campaign.impressions) : null}
            />
            <MetricCard
              label="Reach"
              source="Do not sum reach across ads"
              value={campaign ? formatNumber(campaign.reach) : null}
            />
            <MetricCard
              label="Clicks"
              source="Campaign-level insights"
              value={campaign ? formatNumber(campaign.clicks) : null}
            />
            <MetricCard
              label="CTR"
              source="Clicks ÷ impressions"
              value={campaign?.ctr == null ? null : `${(campaign.ctr * 100).toFixed(2)}%`}
            />
            <MetricCard
              label="CPC"
              source="Spend ÷ clicks"
              value={campaign?.cpc == null ? null : formatMoney({ amount: campaign.cpc, currencyCode: currency })}
            />
            <MetricCard
              label="CPM"
              source="Spend / impressions × 1000"
              value={campaign?.cpm == null ? null : formatMoney({ amount: campaign.cpm, currencyCode: currency })}
            />
            <MetricCard
              label="Frequency"
              source="Impressions ÷ reach"
              value={campaign ? campaign.frequency.toFixed(2) : null}
            />
            <MetricCard
              label="Purchases"
              source="Ads Manager matching"
              value={campaign ? formatNumber(campaign.purchases) : null}
            />
            <MetricCard
              label="CPA"
              source="Spend ÷ purchases"
              value={campaign?.cpa == null ? null : formatMoney({ amount: campaign.cpa, currencyCode: currency })}
            />
            <MetricCard
              label="Meta revenue"
              source="Meta platform purchase value"
              value={campaign ? formatMoney({ amount: campaign.purchaseValue, currencyCode: currency }) : null}
            />
            <MetricCard
              label="Meta ROAS"
              source="Purchase value ÷ spend"
              value={campaign?.roas == null ? null : `${campaign.roas.toFixed(2)}x`}
            />
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">GoodsNova attribution</h2>
          <p className="mt-1 text-[11px] text-muted">First-party observed credit. Flyweel does not provide ad-set spend.</p>
          {ourError ? (
            <div className="mt-3">
              <EmptyPanel title="OUR attribution unavailable" description={ourError} />
            </div>
          ) : (
            <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                label="OUR revenue"
                source="GoodsNova attribution"
                value={formatMoney({ amount: observed.parentRevenue, currencyCode: currency })}
              />
              <MetricCard
                label="Attributed orders"
                source="sum(credit.weight)"
                value={formatNumber(Math.round(observed.parentAttributedOrders * 10) / 10)}
              />
              <MetricCard
                label="OUR ROAS"
                source="OUR campaign revenue ÷ Flyweel campaign spend"
                value={ourRoas == null ? null : `${ourRoas.toFixed(2)}x`}
              />
              <MetricCard
                label="New customer credit"
                source="Fractional new-customer credit"
                value={formatNumber(Math.round(newCustomerCredit * 100) / 100)}
              />
              <MetricCard
                label="Attributed nCAC"
                source="Campaign spend ÷ new-customer credit"
                value={
                  attributedNcac == null
                    ? null
                    : formatMoney({ amount: attributedNcac, currencyCode: currency })
                }
              />
            </div>
          )}
        </div>

        {ourError ? null : (
          <>
            <ObservedBarChart
              title="OUR attributed revenue by ad set"
              grain="adset"
              rows={observed.adsets.map((row) => ({
                label: row.adsetLabel,
                revenue: row.attributedRevenue,
                attributedOrders: row.attributedOrders,
              }))}
              currencyCode={currency}
              emptyLabel="No observed ad-set IDs in this range."
            />
            <ObservedAdsetTable
              adsets={observed.adsets}
              unidentified={observed.unidentifiedAdset}
              conflict={observed.conflict}
              currencyCode={currency}
              parentRevenue={observed.parentRevenue}
            />
            {platformChildUnavailable ? (
              <p className="text-[11px] text-muted">
                Platform ad-set metrics unavailable from Flyweel.
              </p>
            ) : null}
            <OurAttributedOrders
              title="Orders behind OUR campaign revenue"
              credits={campaignCredits}
              ordersById={ordersById}
              currencyCode={currency}
            />
          </>
        )}
        <AskAiPanel viewContext={`Meta campaign ${title} · ${period.label}`} />
      </section>
    </>
  );
}
