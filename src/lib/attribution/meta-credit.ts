/**
 * Meta campaign / ad-set / ad credit enrichment.
 *
 * DOES NOT recalculate attribution. Takes existing `attribute()` weights and
 * attaches deterministic Meta IDs. Unmapped Meta credit stays visible in the
 * Unmapped Meta bucket. Child mapped credit never exceeds parent credit.
 */

import { attribute, type AttributionModel, type Touchpoint } from "./engine.ts";
import { sanitizeMetaId, SESSION_ID_CONFLICT, META_HIERARCHY_CONFLICT } from "./meta-ids.ts";
import {
  campaignIdExactMatchAllowed,
  isFlyweelInternalUuid,
  isNativeMetaNumericId,
} from "./meta-id-namespace.ts";
import { ratio } from "../metrics/formulas.ts";
import type {
  CampaignMappingConfidence,
  CampaignMappingMethod,
} from "./campaign-map.ts";
import { canonicalCampaignName, displayAdName } from "./campaign-map.ts";

export const META_CHANNEL = "Facebook / Meta Ads";
export const UNMAPPED_META_LABEL = "Unmapped Meta";

export type MetaAdsetMappingMethod = "adset_id_exact" | "unmapped";
export type MetaAdMappingMethod = "ad_id_exact" | "unmapped";

export type MetaUnmappedReason =
  | typeof SESSION_ID_CONFLICT
  | typeof META_HIERARCHY_CONFLICT
  | null;

export type MetaCreditTouch = {
  touchpointId: string;
  ts: number;
  channel: string;
  campaign?: string | null;
  content?: string | null;
  campaignId?: string | null;
  adsetId?: string | null;
  adId?: string | null;
  campaignIdConflict?: boolean;
  adsetIdConflict?: boolean;
  adIdConflict?: boolean;
  isPaid: boolean;
  isDirect: boolean;
};

export type MetaCreditOrder = {
  transactionId: string;
  purchaseTs: number;
  revenue: number;
  isNewCustomer: boolean | null;
  touches: MetaCreditTouch[];
};

export type EnrichedCredit = {
  orderName: string;
  model: AttributionModel;
  windowDays: number;
  channel: string;
  campaign: string;
  weight: number;
  creditDollars: number;
  isNewCustomer: boolean;
  newCustomerCredit: number;
  newCustomerRevenue: number;
  metaCampaignId: string | null;
  metaAdsetId: string | null;
  metaAdId: string | null;
  metaCreativeId: string | null;
  campaignMappingMethod: CampaignMappingMethod;
  campaignMappingConfidence: CampaignMappingConfidence;
  adsetMappingMethod: MetaAdsetMappingMethod;
  adMapped: boolean;
  adsetMapped: boolean;
  adMappingMethod: MetaAdMappingMethod;
  observedCampaignId: string | null;
  observedAdsetId: string | null;
  observedAdId: string | null;
  observedAdName: string | null;
  platformVerifiedAdset: boolean;
  platformVerifiedAd: boolean;
  purchaseTs: number;
  hierarchyConflict: boolean;
  sessionIdConflict: boolean;
  unmappedReason: MetaUnmappedReason;
  journey: string;
};

export type GrainRollup = {
  key: string;
  label: string;
  attributedOrders: number;
  attributedRevenue: number;
  newCustomerCredit: number;
  newCustomerRevenue: number;
  mappingConfidence: CampaignMappingConfidence | "MIXED";
  mapped: boolean;
};

export type MetaCreditRollup = {
  channelCredit: number;
  channelNewCustomerCredit: number;
  campaignMappedCredit: number;
  campaignUnmappedCredit: number;
  adsetMappedCredit: number;
  adsetUnmappedCredit: number;
  adMappedCredit: number;
  adUnmappedCredit: number;
  byCampaign: GrainRollup[];
  byAdset: GrainRollup[];
  byAd: GrainRollup[];
  credits: EnrichedCredit[];
};

