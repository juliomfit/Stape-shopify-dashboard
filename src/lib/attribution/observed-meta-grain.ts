/**
 * First-party observed Meta child-grain rollups.
 *
 * Does not recalculate attribution. Groups already-computed EnrichedCredit
 * by IDs captured on OUR canonical Meta touches. Empty Flyweel child fact
 * indexes do not hide these rows. Platform-verified mapping stays on
 * EnrichedCredit.adsetMapped / adMapped.
 */

import { pacificYmd } from "../period.ts";
import { canonicalCampaignName, displayCampaignName, shortenId } from "./campaign-map.ts";
import { META_CHANNEL, type EnrichedCredit } from "./meta-credit.ts";
import { sanitizeMetaId, META_HIERARCHY_CONFLICT, SESSION_ID_CONFLICT } from "./meta-ids.ts";

export const UNIDENTIFIED_ADSET_KEY = "__unidentified_adset__";
export const UNIDENTIFIED_AD_KEY = "__unidentified_ad__";
export const ID_CONFLICT_KEY = "__id_conflict__";
export const UNIDENTIFIED_ADSET_LABEL = "Unidentified ad set";
export const UNIDENTIFIED_AD_LABEL = "Unidentified ad";
export const ID_CONFLICT_LABEL = "Needs mapping / ID conflict";
export const FIRST_PARTY_SOURCE = "GoodsNova first-party attribution";
export const FLYWEEL_ADSET_SPEND_UNAVAILABLE = "Flyweel does not provide ad-set spend.";
export const FLYWEEL_AD_SPEND_UNAVAILABLE = "Flyweel does not provide ad-level spend.";
export const FLYWEEL_CHILD_SPEND_UNAVAILABLE =
  "Platform spend unavailable at this grain from Flyweel.";
export const ALL_CAMPAIGNS_KEY = "__all_campaigns__";

export type ObservedChildPresence = "observed" | "missing" | "conflict";

export type ObservedUnmappedBucket = {
  key: string;
  label: string;
  presence: Exclude<ObservedChildPresence, "observed">;
  attributedOrders: number;
  attributedRevenue: number;
  newCustomerCredit: number;
  newCustomerRevenue: number;
  numberOfOrders: number;
};

export type ObservedMetaAdsetRollup = {
  adsetId: string;
  parentCampaignId: string | null;
  campaignLabel: string;
  adsetLabel: string;
  attributedOrders: number;
  attributedRevenue: number;
  newCustomerCredit: number;
  newCustomerRevenue: number;
  shareOfParentRevenue: number;
  numberOfAds: number;
  numberOfOrders: number;
  source: "first_party";
  platformVerified: boolean;
};

export type ObservedMetaAdRollup = {
  adId: string;
  parentAdsetId: string | null;
  parentCampaignId: string | null;
  adLabel: string;
  attributedOrders: number;
  attributedRevenue: number;
  newCustomerCredit: number;
  newCustomerRevenue: number;
  shareOfAdsetRevenue: number;
  numberOfOrders: number;
  source: "first_party";
  platformVerified: boolean;
};

export type ObservedMetaCampaignRollup = {
  campaignKey: string;
  campaignLabel: string;
  platformCampaignId: string | null;
  observedCampaignId: string | null;
  attributedOrders: number;
  attributedRevenue: number;
  newCustomerCredit: number;
  newCustomerRevenue: number;
  numberOfAdsets: number;
  numberOfOrders: number;
  source: "first_party";
};

export type ObservedMetaChildHierarchy = {
  parentRevenue: number;
  parentOrders: number;
  parentAttributedOrders: number;
  campaigns: ObservedMetaCampaignRollup[];
  adsets: ObservedMetaAdsetRollup[];
  ads: ObservedMetaAdRollup[];
  unidentifiedAdset: ObservedUnmappedBucket;
  unidentifiedAd: ObservedUnmappedBucket;
  conflict: ObservedUnmappedBucket;
};

function stripInternal<T extends object, K extends keyof T>(row: T, keys: K[]): Omit<T, K> {
  const copy = { ...row };
  for (const key of keys) {
    delete copy[key];
  }
  return copy;
}

function emptyBucket(
  key: string,
  label: string,
  presence: Exclude<ObservedChildPresence, "observed">,
): ObservedUnmappedBucket {
  return {
    key,
    label,
    presence,
    attributedOrders: 0,
    attributedRevenue: 0,
    newCustomerCredit: 0,
    newCustomerRevenue: 0,
    numberOfOrders: 0,
  };
}

