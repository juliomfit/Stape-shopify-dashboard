import type { Metadata } from "next";
import Link from "next/link";
import { EmptyPanel } from "@/components/dashboard/EmptyPanel";
import { Header } from "@/components/layout/Header";
import { OurAttributedOrders } from "@/components/dashboard/OurAttributedOrders";
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

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "OUR Meta orders" };

export default async function MetaOurOrdersPage({
  params,
}: {
  params: Promise<{ grain: string; id: string }>;
}) {
  const { grain, id } = await params;
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
      ? metaOur.credits.filter((credit) => credit.metaCampaignId === id)
      : grain === "adset"
        ? metaOur.credits.filter((credit) => credit.metaAdsetId === id)
        : grain === "ad"
          ? metaOur.credits.filter((credit) => credit.metaAdId === id)
          : metaOur.credits.filter(
              (credit) =>
                credit.campaignMappingMethod === "unmapped" ||
                credit.campaignMappingMethod === "ambiguous_name",
            );
  const ordersById = new Map(canonical.map((order) => [order.transactionId, order]));
  const title =
    grain === "unmapped"
      ? `${UNMAPPED_META_LABEL} orders`
      : `OUR ${grain} ${id} orders`;

  return (
    <>
      <Header
        title={title}
        description={`Last non-direct · ${DEFAULT_ATTRIBUTION_WINDOW_DAYS}d window · ${period.label}. Credit weights are unchanged; Meta IDs are enrichment.`}
      />
      <section className="dash-page gap-6">
        <p className="text-sm text-muted">
          <Link href="/meta" className="text-accent hover:underline">
            ← Meta Ads
          </Link>
        </p>
        {ourError ? (
          <EmptyPanel title="OUR attribution unavailable" description={ourError} />
        ) : (
          <OurAttributedOrders
            title={title}
            credits={credits}
            ordersById={ordersById}
            currencyCode="USD"
          />
        )}
      </section>
    </>
  );
}