export type MetaFactIndexes = {
  campaignById: Map<string, { campaignId: string; campaignName: string }>;
  campaignByUniqueName: Map<string, { campaignId: string; campaignName: string }>;
  ambiguousNames: Set<string>;
  adsetIds: Set<string>;
  adIds: Set<string>;
  creativeByAdId: Map<string, string>;
  adsetParentCampaign: Map<string, string>;
  adParentAdset: Map<string, string>;
  adParentCampaign: Map<string, string>;
};

function grainKey(name: string | null | undefined): string {
  return canonicalCampaignName(name);
}

function toEngineTouch(touch: MetaCreditTouch): Touchpoint {
  return {
    id: touch.touchpointId,
    timestamp: touch.ts,
    channel: touch.channel,
    campaign: touch.campaign ?? undefined,
    isPaid: touch.isPaid,
    isDirect: touch.isDirect,
  };
}

function setUniqueParent(
  map: Map<string, string>,
  child: string,
  parent: string,
  ambiguous: Set<string>,
) {
  if (!child || !parent) return;
  if (ambiguous.has(child)) return;
  const existing = map.get(child);
  if (existing && existing !== parent) {
    map.delete(child);
    ambiguous.add(child);
    return;
  }
  map.set(child, parent);
}

export function buildMetaFactIndexes(args: {
  campaigns: Array<{ campaign_id: string; campaign_name: string }>;
  adsetIds?: Iterable<string>;
  adIds?: Iterable<string>;
  creativeByAdId?: Map<string, string>;
  adsets?: Array<{ adset_id: string; campaign_id: string }>;
  ads?: Array<{
    ad_id: string;
    adset_id: string;
    campaign_id: string;
    creative_id?: string | null;
  }>;
}): MetaFactIndexes {
  const campaignById = new Map<string, { campaignId: string; campaignName: string }>();
  const idsByName = new Map<string, Set<string>>();
  for (const fact of args.campaigns) {
    const id = fact.campaign_id?.trim();
    const name = fact.campaign_name?.trim() || id;
    if (id) {
      campaignById.set(id, { campaignId: id, campaignName: name || id });
    }
    if (name) {
      const set = idsByName.get(grainKey(name)) ?? new Set<string>();
      if (id) set.add(id);
      idsByName.set(grainKey(name), set);
    }
  }
  const campaignByUniqueName = new Map<
    string,
    { campaignId: string; campaignName: string }
  >();
  const ambiguousNames = new Set<string>();
  for (const [name, ids] of idsByName) {
    if (ids.size > 1) {
      ambiguousNames.add(name);
      continue;
    }
    const only = [...ids][0];
    const hit = only ? campaignById.get(only) : undefined;
    if (hit) campaignByUniqueName.set(name, hit);
  }

  const adsetIds = new Set(
    [...(args.adsetIds ?? [])].map((id) => id.trim()).filter(Boolean),
  );
  const adIds = new Set([... (args.adIds ?? [])].map((id) => id.trim()).filter(Boolean));
  const creativeByAdId = new Map(args.creativeByAdId ?? []);
  const adsetParentCampaign = new Map<string, string>();
  const adParentAdset = new Map<string, string>();
  const adParentCampaign = new Map<string, string>();
  const ambiguousAdsetParents = new Set<string>();
  const ambiguousAdParents = new Set<string>();

  for (const row of args.adsets ?? []) {
    const adsetId = row.adset_id?.trim();
    const campaignId = row.campaign_id?.trim();
    if (adsetId) adsetIds.add(adsetId);
    if (adsetId && campaignId) {
      setUniqueParent(adsetParentCampaign, adsetId, campaignId, ambiguousAdsetParents);
    }
  }
  for (const row of args.ads ?? []) {
    const adId = row.ad_id?.trim();
    const adsetId = row.adset_id?.trim();
    const campaignId = row.campaign_id?.trim();
    const creativeId = row.creative_id?.trim();
    if (adId) adIds.add(adId);
    if (adId && adsetId) {
      setUniqueParent(adParentAdset, adId, adsetId, ambiguousAdParents);
    }
    if (adId && campaignId) {
      setUniqueParent(adParentCampaign, adId, campaignId, ambiguousAdParents);
    }
    if (adId && creativeId && !creativeByAdId.has(adId)) {
      creativeByAdId.set(adId, creativeId);
    }
  }

  return {
    campaignById,
    campaignByUniqueName,
    ambiguousNames,
    adsetIds,
    adIds,
    creativeByAdId,
    adsetParentCampaign,
    adParentAdset,
    adParentCampaign,
  };
}