function addToBucket(bucket: ObservedUnmappedBucket, credit: EnrichedCredit, orders: Set<string>) {
  bucket.attributedOrders += credit.weight;
  bucket.attributedRevenue += credit.creditDollars;
  bucket.newCustomerCredit += credit.newCustomerCredit;
  bucket.newCustomerRevenue += credit.newCustomerRevenue;
  orders.add(credit.orderName);
  bucket.numberOfOrders = orders.size;
}

export function metaCreditsForCampaign(
  credits: EnrichedCredit[],
  args: { platformCampaignId?: string | null; campaignName?: string | null },
): EnrichedCredit[] {
  const platformId = String(args.platformCampaignId ?? "").trim();
  const nameKey = canonicalCampaignName(args.campaignName ?? "");
  return credits.filter((credit) => {
    if (credit.channel !== META_CHANNEL) return false;
    if (platformId && credit.metaCampaignId === platformId) return true;
    if (nameKey && canonicalCampaignName(credit.campaign) === nameKey) return true;
    return false;
  });
}

export function adsetLabel(adsetId: string): string {
  return `Ad Set ${shortenId(adsetId)}`;
}

export function adLabel(adId: string): string {
  return `Ad ${shortenId(adId)}`;
}

function campaignLabelFromCredit(credit: EnrichedCredit): string {
  const named = displayCampaignName(credit.campaign);
  if (named && named !== "(unmapped)") return named;
  if (credit.observedCampaignId) return shortenId(credit.observedCampaignId);
  if (credit.metaCampaignId) return shortenId(credit.metaCampaignId);
  return named || "Campaign";
}

