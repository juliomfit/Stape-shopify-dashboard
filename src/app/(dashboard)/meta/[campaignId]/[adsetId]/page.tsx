import type { Metadata } from "next";
import { AskAiPanel } from "@/components/dashboard/AskAiPanel";
import { MetaEntityTable } from "@/components/dashboard/MetaEntityTable";
import { Header } from "@/components/layout/Header";
import { getAdFacts, rollupAds } from "@/lib/ads/meta-query";
import { getSelectedPeriod } from "@/lib/period-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Meta ads" };

export default async function MetaAdsetPage({
  params,
}: {
  params: Promise<{ campaignId: string; adsetId: string }>;
}) {
  const { campaignId, adsetId } = await params;
  const period = await getSelectedPeriod();
  const ads = rollupAds(await getAdFacts(period, { campaignId, adsetId }));

  return (
    <>
      <Header
        title="Ads"
        description={`Ads in ad set ${adsetId}. Thumbnails appear after creatives sync into BigQuery. ${period.label}.`}
      />
      <section className="flex flex-1 flex-col gap-6 p-8">
        <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <MetaEntityTable rows={ads} />
        </article>
        <AskAiPanel
          viewContext={`Meta ads · campaign ${campaignId} · adset ${adsetId} · ${period.label}`}
        />
      </section>
    </>
  );
}