export function evaluateMetaHierarchy(
  ids: { campaignId?: string | null; adsetId?: string | null; adId?: string | null },
  indexes: MetaFactIndexes,
): { conflict: boolean; reasons: string[] } {
  const campaignId = sanitizeMetaId(ids.campaignId);
  const adsetId = sanitizeMetaId(ids.adsetId);
  const adId = sanitizeMetaId(ids.adId);
  const reasons: string[] = [];

  if (campaignId && adsetId) {
    const parent = indexes.adsetParentCampaign.get(adsetId);
    if (parent && parent !== campaignId) {
      reasons.push(`adset ${adsetId} parent campaign ${parent} != ${campaignId}`);
    }
  }
  if (adsetId && adId) {
    const parentAdset = indexes.adParentAdset.get(adId);
    if (parentAdset && parentAdset !== adsetId) {
      reasons.push(`ad ${adId} parent adset ${parentAdset} != ${adsetId}`);
    }
  }
  if (campaignId && adId) {
    const parentCampaign = indexes.adParentCampaign.get(adId);
    if (parentCampaign && parentCampaign !== campaignId) {
      reasons.push(`ad ${adId} parent campaign ${parentCampaign} != ${campaignId}`);
    }
  }

  return { conflict: reasons.length > 0, reasons };
}

export function mapCampaignIdentity(
  touch: Pick<MetaCreditTouch, "campaignId" | "campaign">,
  indexes: MetaFactIndexes,
): {
  campaignId: string | null;
  method: CampaignMappingMethod;
  confidence: CampaignMappingConfidence;
} {
  const campaignId = sanitizeMetaId(touch.campaignId);
  if (campaignId) {
    const fact = indexes.campaignById.get(campaignId);
    if (fact && campaignIdExactMatchAllowed(campaignId, fact.campaignId)) {
      return { campaignId, method: "campaign_id_exact", confidence: "HIGH" };
    }
    const factIds = [...indexes.campaignById.keys()];
    const factsAreFlyweelUuid = factIds.some((id) => isFlyweelInternalUuid(id));
    const factsAreNativeMeta = factIds.some((id) => isNativeMetaNumericId(id));
    if (!factsAreFlyweelUuid || factsAreNativeMeta) {
      return { campaignId, method: "unmapped", confidence: "NONE" };
    }
  }
  const nameKey = grainKey(touch.campaign);
  if (!nameKey || nameKey === "(unmapped)") {
    return { campaignId: null, method: "unmapped", confidence: "NONE" };
  }
  if (indexes.ambiguousNames.has(nameKey)) {
    return { campaignId: null, method: "ambiguous_name", confidence: "NONE" };
  }
  const unique = indexes.campaignByUniqueName.get(nameKey);
  if (unique) {
    return {
      campaignId: unique.campaignId,
      method: "campaign_name_exact_unique",
      confidence: "PARTIAL",
    };
  }
  return { campaignId: null, method: "unmapped", confidence: "NONE" };
}