export function rollupObservedMetaChildren(
  credits: EnrichedCredit[],
): ObservedMetaChildHierarchy {
  const meta = credits.filter((credit) => credit.channel === META_CHANNEL);
  const parentRevenue = meta.reduce((sum, credit) => sum + credit.creditDollars, 0);
  const parentAttributedOrders = meta.reduce((sum, credit) => sum + credit.weight, 0);
  const parentOrderIds = new Set(meta.map((credit) => credit.orderName));

  const campaignMap = new Map<
    string,
    ObservedMetaCampaignRollup & { orderIds: Set<string>; adsetIds: Set<string> }
  >();
  const adsetMap = new Map<
    string,
    ObservedMetaAdsetRollup & { orderIds: Set<string>; adIds: Set<string> }
  >();
  const adMap = new Map<string, ObservedMetaAdRollup & { orderIds: Set<string> }>();
  const unidentifiedAdset = emptyBucket(UNIDENTIFIED_ADSET_KEY, UNIDENTIFIED_ADSET_LABEL, "missing");
  const unidentifiedAd = emptyBucket(UNIDENTIFIED_AD_KEY, UNIDENTIFIED_AD_LABEL, "missing");
  const conflict = emptyBucket(ID_CONFLICT_KEY, ID_CONFLICT_LABEL, "conflict");
  const unidentifiedAdsetOrders = new Set<string>();
  const unidentifiedAdOrders = new Set<string>();
  const conflictOrders = new Set<string>();

  for (const credit of meta) {
    const campaignKey =
      credit.metaCampaignId ||
      credit.observedCampaignId ||
      canonicalCampaignName(credit.campaign) ||
      "(unmapped)";
    let campaign = campaignMap.get(campaignKey);
    if (!campaign) {
      campaign = {
        campaignKey,
        campaignLabel: campaignLabelFromCredit(credit),
        platformCampaignId: credit.metaCampaignId,
        observedCampaignId: credit.observedCampaignId,
        attributedOrders: 0,
        attributedRevenue: 0,
        newCustomerCredit: 0,
        newCustomerRevenue: 0,
        numberOfAdsets: 0,
        numberOfOrders: 0,
        source: "first_party",
        orderIds: new Set(),
        adsetIds: new Set(),
      };
      campaignMap.set(campaignKey, campaign);
    }
    campaign.attributedOrders += credit.weight;
    campaign.attributedRevenue += credit.creditDollars;
    campaign.newCustomerCredit += credit.newCustomerCredit;
    campaign.newCustomerRevenue += credit.newCustomerRevenue;
    campaign.orderIds.add(credit.orderName);
    campaign.numberOfOrders = campaign.orderIds.size;
    if (credit.observedCampaignId && !campaign.observedCampaignId) {
      campaign.observedCampaignId = credit.observedCampaignId;
    }
    if (credit.metaCampaignId && !campaign.platformCampaignId) {
      campaign.platformCampaignId = credit.metaCampaignId;
    }

    const blocked = credit.sessionIdConflict || credit.hierarchyConflict;
    if (blocked) {
      addToBucket(conflict, credit, conflictOrders);
      continue;
    }

    if (credit.observedAdsetId) {
      campaign.adsetIds.add(credit.observedAdsetId);
      campaign.numberOfAdsets = campaign.adsetIds.size;
      let adset = adsetMap.get(credit.observedAdsetId);
      if (!adset) {
        adset = {
          adsetId: credit.observedAdsetId,
          parentCampaignId: credit.observedCampaignId || credit.metaCampaignId,
          campaignLabel: campaign.campaignLabel,
          adsetLabel: adsetLabel(credit.observedAdsetId),
          attributedOrders: 0,
          attributedRevenue: 0,
          newCustomerCredit: 0,
          newCustomerRevenue: 0,
          shareOfParentRevenue: 0,
          numberOfAds: 0,
          numberOfOrders: 0,
          source: "first_party",
          platformVerified: false,
          orderIds: new Set(),
          adIds: new Set(),
        };
        adsetMap.set(credit.observedAdsetId, adset);
      }
      adset.attributedOrders += credit.weight;
      adset.attributedRevenue += credit.creditDollars;
      adset.newCustomerCredit += credit.newCustomerCredit;
      adset.newCustomerRevenue += credit.newCustomerRevenue;
      adset.orderIds.add(credit.orderName);
      adset.numberOfOrders = adset.orderIds.size;
      adset.platformVerified = adset.platformVerified || credit.platformVerifiedAdset;
      if (credit.observedAdId) adset.adIds.add(credit.observedAdId);
      adset.numberOfAds = adset.adIds.size;
    } else {
      addToBucket(unidentifiedAdset, credit, unidentifiedAdsetOrders);
    }

    if (credit.observedAdId) {
      let ad = adMap.get(credit.observedAdId);
      if (!ad) {
        ad = {
          adId: credit.observedAdId,
          parentAdsetId: credit.observedAdsetId,
          parentCampaignId: credit.observedCampaignId || credit.metaCampaignId,
          adLabel: adLabel(credit.observedAdId),
          attributedOrders: 0,
          attributedRevenue: 0,
          newCustomerCredit: 0,
          newCustomerRevenue: 0,
          shareOfAdsetRevenue: 0,
          numberOfOrders: 0,
          source: "first_party",
          platformVerified: false,
          orderIds: new Set(),
        };
        adMap.set(credit.observedAdId, ad);
      }
      ad.attributedOrders += credit.weight;
      ad.attributedRevenue += credit.creditDollars;
      ad.newCustomerCredit += credit.newCustomerCredit;
      ad.newCustomerRevenue += credit.newCustomerRevenue;
      ad.orderIds.add(credit.orderName);
      ad.numberOfOrders = ad.orderIds.size;
      ad.platformVerified = ad.platformVerified || credit.platformVerifiedAd;
    } else if (!blocked) {
      addToBucket(unidentifiedAd, credit, unidentifiedAdOrders);
    }
  }

  const adsets = [...adsetMap.values()]
    .map((row) => {
      const rest = stripInternal(row, ["orderIds", "adIds"]);
      return {
        ...rest,
        shareOfParentRevenue: parentRevenue > 0 ? rest.attributedRevenue / parentRevenue : 0,
      };
    })
    .sort((a, b) => b.attributedRevenue - a.attributedRevenue);

  const ads = [...adMap.values()]
    .map((row) => {
      const parentAdset = row.parentAdsetId ? adsetMap.get(row.parentAdsetId) : undefined;
      const parentRevenueForAd = parentAdset?.attributedRevenue ?? parentRevenue;
      const rest = stripInternal(row, ["orderIds"]);
      return {
        ...rest,
        shareOfAdsetRevenue:
          parentRevenueForAd > 0 ? rest.attributedRevenue / parentRevenueForAd : 0,
      };
    })
    .sort((a, b) => b.attributedRevenue - a.attributedRevenue);

  const campaigns = [...campaignMap.values()]
    .map((row) => stripInternal(row, ["orderIds", "adsetIds"]))
    .sort((a, b) => b.attributedRevenue - a.attributedRevenue);

  return {
    parentRevenue,
    parentOrders: parentOrderIds.size,
    parentAttributedOrders,
    campaigns,
    adsets,
    ads,
    unidentifiedAdset,
    unidentifiedAd,
    conflict,
  };
}

