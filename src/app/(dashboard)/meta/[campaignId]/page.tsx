import type { Metadata } from "next";
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

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Meta campaign" };

export default async function MetaCampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const period = await getSelectedPeriod();
  const [campaignFacts, adsetFacts] = await Promise.all([
    getCampaignFacts(period).catch(() => []),
    getAdsetFacts(period, campaignId).catch(() => []),
  ]);
  const campaign = rollupCampaigns(campaignFacts).find((row) => row.id === campaignId);
  const adsets = rollupAdsets(adsetFacts);
  const totals = totalsFromFacts(adsetFacts);
  const currency = "USD";

  return (
    <>
      <Header
        title={campaign?.name || "Campaign"}
        description={`Ad sets for campaign ${campaignId}. Platform-attributed. ${period.label}.`}
      />
      <section className="flex flex-1 flex-col gap-6 p-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Spend"
            source="Ad set insights"
            value={formatMoney({ amount: totals.spend, currencyCode: currency })}
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
          <h2 className="text-sm font-semibold text-foreground">Ad sets</h2>
          <div className="mt-4">
            <MetaEntityTable
              rows={adsets}
              hrefPrefix={`/meta/${campaignId}`}
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