export function attachMetaIdsToCredits(args: {
  order: MetaCreditOrder;
  model: AttributionModel;
  windowDays: number;
  indexes: MetaFactIndexes;
}): EnrichedCredit[] {
  const { order, model, windowDays, indexes } = args;
  const result = attribute(order.touches.map(toEngineTouch), {
    model,
    purchaseTs: order.purchaseTs,
    windowDays,
  });
  const revenue = order.revenue;
  const isNew = order.isNewCustomer === true;
  const journey =
    order.touches.length === 0
      ? "Unknown"
      : order.touches.map((touch) => touch.channel).join(" → ");
  return result.map((credit) => {
    const touch =
      order.touches.find((item) => item.touchpointId === credit.touchpointId) ??
      null;
    const campaign = touch?.campaign?.trim() || "(unmapped)";
    const sessionIdConflict = Boolean(
      touch?.campaignIdConflict || touch?.adsetIdConflict || touch?.adIdConflict,
    );
    const hierarchy = touch
      ? evaluateMetaHierarchy(touch, indexes)
      : { conflict: false, reasons: [] };
    const childBlocked = sessionIdConflict || hierarchy.conflict;
    const unmappedReason: MetaUnmappedReason = sessionIdConflict
      ? SESSION_ID_CONFLICT
      : hierarchy.conflict
        ? META_HIERARCHY_CONFLICT
        : null;
    const mapped =
      credit.channel === META_CHANNEL && touch && !childBlocked
        ? mapCampaignIdentity(touch, indexes)
        : {
            campaignId: sanitizeMetaId(touch?.campaignId),
            method: "unmapped" as CampaignMappingMethod,
            confidence: "NONE" as CampaignMappingConfidence,
          };
    const adsetId = sanitizeMetaId(touch?.adsetId);
    const adId = sanitizeMetaId(touch?.adId);
    const isMeta = credit.channel === META_CHANNEL;
    const adsetMapped =
      isMeta && !childBlocked && !!adsetId && indexes.adsetIds.has(adsetId);
    const adMapped = isMeta && !childBlocked && !!adId && indexes.adIds.has(adId);
    const observedCampaignId =
      isMeta && !childBlocked ? sanitizeMetaId(touch?.campaignId) : null;
    const observedAdsetId = isMeta && !childBlocked && adsetId ? adsetId : null;
    const observedAdId = isMeta && !childBlocked && adId ? adId : null;
    return {
      orderName: order.transactionId,
      model,
      windowDays,
      channel: credit.channel,
      campaign,
      weight: credit.weight,
      creditDollars: revenue * credit.weight,
      isNewCustomer: isNew,
      newCustomerCredit: isNew ? credit.weight : 0,
      newCustomerRevenue: isNew ? revenue * credit.weight : 0,
      metaCampaignId: mapped.campaignId,
      metaAdsetId: adsetId,
      metaAdId: adId,
      metaCreativeId: adId ? indexes.creativeByAdId.get(adId) ?? null : null,
      campaignMappingMethod: mapped.method,
      campaignMappingConfidence: mapped.confidence,
      adsetMappingMethod: adsetMapped ? "adset_id_exact" : "unmapped",
      adsetMapped,
      adMapped,
      adMappingMethod: adMapped ? "ad_id_exact" : "unmapped",
      observedCampaignId,
      observedAdsetId,
      observedAdId,
      observedAdName:
        isMeta && !childBlocked ? displayAdName(touch?.content) || null : null,
      platformVerifiedAdset: adsetMapped,
      platformVerifiedAd: adMapped,
      purchaseTs: order.purchaseTs,
      hierarchyConflict: hierarchy.conflict,
      sessionIdConflict,
      unmappedReason,
      journey,
    };
  });
}

