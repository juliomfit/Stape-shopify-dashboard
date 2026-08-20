import type { Metadata } from "next";
import Link from "next/link";
import { AskAiPanel } from "@/components/dashboard/AskAiPanel";
import { EmptyPanel } from "@/components/dashboard/EmptyPanel";
import { MetaEntityTable } from "@/components/dashboard/MetaEntityTable";
import { OurGrainTable } from "@/components/dashboard/OurGrainTable";
import { OurAttributedOrders } from "@/components/dashboard/OurAttributedOrders";
import { Header } from "@/components/layout/Header";
import { getMetaConnectionPublic } from "@/lib/ads/meta-credentials";
import {
  FLYWEEL_PARTIAL_HEALTHY_MESSAGE,
  flyweelCampaignOnlyWarning,
} from "@/lib/ads/providers/config";
import {
  getAdFacts,
  getAdsetFacts,
  getCampaignFacts,
  getAdCreativeMap,
  rollupAds,
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


export const metadata: Metadata = { title: "Meta ads" };

export default async function MetaAdsetPage({
  params,
}: {
  params: Promise<{ campaignId: string; adsetId: string }>;
}) {
  const { campaignId, adsetId } = await params;
  const period = await getSelectedPeriod();
  const [ads, campaignFacts, adsetFacts, allAdFacts, creativeByAdId, connection] = await Promise.all([
    getAdFacts(period, { campaignId, adsetId }).catch(() => []),
    getCampaignFacts(period).catch(() => []),
    getAdsetFacts(period, campaignId).catch(() => []),
    getAdFacts(period, { campaignId }).catch(() => []),
    getAdCreativeMap().catch(() => new Map<string, string>()),
    getMetaConnectionPublic().catch(() => ({ provider: "none" as const })),
  ]);
  const childGrainUnavailable = Boolean(flyweelCampaignOnlyWarning(connection.provider));
  const rolled = rollupAds(ads);
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
  const ourByAd = new Map(metaOur.byAd.map((row) => [row.key, row]));
  const showOurAds = ourByAd.size > 0;
  const adsetCredits = metaOur.credits.filter((credit) => credit.metaAdsetId === adsetId);
  const ordersById = new Map(canonical.map((order) => [order.transactionId, order]));

  return (
    <>
      <Header
        title="Ads"
        description={`Ads in ad set ${adsetId}. PLATFORM = Ads Manager. OUR ad credit requires exact ad_id. ${period.label}.`}
      />
      <section className="dash-page gap-6">
        <p className="text-sm text-muted">
          <Link prefetch={false} href={`/meta/${campaignId}`} className="text-accent hover:underline">
            ← Ad sets
          </Link>
          {" · "}
          <Link prefetch={false} href="/meta/creatives" className="text-accent hover:underline">
            Creatives
          </Link>
        </p>
        <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Ads · platform</h2>
          <div className="mt-4">
            <MetaEntityTable
              rows={rolled}
              emptyTitle="No ads in the warehouse"
              emptyWhy="Flyweel campaign ingest does not write ad-level rows. Thumbnails need Meta Graph later. Use Creatives for campaign CPA in this period."
              emptyNext={[
                { kind: "href", href: "/meta/creatives", label: "Creatives" },
                { kind: "href", href: `/meta/${campaignId}`, label: "Campaign" },
              ]}
            />
          </div>
        </article>
        {ourError ? (
          <EmptyPanel title="OUR ad attribution unavailable" description={ourError} />
        ) : childGrainUnavailable ? (
          <EmptyPanel
            title="Ad facts unavailable"
            description={FLYWEEL_PARTIAL_HEALTHY_MESSAGE}
          />
        ) : (
          <OurGrainTable
            title="Ads · OUR (exact ad_id only)"
            grain="ad"
            platformRows={rolled}
            ourById={ourByAd}
            currencyCode={currency}
            showOur={showOurAds}
          />
        )}
        {!ourError ? (
          <OurAttributedOrders
            title="Orders behind OUR ad-set revenue"
            credits={adsetCredits}
            ordersById={ordersById}
            currencyCode={currency}
          />
        ) : null}
        <AskAiPanel
          viewContext={`Meta ads · campaign ${campaignId} · adset ${adsetId} · ${period.label}`}
        />
      </section>
    </>
  );
}
