import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { MetaPerformanceWorkspace } from "@/components/dashboard/MetaPerformanceWorkspace";
import { isMetaStoryAllowed } from "@/lib/attribution/meta-story-guard";
import {
  META_STORY_ADS,
  META_STORY_ADSET_SERIES,
  META_STORY_ADSETS,
  META_STORY_AD_SERIES,
  META_STORY_ALL_CAMPAIGNS,
  META_STORY_CAMPAIGNS,
  META_STORY_CAMPAIGN_SERIES,
  META_STORY_DAYS,
  META_STORY_PLATFORM_BY_CAMPAIGN,
  META_STORY_PLATFORM_DAILY,
} from "@/lib/attribution/meta-performance-demo";

export const metadata: Metadata = {
  title: "Meta Ads story fixture",
  robots: { index: false, follow: false },
};

export default function MetaStoryPage() {
  if (!isMetaStoryAllowed(process.env.VERCEL_ENV)) {
    notFound();
  }
  return (
    <>
      <Header
        title="Meta Ads story fixture"
        description="Screenshot-only sample rows. Not production warehouse data and not a data loader."
      />
      <section className="dash-page gap-6">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          Story fixture for layout review. These rows never enter getCampaignFacts, canonical orders, or cache.
        </p>
        <MetaPerformanceWorkspace
          currencyCode="USD"
          days={META_STORY_DAYS}
          campaigns={META_STORY_CAMPAIGNS}
          adsets={META_STORY_ADSETS}
          ads={META_STORY_ADS}
          campaignSeries={META_STORY_CAMPAIGN_SERIES}
          adsetSeries={META_STORY_ADSET_SERIES}
          adSeries={META_STORY_AD_SERIES}
          allCampaigns={META_STORY_ALL_CAMPAIGNS}
          platformDaily={META_STORY_PLATFORM_DAILY}
          platformDailyByCampaign={META_STORY_PLATFORM_BY_CAMPAIGN}
        />
      </section>
    </>
  );
}