export function rollupMetaCredit(credits: EnrichedCredit[]): MetaCreditRollup {
  const meta = credits.filter((credit) => credit.channel === META_CHANNEL);
  const channelCredit = meta.reduce((sum, credit) => sum + credit.creditDollars, 0);
  const channelNewCustomerCredit = meta.reduce(
    (sum, credit) => sum + credit.newCustomerCredit,
    0,
  );

  const campaignMapped = meta.filter(
    (credit) =>
      credit.campaignMappingMethod === "campaign_id_exact" ||
      credit.campaignMappingMethod === "campaign_name_exact_unique",
  );
  const campaignMappedCredit = campaignMapped.reduce(
    (sum, credit) => sum + credit.creditDollars,
    0,
  );
  const adsetMapped = meta.filter((credit) => credit.adsetMapped);
  const adsetMappedCredit = adsetMapped.reduce(
    (sum, credit) => sum + credit.creditDollars,
    0,
  );
  const adMapped = meta.filter((credit) => credit.adMapped);
  const adMappedCredit = adMapped.reduce((sum, credit) => sum + credit.creditDollars, 0);

  return {
    channelCredit,
    channelNewCustomerCredit,
    campaignMappedCredit,
    campaignUnmappedCredit: channelCredit - campaignMappedCredit,
    adsetMappedCredit,
    adsetUnmappedCredit: channelCredit - adsetMappedCredit,
    adMappedCredit,
    adUnmappedCredit: channelCredit - adMappedCredit,
    byCampaign: grain(campaignMapped, (credit) => credit.metaCampaignId ?? UNMAPPED_META_LABEL, (credit) =>
      credit.campaignMappingConfidence === "HIGH" ? "HIGH" : "PARTIAL",
    ),
    byAdset: grain(adsetMapped, (credit) => credit.metaAdsetId ?? UNMAPPED_META_LABEL, () => "HIGH"),
    byAd: grain(adMapped, (credit) => credit.metaAdId ?? UNMAPPED_META_LABEL, () => "HIGH"),
    credits: meta,
  };
}

function grain(
  rows: EnrichedCredit[],
  keyFn: (credit: EnrichedCredit) => string,
  confFn: (credit: EnrichedCredit) => CampaignMappingConfidence,
): GrainRollup[] {
  const map = new Map<string, GrainRollup>();
  for (const credit of rows) {
    const key = keyFn(credit);
    const existing = map.get(key);
    const conf = confFn(credit);
    if (!existing) {
      map.set(key, {
        key,
        label: key,
        attributedOrders: 0,
        attributedRevenue: 0,
        newCustomerCredit: 0,
        newCustomerRevenue: 0,
        mappingConfidence: conf,
        mapped: key !== UNMAPPED_META_LABEL,
      });
    }
    const group = map.get(key)!;
    group.attributedOrders += credit.weight;
    group.attributedRevenue += credit.creditDollars;
    group.newCustomerCredit += credit.newCustomerCredit;
    group.newCustomerRevenue += credit.newCustomerRevenue;
    if (group.mappingConfidence !== conf) group.mappingConfidence = "MIXED";
  }
  return [...map.values()].sort((a, b) => b.attributedRevenue - a.attributedRevenue);
}

export function grainAttributedNcac(spend: number, newCustomerCredit: number): number | null {
  if (!(spend > 0) || !(newCustomerCredit > 0)) return null;
  return spend / newCustomerCredit;
}

export function grainOurRoas(revenue: number, spend: number): number | null {
  return ratio(revenue, spend);
}

export function creativeIdFromAd(
  adId: string | null | undefined,
  creativeByAdId: Map<string, string>,
): string | null {
  if (!adId) return null;
  return creativeByAdId.get(adId) ?? null;
}

export function exactIdMatch(
  observedId: string | null | undefined,
  knownIds: Set<string>,
): boolean {
  const id = sanitizeMetaId(observedId);
  if (!id) return false;
  return knownIds.has(id);
}

export function metaCreditForOrders(args: {
  orders: MetaCreditOrder[];
  model: AttributionModel;
  windowDays: number;
  indexes: MetaFactIndexes;
}): MetaCreditRollup {
  const credits: EnrichedCredit[] = [];
  for (const order of args.orders) {
    credits.push(
      ...attachMetaIdsToCredits({
        order,
        model: args.model,
        windowDays: args.windowDays,
        indexes: args.indexes,
      }),
    );
  }
  return rollupMetaCredit(credits);
}

