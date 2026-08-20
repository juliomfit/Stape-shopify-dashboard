/**
 * Screenshot / story fixtures for the Meta Ads performance grid.
 * Never imported by production data loaders (meta-query, warehouse, cache).
 */

import type { OurCampaignRow } from "./campaign-map.ts";
import type {
  ObservedEntityDailySeries,
  ObservedMetaAdRollup,
  ObservedMetaAdsetRollup,
} from "./observed-meta-grain.ts";

function campaign(
  partial: OurCampaignRow,
): OurCampaignRow {
  return partial;
}

export const META_STORY_DAYS = [
  "2026-08-13",
  "2026-08-14",
  "2026-08-15",
  "2026-08-16",
  "2026-08-17",
  "2026-08-18",
  "2026-08-19",
];

export const META_STORY_CAMPAIGNS: OurCampaignRow[] = [
  campaign({
    campaignId: "69ce2b5e-0000-4000-8000-00000000c90a",
    campaignName: "USA CBO | APRIL 17 | Batch 1-5",
    platformPresent: true,
    spend: 2114.85,
    impressions: 34492,
    reach: 27119,
    frequency: 1.27,
    clicks: 1453,
    linkClicks: 1028,
    ctr: 0.04213,
    cpc: 1.4555,
    cpm: 61.31,
    metaPurchases: 42,
    metaRevenue: 0,
    metaCpa: 50.3536,
    metaRoas: 0,
    ourOrders: 61.4,
    ourRevenue: 3801.74,
    ourRoas: 1.7976,
    newCustomerCredit: 28.2,
    newCustomerRevenue: 2144.1,
    attributedNcac: 74.9947,
    differencePct: null,
    mapped: true,
    mappingMethod: "campaign_name_exact_unique",
    mappingConfidence: "PARTIAL",
    mappingStatus: "campaign_name_exact_unique",
  }),
  campaign({
    campaignId: "7b11aa22-1111-4000-8000-00000000d81b",
    campaignName: "WORLDWIDE CBO | AUGST 19",
    platformPresent: true,
    spend: 980.4,
    impressions: 18820,
    reach: 15110,
    frequency: 1.25,
    clicks: 612,
    linkClicks: 448,
    ctr: 0.03252,
    cpc: 1.602,
    cpm: 52.09,
    metaPurchases: 11,
    metaRevenue: 0,
    metaCpa: 89.127,
    metaRoas: 0,
    ourOrders: 18.6,
    ourRevenue: 1422.5,
    ourRoas: 1.451,
    newCustomerCredit: 9.4,
    newCustomerRevenue: 801.2,
    attributedNcac: 104.298,
    differencePct: null,
    mapped: true,
    mappingMethod: "campaign_name_exact_unique",
    mappingConfidence: "PARTIAL",
    mappingStatus: "campaign_name_exact_unique",
  }),
  campaign({
    campaignId: "88c0bb33-2222-4000-8000-00000000e72c",
    campaignName: "ASC+ Prospecting | New Creatives",
    platformPresent: true,
    spend: 412.1,
    impressions: 9022,
    reach: 7801,
    frequency: 1.16,
    clicks: 201,
    linkClicks: 154,
    ctr: 0.02228,
    cpc: 2.05,
    cpm: 45.68,
    metaPurchases: 3,
    metaRevenue: 86.4,
    metaCpa: 137.367,
    metaRoas: 0.2097,
    ourOrders: 0,
    ourRevenue: 0,
    ourRoas: 0,
    newCustomerCredit: 0,
    newCustomerRevenue: 0,
    attributedNcac: null,
    differencePct: -1,
    mapped: false,
    mappingMethod: "unmapped",
    mappingConfidence: "NONE",
    mappingStatus: "unmapped",
  }),
];

