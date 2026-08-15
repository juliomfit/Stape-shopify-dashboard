import type { Metadata } from "next";
import { AskAiPanel } from "@/components/dashboard/AskAiPanel";
import { MetaEntityTable } from "@/components/dashboard/MetaEntityTable";
import { Header } from "@/components/layout/Header";
import Link from "next/link";
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
  const ads = rollupAds(await getAdFacts(period, { campaignId, adsetId }).catch(() => []));

  return (
    <>
      <Header
        title="Ads"
        description={`Ads in ad set ${adsetId}. Thumbnails appear after creatives sync into BigQuery. ${period.label}.`}
      />
      <section className="dash-page gap-6">
        <p className="text-sm text-muted">
          <Link href={`/meta/${campaignId}`} className="text-accent hover:underline">
            ← Ad sets
          </Link>
          {" · "}
          <Link href="/meta/creatives" className="text-accent hover:underline">
            Creatives
          </Link>
        </p>
        <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <MetaEntityTable
            rows={ads}
            emptyTitle="No ads in the warehouse"
            emptyWhy="Flyweel campaign ingest does not write ad-level rows. Thumbnails need Meta Graph later. Use Creatives for campaign CPA in this period."
            emptyNext={[
              { kind: "href", href: "/meta/creatives", label: "Creatives" },
              { kind: "href", href: `/meta/${campaignId}`, label: "Campaign" },
            ]}
          />
        </article>
        <AskAiPanel
          viewContext={`Meta ads · campaign ${campaignId} · adset ${adsetId} · ${period.label}`}
        />
      </section>
    </>
  );
}