export function metaCreditHierarchyHolds(rollup: MetaCreditRollup, epsilon = 1e-6): boolean {
  return (
    rollup.campaignMappedCredit <= rollup.channelCredit + epsilon &&
    rollup.adsetMappedCredit <= rollup.channelCredit + epsilon &&
    rollup.adMappedCredit <= rollup.channelCredit + epsilon &&
    rollup.campaignMappedCredit + rollup.campaignUnmappedCredit <=
      rollup.channelCredit + epsilon &&
    Math.abs(
      rollup.campaignMappedCredit + rollup.campaignUnmappedCredit - rollup.channelCredit,
    ) <= epsilon &&
    Math.abs(rollup.adsetMappedCredit + rollup.adsetUnmappedCredit - rollup.channelCredit) <=
      epsilon &&
    Math.abs(rollup.adMappedCredit + rollup.adUnmappedCredit - rollup.channelCredit) <= epsilon
  );
}

export type MetaMappingCoverage = {
  metaTouches: number;
  highIdCampaign: number;
  legacyName: number;
  ambiguous: number;
  unmappedCampaign: number;
  adsetMapped: number;
  adMapped: number;
  fbclidWithoutIds: number;
  conflictingIds: number;
  hierarchyConflicts: number;
  sessionIdConflicts: number;
};

export function summarizeMetaMapping(
  credits: EnrichedCredit[],
  touches: Array<{
    channel: string;
    fbclid?: boolean;
    campaignId?: string | null;
    adsetId?: string | null;
    adId?: string | null;
    campaignIdConflict?: boolean;
    adsetIdConflict?: boolean;
    adIdConflict?: boolean;
  }>,
): MetaMappingCoverage {
  const metaCredits = credits.filter((credit) => credit.channel === META_CHANNEL);
  const metaTouches = touches.filter((touch) => touch.channel === META_CHANNEL);
  return {
    metaTouches: metaTouches.length,
    highIdCampaign: metaCredits.filter((c) => c.campaignMappingMethod === "campaign_id_exact")
      .length,
    legacyName: metaCredits.filter(
      (c) => c.campaignMappingMethod === "campaign_name_exact_unique",
    ).length,
    ambiguous: metaCredits.filter((c) => c.campaignMappingMethod === "ambiguous_name").length,
    unmappedCampaign: metaCredits.filter((c) => c.campaignMappingMethod === "unmapped").length,
    adsetMapped: metaCredits.filter((c) => c.adsetMapped).length,
    adMapped: metaCredits.filter((c) => c.adMapped).length,
    fbclidWithoutIds: metaTouches.filter(
      (touch) =>
        touch.fbclid &&
        !sanitizeMetaId(touch.campaignId) &&
        !sanitizeMetaId(touch.adsetId) &&
        !sanitizeMetaId(touch.adId),
    ).length,
    conflictingIds: metaTouches.filter(
      (touch) => touch.campaignIdConflict || touch.adsetIdConflict || touch.adIdConflict,
    ).length,
    hierarchyConflicts: metaCredits.filter((credit) => credit.hierarchyConflict).length,
    sessionIdConflicts: metaCredits.filter((credit) => credit.sessionIdConflict).length,
  };
}

export type MetaOrderMappingRates = {
  metaAttributedOrders: number;
  campaignMappedOrders: number;
  campaignUnmappedOrders: number;
  campaignMappingRate: number;
  adsetMappedOrders: number;
  adsetUnmappedOrders: number;
  adsetMappingRate: number;
  adMappedOrders: number;
  adUnmappedOrders: number;
  adMappingRate: number;
  metaChannelCredit: number;
  campaignMappedCredit: number;
  campaignUnmappedCredit: number;
  adsetMappedCredit: number;
  adsetUnmappedCredit: number;
  adMappedCredit: number;
  adUnmappedCredit: number;
};

