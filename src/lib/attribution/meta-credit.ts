/**
 * Meta campaign / ad-set / ad credit enrichment.
 *
 * DOES NOT recalculate attribution. Takes existing `attribute()` weights and
 * attaches deterministic Meta IDs. Unmapped Meta credit stays visible in the
 * Unmapped Meta bucket. Child mapped credit never exceeds parent credit.
 */

import { attribute, type AttributionModel, type Touchpoint } from "./engine.ts";
import { sanitizeMetaId } from "./meta-ids.ts";
import { ratio } from "../metrics/formulas.ts";
import type {
  CampaignMappingConfidence,
  CampaignMappingMethod,
} from "./campaign-map.ts";

export const META_CHANNEL = "Facebook / Meta Ads";
export const UNMAPPED_META_LABEL = "Unmapped Meta";

export type MetaAdsetMappingMethod = "adset_id_exact" | "unmapped";
export type MetaAdMappingMethod = "ad_id_exact" | "unmapped";

export type MetaCreditTouch = {
  touchpointId: string;
  ts: number;
  channel: string;
  campaign?: string | null;
  campaignId?: string | null;
  adsetId?: string | null;
  adId?: string | null;
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
};

function normalizeName(name: string | null | undefined): string {
  return (name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
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

export function buildMetaFactIndexes(args: {
  campaigns: Array<{ campaign_id: string; campaign_name: string }>;
  adsetIds?: Iterable<string>;
  adIds?: Iterable<string>;
  creativeByAdId?: Map<string, string>;
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
      const set = idsByName.get(normalizeName(name)) ?? new Set<string>();
      if (id) set.add(id);
      idsByName.set(normalizeName(name), set);
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
  return {
    campaignById,
    campaignByUniqueName,
    ambiguousNames,
    adsetIds: new Set(
      [...(args.adsetIds ?? [])].map((id) => id.trim()).filter(Boolean),
    ),
    adIds: new Set([... (args.adIds ?? [])].map((id) => id.trim()).filter(Boolean)),
    creativeByAdId: args.creativeByAdId ?? new Map(),
  };
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
    if (indexes.campaignById.has(campaignId)) {
      return { campaignId, method: "campaign_id_exact", confidence: "HIGH" };
    }
    return { campaignId, method: "unmapped", confidence: "NONE" };
  }
  const nameKey = normalizeName(touch.campaign);
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
    const mapped =
      credit.channel === META_CHANNEL && touch
        ? mapCampaignIdentity(touch, indexes)
        : {
            campaignId: sanitizeMetaId(touch?.campaignId),
            method: "unmapped" as CampaignMappingMethod,
            confidence: "NONE" as CampaignMappingConfidence,
          };
    const adsetId = sanitizeMetaId(touch?.adsetId);
    const adId = sanitizeMetaId(touch?.adId);
    const adsetMapped =
      credit.channel === META_CHANNEL && !!adsetId && indexes.adsetIds.has(adsetId);
    const adMapped =
      credit.channel === META_CHANNEL && !!adId && indexes.adIds.has(adId);
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
  };
}