export function observedHierarchyHolds(
  hierarchy: ObservedMetaChildHierarchy,
  epsilon = 1e-6,
): boolean {
  const observedAdset = hierarchy.adsets.reduce((sum, row) => sum + row.attributedRevenue, 0);
  const adsetTotal =
    observedAdset + hierarchy.unidentifiedAdset.attributedRevenue + hierarchy.conflict.attributedRevenue;
  if (Math.abs(adsetTotal - hierarchy.parentRevenue) > epsilon) return false;

  const observedAd = hierarchy.ads.reduce((sum, row) => sum + row.attributedRevenue, 0);
  const adTotal =
    observedAd + hierarchy.unidentifiedAd.attributedRevenue + hierarchy.conflict.attributedRevenue;
  if (Math.abs(adTotal - hierarchy.parentRevenue) > epsilon) return false;

  for (const adset of hierarchy.adsets) {
    const childAds = hierarchy.ads.filter((ad) => ad.parentAdsetId === adset.adsetId);
    const childSum = childAds.reduce((sum, ad) => sum + ad.attributedRevenue, 0);
    if (childSum > adset.attributedRevenue + epsilon) return false;
  }
  return observedAdset <= hierarchy.parentRevenue + epsilon;
}

export type ObservedDailyPoint = {
  day: string;
  revenue: number;
  attributedOrders: number;
  uniqueOrders: number;
};

export type ObservedDailyGrain = "campaign" | "adset" | "ad";

export type ObservedEntityDailySeries = {
  key: string;
  label: string;
  revenue: number;
  attributedOrders: number;
  uniqueOrders: number;
  points: ObservedDailyPoint[];
};

function campaignKey(credit: EnrichedCredit): string {
  return (
    credit.metaCampaignId ||
    credit.observedCampaignId ||
    canonicalCampaignName(credit.campaign) ||
    "(unmapped)"
  );
}

function matchesDailyEntity(
  credit: EnrichedCredit,
  grain: ObservedDailyGrain,
  entityId?: string | null,
): boolean {
  if (!entityId || entityId === ALL_CAMPAIGNS_KEY) return true;
  if (grain === "adset") return credit.observedAdsetId === entityId;
  if (grain === "ad") return credit.observedAdId === entityId;
  return (
    credit.metaCampaignId === entityId ||
    credit.observedCampaignId === entityId ||
    canonicalCampaignName(credit.campaign) === canonicalCampaignName(entityId) ||
    campaignKey(credit) === entityId
  );
}

export function dailyObservedMetaRevenue(
  credits: EnrichedCredit[],
  days: string[],
  grain: ObservedDailyGrain,
  entityId?: string | null,
): ObservedDailyPoint[] {
  const byDay = new Map<string, ObservedDailyPoint & { orderIds: Set<string> }>();
  for (const day of days) {
    byDay.set(day, {
      day,
      revenue: 0,
      attributedOrders: 0,
      uniqueOrders: 0,
      orderIds: new Set(),
    });
  }
  for (const credit of credits) {
    if (credit.channel !== META_CHANNEL) continue;
    if (!matchesDailyEntity(credit, grain, entityId)) continue;
    const day = pacificYmd(credit.purchaseTs);
    const point = byDay.get(day);
    if (!point) continue;
    point.revenue += credit.creditDollars;
    point.attributedOrders += credit.weight;
    point.orderIds.add(credit.orderName);
    point.uniqueOrders = point.orderIds.size;
  }
  return days.map((day) => {
    const point = byDay.get(day)!;
    return {
      day: point.day,
      revenue: point.revenue,
      attributedOrders: point.attributedOrders,
      uniqueOrders: point.uniqueOrders,
    };
  });
}

function summarizePoints(points: ObservedDailyPoint[]) {
  return {
    revenue: points.reduce((sum, point) => sum + point.revenue, 0),
    attributedOrders: points.reduce((sum, point) => sum + point.attributedOrders, 0),
    uniqueOrders: points.reduce((sum, point) => sum + point.uniqueOrders, 0),
  };
}