function clampRate(numerator: number, denominator: number): number {
  if (!(denominator > 0)) return 0;
  const rate = numerator / denominator;
  if (rate < 0) return 0;
  if (rate > 1) return 1;
  return rate;
}

export function summarizeMetaMappingAtOrderGrain(args: {
  orders: MetaCreditOrder[];
  model: AttributionModel;
  windowDays: number;
  indexes: MetaFactIndexes;
}): MetaOrderMappingRates {
  const rollup = metaCreditForOrders(args);
  const metaOrderIds = new Set(rollup.credits.map((credit) => credit.orderName));
  const campaignMapped = new Set<string>();
  const adsetMapped = new Set<string>();
  const adMapped = new Set<string>();
  for (const credit of rollup.credits) {
    if (credit.campaignMappingMethod === "campaign_id_exact") {
      campaignMapped.add(credit.orderName);
    }
    if (credit.adsetMapped) adsetMapped.add(credit.orderName);
    if (credit.adMapped) adMapped.add(credit.orderName);
  }
  const metaAttributedOrders = metaOrderIds.size;
  const campaignMappedOrders = campaignMapped.size;
  const adsetMappedOrders = adsetMapped.size;
  const adMappedOrders = adMapped.size;
  return {
    metaAttributedOrders,
    campaignMappedOrders,
    campaignUnmappedOrders: metaAttributedOrders - campaignMappedOrders,
    campaignMappingRate: clampRate(campaignMappedOrders, metaAttributedOrders),
    adsetMappedOrders,
    adsetUnmappedOrders: metaAttributedOrders - adsetMappedOrders,
    adsetMappingRate: clampRate(adsetMappedOrders, metaAttributedOrders),
    adMappedOrders,
    adUnmappedOrders: metaAttributedOrders - adMappedOrders,
    adMappingRate: clampRate(adMappedOrders, metaAttributedOrders),
    metaChannelCredit: rollup.channelCredit,
    campaignMappedCredit: rollup.campaignMappedCredit,
    campaignUnmappedCredit: rollup.campaignUnmappedCredit,
    adsetMappedCredit: rollup.adsetMappedCredit,
    adsetUnmappedCredit: rollup.adsetUnmappedCredit,
    adMappedCredit: rollup.adMappedCredit,
    adUnmappedCredit: rollup.adUnmappedCredit,
  };
}

export type MetaHierarchyViolation = {
  kind:
    | "CHANNEL_BALANCE"
    | "PARENT_MISMATCH_ADSET"
    | "PARENT_MISMATCH_AD"
    | "CHILD_CREDIT_EXCEEDS_PARENT_CAMPAIGN"
    | "CHILD_CREDIT_EXCEEDS_PARENT_ADSET";
  orderId?: string;
  detail: string;
};

