import type { Metadata } from "next";
import Link from "next/link";
import { AskAiPanel } from "@/components/dashboard/AskAiPanel";
import { EmptyPanel } from "@/components/dashboard/EmptyPanel";
import { MetaEntityTable } from "@/components/dashboard/MetaEntityTable";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { OurGrainTable } from "@/components/dashboard/OurGrainTable";
import { OurAttributedOrders } from "@/components/dashboard/OurAttributedOrders";
import { Header } from "@/components/layout/Header";
import {
  getAdsetFacts,
  getCampaignFacts,
  getAdFacts,
  getAdCreativeMap,
  rollupAdsets,
  rollupCampaigns,
  totalsFromFacts,
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

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Meta campaign" };

export default async function MetaCampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const period = await getSelectedPeriod();
  const [campaignFacts, adsetFacts, adFacts, creativeByAdId] = await Promise.all([
    getCampaignFacts(period).catch(() => []),
    getAdsetFacts(period, campaignId).catch(() => []),
    getAdFacts(period, { campaignId }).catch(() => []),
    getAdCreativeMap().catch(() => new Map<string, string>()),
  ]);
  const campaign = rollupCampaigns(campaignFacts).find((row) => row.id === campaignId);
  const adsets = rollupAdsets(adsetFacts);
  const totals = adsets.length
    ? totalsFromFacts(adsetFacts)
    : campaign
      ? {
          spend: campaign.spend,
          purchases: campaign.purchases,
          purchaseValue: campaign.purchaseValue,
          roas: campaign.roas,
          cpa: campaign.cpa,
        }
      : totalsFromFacts(adsetFacts);
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
  const ourByAdset = new Map(metaOur.byAdset.map((row) => [row.key, row]));
  const showOurAdsets = ourByAdset.size > 0;
  const campaignCredits = metaOur.credits.filter(
    (credit) => credit.metaCampaignId === campaignId,
  );
  const ordersById = new Map(canonical.map((order) => [order.transactionId, order]));

  return (
    <>
      <Header
        title={campaign?.name || "Campaign"}
        description={`Ad sets for campaign ${campaignId}. PLATFORM = Ads Manager. OUR = first-party IDs when present. ${period.label}.`}
      />
      <section className="dash-page gap-6">
        <p className="text-sm text-muted">
          <Link href="/meta" className="text-accent hover:underline">
            ← Meta Ads
          </Link>
          {" · "}
          <Link href="/meta/creatives" className="text-accent hover:underline">
            Creatives
          </Link>
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Spend"
            source={
              adsets.length
                ? "Ad set insights · platform"
                : "Campaign warehouse · Flyweel does not ingest ad sets"
            }
            value={
              campaign || adsets.length
                ? formatMoney({ amount: totals.spend, currencyCode: currency })
                : null
            }
          />
          <MetricCard
            label="Purchases"
            source="Meta attributed"
            value={formatNumber(totals.purchases)}
          />
          <MetricCard
            label="ROAS"
            source="Purchase value ÷ spend"
            value={totals.roas === null ? null : `${totals.roas.toFixed(2)}x`}
          />
          <MetricCard
            label="CPA"
            source="Spend ÷ purchases"
            value={
              totals.cpa === null
                ? null
                : formatMoney({ amount: totals.cpa, currencyCode: currency })
            }
          />
        </div>
        <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Ad sets · platform</h2>
          <div className="mt-4">
            <MetaEntityTable
              rows={adsets}
              hrefPrefix={`/meta/${campaignId}`}
              emptyTitle="No ad sets in the warehouse"
              emptyWhy="Flyweel Refresh Meta writes campaign rows. Ad sets stay empty unless Graph stored them. Campaign spend above is still the platform total for this ID and header period."
              emptyNext={[
                { kind: "href", href: "/meta/creatives", label: "Creatives" },
                { kind: "href", href: "/meta", label: "All campaigns" },
                { kind: "range", range: "7d", label: "7d" },
              ]}
            />
          </div>
        </article>
        {ourError ? (
          <EmptyPanel title="OUR ad-set attribution unavailable" description={ourError} />
        ) : (
          <OurGrainTable
            title="Ad sets · OUR (exact adset_id only)"
            grain="adset"
            platformRows={adsets}
            ourById={ourByAdset}
            currencyCode={currency}
            hrefPrefix={`/meta/${campaignId}`}
            showOur={showOurAdsets}
          />
        )}
        {!ourError ? (
          <OurAttributedOrders
            title="Orders behind OUR campaign revenue"
            credits={campaignCredits}
            ordersById={ordersById}
            currencyCode={currency}
          />
        ) : null}
        <AskAiPanel
          viewContext={`Meta campaign ${campaign?.name || campaignId} · ${period.label}`}
        />
      </section>
    </>
  );
}