export function dailyObservedByEntity(
  credits: EnrichedCredit[],
  days: string[],
  grain: ObservedDailyGrain,
): ObservedEntityDailySeries[] {
  const keys = new Set<string>();
  const labelByKey = new Map<string, string>();
  for (const credit of credits) {
    if (credit.channel !== META_CHANNEL) continue;
    if (grain === "adset") {
      if (!credit.observedAdsetId) continue;
      keys.add(credit.observedAdsetId);
      labelByKey.set(credit.observedAdsetId, adsetLabel(credit.observedAdsetId));
    } else if (grain === "ad") {
      if (!credit.observedAdId) continue;
      keys.add(credit.observedAdId);
      labelByKey.set(credit.observedAdId, adLabel(credit.observedAdId));
    } else {
      const key = campaignKey(credit);
      keys.add(key);
      if (!labelByKey.has(key)) {
        const named = displayCampaignName(credit.campaign);
        labelByKey.set(
          key,
          named && named !== "(unmapped)" ? named : displayCampaignName(key) || key,
        );
      }
    }
  }
  return [...keys]
    .map((key) => {
      const points = dailyObservedMetaRevenue(credits, days, grain, key);
      return {
        key,
        label: labelByKey.get(key) || key,
        ...summarizePoints(points),
        points,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export type MetaFirstPartyIdCoverage = {
  denominator: "meta_paid_canonical_touches";
  metaPaidTouches: number;
  withCampaignId: number;
  withAdsetId: number;
  withAdId: number;
  campaignIdRate: number | null;
  adsetIdRate: number | null;
  adIdRate: number | null;
  metaAttributedOrders: number;
  ordersWithCampaignId: number;
  ordersWithAdsetId: number;
  ordersWithAdId: number;
  metaAttributedRevenue: number;
  revenueWithCampaignId: number;
  revenueWithAdsetId: number;
  revenueWithAdId: number;
};

function rate(numerator: number, denominator: number): number | null {
  if (!(denominator > 0)) return null;
  return numerator / denominator;
}

export function measureMetaIdCoverage(args: {
  touches: Array<{
    channel: string;
    isPaid?: boolean;
    campaignId?: string | null;
    adsetId?: string | null;
    adId?: string | null;
  }>;
  credits: EnrichedCredit[];
}): MetaFirstPartyIdCoverage {
  const metaPaid = args.touches.filter(
    (touch) => touch.channel === META_CHANNEL && touch.isPaid !== false,
  );
  const withCampaignId = metaPaid.filter((touch) => Boolean(sanitizeMetaId(touch.campaignId))).length;
  const withAdsetId = metaPaid.filter((touch) => Boolean(sanitizeMetaId(touch.adsetId))).length;
  const withAdId = metaPaid.filter((touch) => Boolean(sanitizeMetaId(touch.adId))).length;
  const meta = args.credits.filter((credit) => credit.channel === META_CHANNEL);
  const orders = new Set(meta.map((credit) => credit.orderName));
  const ordersCampaign = new Set(
    meta.filter((credit) => credit.observedCampaignId || sanitizeMetaId(credit.metaCampaignId)).map((c) => c.orderName),
  );
  const ordersAdset = new Set(
    meta.filter((credit) => Boolean(sanitizeMetaId(credit.metaAdsetId))).map((c) => c.orderName),
  );
  const ordersAd = new Set(
    meta.filter((credit) => Boolean(sanitizeMetaId(credit.metaAdId))).map((c) => c.orderName),
  );
  const metaAttributedRevenue = meta.reduce((sum, credit) => sum + credit.creditDollars, 0);
  const revenueWithCampaignId = meta
    .filter((credit) => credit.observedCampaignId || sanitizeMetaId(credit.metaCampaignId))
    .reduce((sum, credit) => sum + credit.creditDollars, 0);
  const revenueWithAdsetId = meta
    .filter((credit) => Boolean(sanitizeMetaId(credit.metaAdsetId)))
    .reduce((sum, credit) => sum + credit.creditDollars, 0);
  const revenueWithAdId = meta
    .filter((credit) => Boolean(sanitizeMetaId(credit.metaAdId)))
    .reduce((sum, credit) => sum + credit.creditDollars, 0);

  return {
    denominator: "meta_paid_canonical_touches",
    metaPaidTouches: metaPaid.length,
    withCampaignId,
    withAdsetId,
    withAdId,
    campaignIdRate: rate(withCampaignId, metaPaid.length),
    adsetIdRate: rate(withAdsetId, metaPaid.length),
    adIdRate: rate(withAdId, metaPaid.length),
    metaAttributedOrders: orders.size,
    ordersWithCampaignId: ordersCampaign.size,
    ordersWithAdsetId: ordersAdset.size,
    ordersWithAdId: ordersAd.size,
    metaAttributedRevenue,
    revenueWithCampaignId,
    revenueWithAdsetId,
    revenueWithAdId,
  };
}

export { SESSION_ID_CONFLICT, META_HIERARCHY_CONFLICT };