export function validateMetaCreditHierarchy(
  rollup: MetaCreditRollup,
  indexes: MetaFactIndexes,
  epsilon = 1e-6,
): {
  metaChannelCredit: number;
  campaignMappedCredit: number;
  campaignUnmappedCredit: number;
  adsetMappedCredit: number;
  adsetUnmappedCredit: number;
  adMappedCredit: number;
  adUnmappedCredit: number;
  hierarchyViolations: number;
  violations: MetaHierarchyViolation[];
} {
  const violations: MetaHierarchyViolation[] = [];
  const channel = rollup.channelCredit;
  if (
    Math.abs(rollup.campaignMappedCredit + rollup.campaignUnmappedCredit - channel) > epsilon
  ) {
    violations.push({
      kind: "CHANNEL_BALANCE",
      detail: `campaign mapped+unmapped ${rollup.campaignMappedCredit + rollup.campaignUnmappedCredit} != channel ${channel}`,
    });
  }
  if (Math.abs(rollup.adsetMappedCredit + rollup.adsetUnmappedCredit - channel) > epsilon) {
    violations.push({
      kind: "CHANNEL_BALANCE",
      detail: `adset mapped+unmapped ${rollup.adsetMappedCredit + rollup.adsetUnmappedCredit} != channel ${channel}`,
    });
  }
  if (Math.abs(rollup.adMappedCredit + rollup.adUnmappedCredit - channel) > epsilon) {
    violations.push({
      kind: "CHANNEL_BALANCE",
      detail: `ad mapped+unmapped ${rollup.adMappedCredit + rollup.adUnmappedCredit} != channel ${channel}`,
    });
  }

  const campaignCredit = new Map<string, number>();
  const adsetCredit = new Map<string, number>();
  const adsetCreditByParentCampaign = new Map<string, number>();
  const adCreditByParentAdset = new Map<string, number>();

  for (const credit of rollup.credits) {
    const campaignId = sanitizeMetaId(credit.metaCampaignId);
    const adsetId = sanitizeMetaId(credit.metaAdsetId);
    const adId = sanitizeMetaId(credit.metaAdId);
    const check = evaluateMetaHierarchy(
      { campaignId, adsetId, adId },
      indexes,
    );
    if (check.conflict && (credit.adsetMapped || credit.adMapped || credit.campaignMappingMethod === "campaign_id_exact")) {
      const kind = check.reasons.some((reason) => reason.startsWith("adset"))
        ? "PARENT_MISMATCH_ADSET"
        : "PARENT_MISMATCH_AD";
      violations.push({
        kind,
        orderId: credit.orderName,
        detail: check.reasons.join("; "),
      });
    }

    if (credit.campaignMappingMethod === "campaign_id_exact" && campaignId) {
      campaignCredit.set(campaignId, (campaignCredit.get(campaignId) ?? 0) + credit.creditDollars);
    }
    if (credit.adsetMapped && adsetId) {
      adsetCredit.set(adsetId, (adsetCredit.get(adsetId) ?? 0) + credit.creditDollars);
      const parentCampaign = indexes.adsetParentCampaign.get(adsetId);
      if (parentCampaign) {
        adsetCreditByParentCampaign.set(
          parentCampaign,
          (adsetCreditByParentCampaign.get(parentCampaign) ?? 0) + credit.creditDollars,
        );
      }
    }
    if (credit.adMapped && adId) {
      const parentAdset = indexes.adParentAdset.get(adId);
      if (parentAdset) {
        adCreditByParentAdset.set(
          parentAdset,
          (adCreditByParentAdset.get(parentAdset) ?? 0) + credit.creditDollars,
        );
      }
    }
  }

  for (const [campaignId, childCredit] of adsetCreditByParentCampaign) {
    const parentCredit = campaignCredit.get(campaignId) ?? 0;
    if (childCredit > parentCredit + epsilon) {
      violations.push({
        kind: "CHILD_CREDIT_EXCEEDS_PARENT_CAMPAIGN",
        detail: `adset credit ${childCredit} under campaign ${campaignId} exceeds campaign credit ${parentCredit}`,
      });
    }
  }
  for (const [adsetId, childCredit] of adCreditByParentAdset) {
    const parentCredit = adsetCredit.get(adsetId) ?? 0;
    if (childCredit > parentCredit + epsilon) {
      violations.push({
        kind: "CHILD_CREDIT_EXCEEDS_PARENT_ADSET",
        detail: `ad credit ${childCredit} under adset ${adsetId} exceeds adset credit ${parentCredit}`,
      });
    }
  }

  return {
    metaChannelCredit: channel,
    campaignMappedCredit: rollup.campaignMappedCredit,
    campaignUnmappedCredit: rollup.campaignUnmappedCredit,
    adsetMappedCredit: rollup.adsetMappedCredit,
    adsetUnmappedCredit: rollup.adsetUnmappedCredit,
    adMappedCredit: rollup.adMappedCredit,
    adUnmappedCredit: rollup.adUnmappedCredit,
    hierarchyViolations: violations.length,
    violations,
  };
}