export const META_STORY_ADSETS: ObservedMetaAdsetRollup[] = [
  {
    adsetId: "12021490009382",
    parentCampaignId: "12021490000001",
    campaignLabel: "USA CBO | APRIL 17 | Batch 1-5",
    adsetLabel: "Ad Set 12021490…9382",
    attributedOrders: 22.4,
    attributedRevenue: 1482.22,
    newCustomerCredit: 13.1,
    newCustomerRevenue: 831.11,
    shareOfParentRevenue: 0.39,
    numberOfAds: 4,
    numberOfOrders: 31,
    source: "first_party",
    platformVerified: false,
  },
  {
    adsetId: "12021490008821",
    parentCampaignId: "12021490000001",
    campaignLabel: "USA CBO | APRIL 17 | Batch 1-5",
    adsetLabel: "Ad Set 12021490…8821",
    attributedOrders: 18.2,
    attributedRevenue: 1104.4,
    newCustomerCredit: 8.8,
    newCustomerRevenue: 612.4,
    shareOfParentRevenue: 0.29,
    numberOfAds: 3,
    numberOfOrders: 22,
    source: "first_party",
    platformVerified: false,
  },
  {
    adsetId: "12021990001111",
    parentCampaignId: "12021990000002",
    campaignLabel: "WORLDWIDE CBO | AUGST 19",
    adsetLabel: "Ad Set 12021990…1111",
    attributedOrders: 12.1,
    attributedRevenue: 901.3,
    newCustomerCredit: 6.2,
    newCustomerRevenue: 440.8,
    shareOfParentRevenue: 0.237,
    numberOfAds: 2,
    numberOfOrders: 14,
    source: "first_party",
    platformVerified: false,
  },
];

export const META_STORY_ADS: ObservedMetaAdRollup[] = [
  {
    adId: "12021498389291",
    parentAdsetId: "12021490009382",
    parentCampaignId: "12021490000001",
    adLabel: "UGC Hook 3 - Woman Wall",
    attributedOrders: 8.4,
    attributedRevenue: 612.2,
    newCustomerCredit: 4.1,
    newCustomerRevenue: 301.5,
    shareOfAdsetRevenue: 0.413,
    numberOfOrders: 11,
    source: "first_party",
    platformVerified: false,
  },
  {
    adId: "12021498380002",
    parentAdsetId: "12021490009382",
    parentCampaignId: "12021490000001",
    adLabel: "Founder Cut | Offer Stack",
    attributedOrders: 6.1,
    attributedRevenue: 448.1,
    newCustomerCredit: 3.2,
    newCustomerRevenue: 220.4,
    shareOfAdsetRevenue: 0.302,
    numberOfOrders: 8,
    source: "first_party",
    platformVerified: false,
  },
  {
    adId: "12021498387777",
    parentAdsetId: "12021490008821",
    parentCampaignId: "12021490000001",
    adLabel: "Ad 12021498…7777",
    attributedOrders: 4.2,
    attributedRevenue: 290.4,
    newCustomerCredit: 1.8,
    newCustomerRevenue: 140.1,
    shareOfAdsetRevenue: 0.263,
    numberOfOrders: 6,
    source: "first_party",
    platformVerified: false,
  },
];

function series(
  key: string,
  label: string,
  revenue: number[],
  orders: number[],
): ObservedEntityDailySeries {
  const points = META_STORY_DAYS.map((day, index) => ({
    day,
    revenue: revenue[index] ?? 0,
    attributedOrders: orders[index] ?? 0,
    uniqueOrders: Math.ceil(orders[index] ?? 0),
    newCustomerCredit: (orders[index] ?? 0) * 0.45,
    newCustomerRevenue: (revenue[index] ?? 0) * 0.52,
  }));
  return {
    key,
    label,
    revenue: points.reduce((sum, point) => sum + point.revenue, 0),
    attributedOrders: points.reduce((sum, point) => sum + point.attributedOrders, 0),
    uniqueOrders: points.reduce((sum, point) => sum + point.uniqueOrders, 0),
    newCustomerCredit: points.reduce((sum, point) => sum + point.newCustomerCredit, 0),
    newCustomerRevenue: points.reduce((sum, point) => sum + point.newCustomerRevenue, 0),
    points,
  };
}

