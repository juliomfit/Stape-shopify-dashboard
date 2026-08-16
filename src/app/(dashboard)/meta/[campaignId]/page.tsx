import type { Metadata } from "next";
import Link from "next/link";
import { AskAiPanel } from "@/components/dashboard/AskAiPanel";
import { MetaEntityTable } from "@/components/dashboard/MetaEntityTable";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Header } from "@/components/layout/Header";
import {
  getAdsetFacts,
  getCampaignFacts,
  rollupAdsets,
  rollupCampaigns,
  totalsFromFacts,
} from "@/lib/ads/meta-query";
import { formatMoney, formatNumber } from "@/lib/format";
import { getSelectedPeriod } from "@/lib/period-server";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";
import { gnCampaignExactMatch } from "@/lib/shopify/gn-campaign";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Meta campaign" };

export default async function MetaCampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const period = await getSelectedPeriod();
  const [campaignFacts, adsetFacts, shopify] = await Promise.all([
    getCampaignFacts(period).catch(() => []),
    getAdsetFacts(period, campaignId).catch(() => []),
    getShopifyOverviewMetrics().catch(() => null),
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
  const inRangeOrders = (shopify?.orderPoints || []).filter((order) => {
    const created = new Date(order.createdAt).getTime();
    return created >= period.startMs && created < period.endMs;
  });
  const gn = campaign
    ? gnCampaignExactMatch(campaign.name, inRangeOrders)
    : { matched: false, orders: 0, revenue: 0 };

  return (
    <>
      <Header
        title={campaign?.name || "Campaign"}
        description={`Ad sets for campaign ${campaignId}. Platform-attributed. ${period.label}.`}
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
          <MetricCard
            label="gn_* orders"
            source={
              gn.matched
                ? "Shopify orders whose utm campaign equals this Meta name · not Ads Manager"
                : "No Shopify gn_* campaign with this exact name"
            }
            value={gn.matched ? formatNumber(gn.orders) : null}
          />
          <MetricCard
            label="gn_* revenue"
            source="Same exact-name match · True Performance, not platform ROAS"
            value={
              gn.matched
                ? formatMoney({ amount: gn.revenue, currencyCode: currency })
                : null
            }
          />
        </div>
        <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Ad sets</h2>
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
        <AskAiPanel
          viewContext={`Meta campaign ${campaign?.name || campaignId} · ${period.label}`}
        />
      </section>
    </>
  );
}
