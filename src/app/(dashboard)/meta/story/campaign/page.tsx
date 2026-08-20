import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ObservedAdsetTable } from "@/components/dashboard/ObservedChildTable";
import { isMetaStoryAllowed } from "@/lib/attribution/meta-story-guard";
import { META_STORY_ADSETS, META_STORY_CAMPAIGNS } from "@/lib/attribution/meta-performance-demo";
import { formatMoney, formatNumber } from "@/lib/format";

export const metadata: Metadata = {
  title: "Meta campaign story fixture",
  robots: { index: false, follow: false },
};

export default function MetaStoryCampaignPage() {
  if (!isMetaStoryAllowed(process.env.VERCEL_ENV)) {
    notFound();
  }
  const campaign = META_STORY_CAMPAIGNS[0];
  const currency = "USD";
  const adsets = META_STORY_ADSETS.filter((row) => row.campaignLabel === campaign.campaignName);
  const empty = {
    key: "none",
    label: "",
    presence: "missing" as const,
    attributedOrders: 0,
    attributedRevenue: 0,
    newCustomerCredit: 0,
    newCustomerRevenue: 0,
    numberOfOrders: 0,
  };
  return (
    <>
      <Header title={campaign.campaignName} description="Screenshot-only campaign drilldown. Not production data." />
      <section className="dash-page gap-6">
        <p className="text-sm text-muted">
          <Link prefetch={false} href="/meta/story" className="text-accent hover:underline">
            ← Meta Ads story
          </Link>
        </p>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Platform performance</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
            <MetricCard label="Spend" source="Flyweel · campaign level" value={formatMoney({ amount: campaign.spend, currencyCode: currency })} />
            <MetricCard label="Impressions" source="Campaign-level insights" value={formatNumber(campaign.impressions)} />
            <MetricCard label="Reach" source="Campaign-level insights" value={formatNumber(campaign.reach)} />
            <MetricCard label="Clicks" source="Campaign-level insights" value={formatNumber(campaign.clicks)} />
            <MetricCard label="CTR" source="Clicks ÷ impressions" value={`${((campaign.ctr ?? 0) * 100).toFixed(2)}%`} />
            <MetricCard label="CPC" source="Spend ÷ clicks" value={formatMoney({ amount: campaign.cpc ?? 0, currencyCode: currency })} />
            <MetricCard label="CPM" source="Spend / impressions × 1000" value={formatMoney({ amount: campaign.cpm ?? 0, currencyCode: currency })} />
            <MetricCard label="Frequency" source="Impressions ÷ reach" value={campaign.frequency.toFixed(2)} />
            <MetricCard label="Purchases" source="Ads Manager matching" value={formatNumber(campaign.metaPurchases)} />
            <MetricCard label="CPA" source="Spend ÷ purchases" value={formatMoney({ amount: campaign.metaCpa ?? 0, currencyCode: currency })} />
            <MetricCard label="Meta revenue" source="Meta platform purchase value" value={formatMoney({ amount: campaign.metaRevenue, currencyCode: currency })} />
            <MetricCard label="Meta ROAS" source="Purchase value ÷ spend" value={`${(campaign.metaRoas ?? 0).toFixed(2)}x`} />
          </div>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">GoodsNova attribution</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="OUR revenue" source="GoodsNova attribution" value={formatMoney({ amount: campaign.ourRevenue, currencyCode: currency })} />
            <MetricCard label="Attributed orders" source="sum(credit.weight)" value={formatNumber(campaign.ourOrders)} />
            <MetricCard label="OUR ROAS" source="OUR revenue ÷ spend" value={`${(campaign.ourRoas ?? 0).toFixed(2)}x`} />
            <MetricCard label="New customer credit" source="Fractional new-customer credit" value={formatNumber(campaign.newCustomerCredit)} />
            <MetricCard label="Attributed nCAC" source="Spend ÷ new-customer credit" value={formatMoney({ amount: campaign.attributedNcac ?? 0, currencyCode: currency })} />
          </div>
        </div>
        <ObservedAdsetTable
          adsets={adsets}
          unidentified={empty}
          conflict={empty}
          currencyCode={currency}
          parentRevenue={campaign.ourRevenue}
        />
      </section>
    </>
  );
}