export const META_STORY_CAMPAIGN_SERIES = [
  series(
    "69ce2b5e-0000-4000-8000-00000000c90a",
    "USA CBO | APRIL 17 | Batch 1-5",
    [410, 520, 480, 610, 540, 590, 651.74],
    [7.1, 8.4, 8.0, 10.2, 8.8, 9.4, 9.5],
  ),
  series(
    "7b11aa22-1111-4000-8000-00000000d81b",
    "WORLDWIDE CBO | AUGST 19",
    [160, 190, 210, 180, 230, 220, 232.5],
    [2.2, 2.6, 2.8, 2.4, 3.1, 2.8, 2.7],
  ),
];

export const META_STORY_ALL_CAMPAIGNS = series(
  "__all_campaigns__",
  "All campaigns",
  META_STORY_CAMPAIGN_SERIES[0].points.map(
    (point, index) => point.revenue + (META_STORY_CAMPAIGN_SERIES[1].points[index]?.revenue ?? 0),
  ),
  META_STORY_CAMPAIGN_SERIES[0].points.map(
    (point, index) =>
      point.attributedOrders + (META_STORY_CAMPAIGN_SERIES[1].points[index]?.attributedOrders ?? 0),
  ),
);

export const META_STORY_ADSET_SERIES = [
  series(
    "12021490009382",
    "Ad Set 12021490…9382",
    [180, 210, 190, 240, 220, 230, 212.22],
    [2.8, 3.2, 3.0, 3.6, 3.3, 3.4, 3.1],
  ),
  series(
    "12021490008821",
    "Ad Set 12021490…8821",
    [140, 150, 160, 170, 155, 165, 164.4],
    [2.4, 2.6, 2.5, 2.8, 2.6, 2.7, 2.6],
  ),
];

export const META_STORY_AD_SERIES = [
  series(
    "12021498389291",
    "UGC Hook 3 - Woman Wall",
    [70, 80, 90, 95, 88, 92, 97.2],
    [1.0, 1.2, 1.3, 1.4, 1.2, 1.1, 1.2],
  ),
  series(
    "12021498380002",
    "Founder Cut | Offer Stack",
    [50, 60, 55, 70, 68, 72, 73.1],
    [0.7, 0.8, 0.8, 1.0, 0.9, 0.9, 1.0],
  ),
];

export const META_STORY_PLATFORM_DAILY = {
  spend: [280, 310, 295, 340, 320, 330, 239.85],
  purchase_value: [0, 12, 0, 40, 18, 16, 0.4],
  purchases: [5, 7, 6, 9, 8, 7, 4],
  roas: [0, 0.04, 0, 0.12, 0.06, 0.05, 0],
  cpa: [56, 44, 49, 38, 40, 47, 60],
  cpm: [62, 60, 61, 59, 63, 61, 64],
  ctr: [0.041, 0.043, 0.04, 0.044, 0.042, 0.041, 0.039],
  cpc: [1.48, 1.42, 1.5, 1.39, 1.46, 1.44, 1.55],
  frequency: [1.24, 1.26, 1.27, 1.29, 1.25, 1.28, 1.3],
};

export const META_STORY_PLATFORM_BY_CAMPAIGN: Record<
  string,
  typeof META_STORY_PLATFORM_DAILY
> = {
  "69ce2b5e-0000-4000-8000-00000000c90a": {
    spend: [210, 230, 220, 250, 240, 245, 219.85],
    purchase_value: [0, 0, 0, 0, 0, 0, 0],
    purchases: [4, 6, 5, 7, 6, 6, 8],
    roas: [0, 0, 0, 0, 0, 0, 0],
    cpa: [52, 38, 44, 36, 40, 41, 27],
    cpm: [61, 60, 62, 59, 63, 61, 64],
    ctr: [0.042, 0.044, 0.041, 0.045, 0.043, 0.042, 0.04],
    cpc: [1.46, 1.4, 1.48, 1.38, 1.45, 1.43, 1.52],
    frequency: [1.26, 1.27, 1.28, 1.29, 1.25, 1.27, 1.3],
  },
};
