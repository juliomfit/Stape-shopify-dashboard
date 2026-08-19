export type MetaFactTableCounts = {
  available: boolean;
  campaigns: number | null;
  adsets: number | null;
  ads: number | null;
};

export function formatMetaFactTableCounts(counts: MetaFactTableCounts): string | null {
  if (!counts.available) return null;
  if (counts.campaigns == null || counts.adsets == null || counts.ads == null) return null;
  return [
    `meta_campaign_insights_daily=${counts.campaigns}`,
    `meta_adset_insights_daily=${counts.adsets}`,
    `meta_ad_insights_daily=${counts.ads}`,
  ].join(" · ");
}
