import {
  attributedNcac,
  cpc,
  cpm,
  ctr,
  metaFrequency,
  platformCpa,
  platformRoas,
  ratio,
} from "../metrics/formulas.ts";
import {
  formatMappingCoverageLabel,
  mappingCoverageStatus,
  type MappingCoverageStatus,
} from "./meta-ids.ts";
import { campaignIdExactMatchAllowed } from "./meta-id-namespace.ts";

export const CAMPAIGN_MAPPING_STATUS = "VALIDATION REQUIRED" as const;

export type CampaignMappingMethod =
  | "campaign_id_exact"
  | "campaign_name_exact_unique"
  | "ambiguous_name"
  | "unmapped";

export type CampaignMappingConfidence = "HIGH" | "PARTIAL" | "NONE";

export type CampaignMapMetaFact = {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number | null;
  purchase_value: number | null;
  reach?: number;
  inline_link_clicks?: number | null;
  unique_clicks?: number | null;
  unique_ctr?: number | null;
  outbound_clicks?: number | null;
  conversions?: number | null;
  add_to_cart?: number | null;
  initiate_checkout?: number | null;
  landing_page_views?: number | null;
  frequency?: number | null;
  extended_metrics?: Record<string, number | string | null> | string | null;
};

export type CampaignMapOurRow = {
  campaign: string;
  channel: string;
  orders: number;
  revenue: number;
};

export type OurCampaignRow = {
  campaignId: string | null;
  campaignName: string;
  platformPresent: boolean;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  clicks: number;
  linkClicks: number;
  uniqueClicks?: number | null;
  uniqueCtr?: number | null;
  outboundClicks?: number | null;
  landingPageViews?: number | null;
  addToCart?: number | null;
  initiateCheckout?: number | null;
  conversions?: number | null;
  costLpv?: number | null;
  costAtc?: number | null;
  costCheckout?: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  metaPurchases: number | null;
  metaRevenue: number | null;
  metaCpa: number | null;
  metaRoas: number | null;
  videoP25?: number | null;
  videoP50?: number | null;
  videoP75?: number | null;
  videoP95?: number | null;
  videoP100?: number | null;
  video30s?: number | null;
  videoAvgTime?: number | null;
  postEngagement?: number | null;
  pageEngagement?: number | null;
  postReactions?: number | null;
  messagingConversations?: number | null;
  qualityRanking?: string | null;
  engagementRateRanking?: string | null;
  conversionRateRanking?: string | null;
  extendedMetrics?: Record<string, number | string | null>;
  ourOrders: number;
  ourRevenue: number;
  ourRoas: number | null;
  newCustomerCredit: number;
  newCustomerRevenue: number;
  attributedNcac: number | null;
  differencePct: number | null;
  mapped: boolean;
  mappingMethod: CampaignMappingMethod;
  mappingConfidence: CampaignMappingConfidence;
  mappingStatus: typeof CAMPAIGN_MAPPING_STATUS | CampaignMappingMethod;
};

/**
 * Conservative form-decode for campaign/ad names. Does not throw on
 * malformed percent-encoding. Does not mutate warehouse source values.
 */
export function decodeFormEncodedName(value: string | null | undefined): string {
  const plusAsSpace = String(value ?? "").replace(/\+/g, " ");
  try {
    return decodeURIComponent(plusAsSpace);
  } catch {
    return plusAsSpace.replace(/%([0-9A-Fa-f]{2})/g, (match) => {
      try {
        return decodeURIComponent(match);
      } catch {
        return match;
      }
    });
  }
}

/** Name-fallback join key only. Unique canonical name → PARTIAL, never HIGH. */
export function canonicalCampaignName(value: string | null | undefined): string {
  return decodeFormEncodedName(value).trim().replace(/\s+/g, " ").toLowerCase();
}

export function displayCampaignName(value: string | null | undefined): string {
  const decoded = decodeFormEncodedName(value).trim().replace(/\s+/g, " ");
  return decoded || String(value ?? "");
}

export function displayAdsetName(value: string | null | undefined): string {
  return displayCampaignName(value);
}

export function displayAdName(value: string | null | undefined): string {
  return displayCampaignName(value);
}

export function shortenId(id: string | null | undefined): string {
  const raw = String(id ?? "").trim();
  if (!raw) return "";
  if (raw.length <= 12) return raw;
  return `${raw.slice(0, 8)}…${raw.slice(-4)}`;
}

function norm(value: string) {
  return canonicalCampaignName(value);
}

function addNullable(acc: number | null, value: number | null | undefined): number | null {
  if (value == null) return acc;
  return (acc ?? 0) + value;
}

function parseExtended(
  value: CampaignMapMetaFact["extended_metrics"],
): Record<string, number | string | null> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, number | string | null>;
      }
    } catch {
      return {};
    }
    return {};
  }
  return value;
}

function mergeExtended(
  acc: Record<string, number | string | null>,
  next: Record<string, number | string | null>,
) {
  for (const [key, value] of Object.entries(next)) {
    if (typeof value === "number") {
      const prev = acc[key];
      acc[key] = typeof prev === "number" ? prev + value : value;
    } else if (acc[key] == null && value != null) {
      acc[key] = value;
    }
  }
  return acc;
}

type MetaAgg = {
  campaignId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  linkClicks: number;
  uniqueClicks: number | null;
  uniqueCtr: number | null;
  outboundClicks: number | null;
  landingPageViews: number | null;
  addToCart: number | null;
  initiateCheckout: number | null;
  conversions: number | null;
  purchases: number | null;
  revenue: number | null;
  videoP25: number | null;
  videoP50: number | null;
  videoP75: number | null;
  videoP95: number | null;
  videoP100: number | null;
  video30s: number | null;
  videoAvgTime: number | null;
  postEngagement: number | null;
  pageEngagement: number | null;
  postReactions: number | null;
  messagingConversations: number | null;
  qualityRanking: string | null;
  engagementRateRanking: string | null;
  conversionRateRanking: string | null;
  extendedMetrics: Record<string, number | string | null>;
};

function emptyPlatform() {
  return {
    platformPresent: false,
    spend: 0,
    impressions: 0,
    reach: 0,
    frequency: 0,
    clicks: 0,
    linkClicks: 0,
    uniqueClicks: null as number | null,
    uniqueCtr: null as number | null,
    outboundClicks: null as number | null,
    landingPageViews: null as number | null,
    addToCart: null as number | null,
    initiateCheckout: null as number | null,
    conversions: null as number | null,
    costLpv: null as number | null,
    costAtc: null as number | null,
    costCheckout: null as number | null,
    ctr: null as number | null,
    cpc: null as number | null,
    cpm: null as number | null,
    metaPurchases: null as number | null,
    metaRevenue: null as number | null,
    metaCpa: null as number | null,
    metaRoas: null as number | null,
    videoP25: null as number | null,
    videoP50: null as number | null,
    videoP75: null as number | null,
    videoP95: null as number | null,
    videoP100: null as number | null,
    video30s: null as number | null,
    videoAvgTime: null as number | null,
    postEngagement: null as number | null,
    pageEngagement: null as number | null,
    postReactions: null as number | null,
    messagingConversations: null as number | null,
    qualityRanking: null as string | null,
    engagementRateRanking: null as string | null,
    conversionRateRanking: null as string | null,
    extendedMetrics: {} as Record<string, number | string | null>,
  };
}

function extNum(ext: Record<string, number | string | null>, names: string[]): number | null {
  for (const name of names) {
    const value = ext[name];
    if (typeof value === "number") return value;
  }
  return null;
}

function extStr(ext: Record<string, number | string | null>, names: string[]): string | null {
  for (const name of names) {
    const value = ext[name];
    if (typeof value === "string" && value) return value;
  }
  return null;
}

function platformFromAgg(agg: MetaAgg | null) {
  if (!agg) {
    return emptyPlatform();
  }
  const ext = agg.extendedMetrics;
  const landingPageViews = agg.landingPageViews;
  const addToCart = agg.addToCart;
  const initiateCheckout = agg.initiateCheckout;
  const purchases = agg.purchases;
  return {
    platformPresent: true,
    spend: agg.spend,
    impressions: agg.impressions,
    reach: agg.reach,
    frequency: metaFrequency(agg.impressions, agg.reach),
    clicks: agg.clicks,
    linkClicks: agg.linkClicks,
    uniqueClicks: agg.uniqueClicks,
    uniqueCtr: agg.uniqueCtr,
    outboundClicks: agg.outboundClicks,
    landingPageViews,
    addToCart,
    initiateCheckout,
    conversions: agg.conversions,
    costLpv: platformCpa(agg.spend, landingPageViews),
    costAtc: platformCpa(agg.spend, addToCart),
    costCheckout: platformCpa(agg.spend, initiateCheckout),
    ctr: ctr(agg.clicks, agg.impressions),
    cpc: cpc(agg.spend, agg.clicks),
    cpm: cpm(agg.spend, agg.impressions),
    metaPurchases: purchases,
    metaRevenue: agg.revenue,
    metaCpa: platformCpa(agg.spend, purchases),
    metaRoas: agg.revenue == null ? null : platformRoas(agg.revenue, agg.spend),
    videoP25: agg.videoP25 ?? extNum(ext, ["video_p25_watched_actions"]),
    videoP50: agg.videoP50 ?? extNum(ext, ["video_p50_watched_actions"]),
    videoP75: agg.videoP75 ?? extNum(ext, ["video_p75_watched_actions"]),
    videoP95: agg.videoP95 ?? extNum(ext, ["video_p95_watched_actions"]),
    videoP100: agg.videoP100 ?? extNum(ext, ["video_p100_watched_actions"]),
    video30s: agg.video30s ?? extNum(ext, ["video_30_sec_watched", "video_30_sec_watched_actions"]),
    videoAvgTime:
      agg.videoAvgTime ?? extNum(ext, ["video_avg_time_watched", "video_avg_time_watched_actions"]),
    postEngagement: agg.postEngagement ?? extNum(ext, ["post_engagement"]),
    pageEngagement: agg.pageEngagement ?? extNum(ext, ["page_engagement"]),
    postReactions: agg.postReactions ?? extNum(ext, ["post_reactions"]),
    messagingConversations:
      agg.messagingConversations ?? extNum(ext, ["messaging_conversations_started"]),
    qualityRanking: agg.qualityRanking ?? extStr(ext, ["quality_ranking"]),
    engagementRateRanking: agg.engagementRateRanking ?? extStr(ext, ["engagement_rate_ranking"]),
    conversionRateRanking: agg.conversionRateRanking ?? extStr(ext, ["conversion_rate_ranking"]),
    extendedMetrics: ext,
  };
}

function emptyAgg(id: string, name: string): MetaAgg {
  return {
    campaignId: id,
    campaignName: name || id,
    spend: 0,
    impressions: 0,
    reach: 0,
    clicks: 0,
    linkClicks: 0,
    uniqueClicks: null,
    uniqueCtr: null,
    outboundClicks: null,
    landingPageViews: null,
    addToCart: null,
    initiateCheckout: null,
    conversions: null,
    purchases: null,
    revenue: null,
    videoP25: null,
    videoP50: null,
    videoP75: null,
    videoP95: null,
    videoP100: null,
    video30s: null,
    videoAvgTime: null,
    postEngagement: null,
    pageEngagement: null,
    postReactions: null,
    messagingConversations: null,
    qualityRanking: null,
    engagementRateRanking: null,
    conversionRateRanking: null,
    extendedMetrics: {},
  };
}

function aggregateMeta(facts: CampaignMapMetaFact[]) {
  const byId = new Map<string, MetaAgg>();
  const idsByName = new Map<string, Set<string>>();

  for (const fact of facts) {
    const id = fact.campaign_id?.trim();
    const name = fact.campaign_name?.trim() || id;
    if (id) {
      const current = byId.get(id) ?? emptyAgg(id, name || id);
      current.spend += fact.spend;
      current.impressions += fact.impressions;
      current.reach += fact.reach ?? 0;
      current.clicks += fact.clicks;
      current.linkClicks += fact.inline_link_clicks ?? 0;
      current.uniqueClicks = addNullable(current.uniqueClicks, fact.unique_clicks);
      current.uniqueCtr = fact.unique_ctr ?? current.uniqueCtr;
      current.outboundClicks = addNullable(current.outboundClicks, fact.outbound_clicks);
      current.landingPageViews = addNullable(current.landingPageViews, fact.landing_page_views);
      current.addToCart = addNullable(current.addToCart, fact.add_to_cart);
      current.initiateCheckout = addNullable(current.initiateCheckout, fact.initiate_checkout);
      current.conversions = addNullable(current.conversions, fact.conversions);
      current.purchases = addNullable(current.purchases, fact.purchases);
      current.revenue = addNullable(current.revenue, fact.purchase_value);
      current.extendedMetrics = mergeExtended(
        current.extendedMetrics,
        parseExtended(fact.extended_metrics),
      );
      if (name) {
        current.campaignName = name;
      }
      byId.set(id, current);
    }
    if (name) {
      const ids = idsByName.get(norm(name)) ?? new Set<string>();
      if (id) {
        ids.add(id);
      }
      idsByName.set(norm(name), ids);
    }
  }

  return { byId, idsByName };
}

export function resolveCampaignMapping(
  ourCampaign: string,
  meta: ReturnType<typeof aggregateMeta>,
): {
  meta: MetaAgg | null;
  method: CampaignMappingMethod;
  confidence: CampaignMappingConfidence;
} {
  const raw = ourCampaign.trim();
  if (!raw || raw === "(unmapped)") {
    return { meta: null, method: "unmapped", confidence: "NONE" };
  }

  const byId = meta.byId.get(raw);
  if (byId && campaignIdExactMatchAllowed(raw, byId.campaignId)) {
    return { meta: byId, method: "campaign_id_exact", confidence: "HIGH" };
  }

  const nameIds = meta.idsByName.get(norm(raw));
  if (!nameIds || nameIds.size === 0) {
    return { meta: null, method: "unmapped", confidence: "NONE" };
  }
  if (nameIds.size > 1) {
    return { meta: null, method: "ambiguous_name", confidence: "NONE" };
  }
  const onlyId = [...nameIds][0];
  const unique = meta.byId.get(onlyId) ?? null;
  return {
    meta: unique,
    method: unique ? "campaign_name_exact_unique" : "unmapped",
    confidence: unique ? "PARTIAL" : "NONE",
  };
}

function emptyOurRow(
  campaignName: string,
  ours: CampaignMapOurRow | null,
  method: CampaignMappingMethod,
): OurCampaignRow {
  return {
    campaignId: null,
    campaignName,
    ...platformFromAgg(null),
    ourOrders: ours?.orders ?? 0,
    ourRevenue: ours?.revenue ?? 0,
    ourRoas: null,
    newCustomerCredit: 0,
    newCustomerRevenue: 0,
    attributedNcac: null,
    differencePct: null,
    mapped: false,
    mappingMethod: method,
    mappingConfidence: "NONE",
    mappingStatus: method,
  };
}

/**
 * Join Meta daily facts to OUR campaign credit.
 * Priority: exact campaign ID (HIGH), then exact UNIQUE normalized name
 * (PARTIAL, legacy fallback only), else unmapped. Duplicate Meta names →
 * ambiguous_name (not mapped). No fuzzy match. Never allocate spend
 * proportionally to unmapped OUR revenue.
 * Attributed nCAC is only computed when mapping confidence is HIGH or PARTIAL.
 * Name fallback is legacy — prefer gn_meta_campaign_id once it exists.
 */
function applyOurCredit(
  row: OurCampaignRow,
  ours: CampaignMapOurRow,
  spend: number,
  metaRevenue: number,
  newCustomerCredit: number,
  newCustomerRevenue: number,
) {
  row.ourOrders += ours.orders;
  row.ourRevenue += ours.revenue;
  row.newCustomerCredit += newCustomerCredit;
  row.newCustomerRevenue += newCustomerRevenue;
  row.ourRoas = ratio(row.ourRevenue, spend);
  const mappingReliable =
    row.mappingConfidence === "HIGH" || row.mappingConfidence === "PARTIAL";
  row.attributedNcac = mappingReliable
    ? attributedNcac(spend, row.newCustomerCredit)
    : null;
  row.differencePct =
    metaRevenue > 0 ? (row.ourRevenue - metaRevenue) / metaRevenue : null;
}

export function joinMetaAndOurCampaigns(
  metaFacts: CampaignMapMetaFact[],
  ourRows: CampaignMapOurRow[],
  newCustomerCreditByCampaign: Record<string, number> = {},
  newCustomerRevenueByCampaign: Record<string, number> = {},
): OurCampaignRow[] {
  const meta = aggregateMeta(metaFacts);
  const usedIds = new Set<string>();
  const rows: OurCampaignRow[] = [];
  const rowByMetaId = new Map<string, OurCampaignRow>();

  for (const ours of ourRows) {
    const resolved = resolveCampaignMapping(ours.campaign, meta);
    const nc = newCustomerCreditByCampaign[ours.campaign] ?? 0;
    const ncRevenue = newCustomerRevenueByCampaign[ours.campaign] ?? 0;
    if (!resolved.meta) {
      const row = emptyOurRow(ours.campaign || "(unmapped)", ours, resolved.method);
      row.newCustomerCredit = nc;
      row.newCustomerRevenue = ncRevenue;
      rows.push(row);
      continue;
    }
    const existing = rowByMetaId.get(resolved.meta.campaignId);
    if (existing) {
      applyOurCredit(
        existing,
        ours,
        existing.spend,
        existing.metaRevenue ?? 0,
        nc,
        ncRevenue,
      );
      continue;
    }
    usedIds.add(resolved.meta.campaignId);
    const mappingReliable =
      resolved.confidence === "HIGH" || resolved.confidence === "PARTIAL";
    const row: OurCampaignRow = {
      campaignId: resolved.meta.campaignId,
      campaignName: resolved.meta.campaignName,
      ...platformFromAgg(resolved.meta),
      ourOrders: 0,
      ourRevenue: 0,
      ourRoas: null,
      newCustomerCredit: 0,
      newCustomerRevenue: 0,
      attributedNcac: null,
      differencePct: null,
      mapped: true,
      mappingMethod: resolved.method,
      mappingConfidence: resolved.confidence,
      mappingStatus: resolved.method,
    };
    applyOurCredit(row, ours, resolved.meta.spend, resolved.meta.revenue ?? 0, nc, ncRevenue);
    if (!mappingReliable) {
      row.attributedNcac = null;
    }
    rowByMetaId.set(resolved.meta.campaignId, row);
    rows.push(row);
  }

  for (const [id, fact] of meta.byId) {
    if (usedIds.has(id)) {
      continue;
    }
    rows.push({
      campaignId: fact.campaignId,
      campaignName: fact.campaignName,
      ...platformFromAgg(fact),
      ourOrders: 0,
      ourRevenue: 0,
      ourRoas: ratio(0, fact.spend),
      newCustomerCredit: 0,
      newCustomerRevenue: 0,
      attributedNcac: null,
      differencePct: (fact.revenue ?? 0) > 0 ? -1 : null,
      mapped: false,
      mappingMethod: "unmapped",
      mappingConfidence: "NONE",
      mappingStatus: "unmapped",
    });
  }

  return rows.sort((a, b) => b.spend - a.spend || b.ourRevenue - a.ourRevenue);
}

export function campaignMappingSummary(rows: OurCampaignRow[]) {
  const our = rows.filter((row) => row.ourOrders > 0 || row.ourRevenue > 0);
  const exactId = our.filter((row) => row.mappingMethod === "campaign_id_exact").length;
  const uniqueName = our.filter(
    (row) => row.mappingMethod === "campaign_name_exact_unique",
  ).length;
  const ambiguous = our.filter((row) => row.mappingMethod === "ambiguous_name").length;
  const unmapped = our.filter((row) => row.mappingMethod === "unmapped").length;
  const mapped = exactId + uniqueName;
  return {
    ourRows: our.length,
    exactId,
    uniqueName,
    ambiguous,
    unmapped,
    mapped,
    mappingRate: our.length > 0 ? mapped / our.length : null,
  };
}

export function campaignMappingUiStatus(
  summary: ReturnType<typeof campaignMappingSummary>,
): MappingCoverageStatus {
  return mappingCoverageStatus({
    highIdMappedTouches: summary.exactId,
    nameFallbackTouches: summary.uniqueName,
    unmappedTouches: summary.unmapped + summary.ambiguous,
  });
}

export function campaignMappingUiLabel(
  summary: ReturnType<typeof campaignMappingSummary>,
): string {
  return formatMappingCoverageLabel(campaignMappingUiStatus(summary));
}

export type CampaignMappingBadge = {
  label: string;
  confidence: CampaignMappingConfidence;
};

export function campaignMappingBadge(row: OurCampaignRow): CampaignMappingBadge {
  if (row.mappingMethod === "campaign_id_exact") {
    return { label: "Exact ID", confidence: "HIGH" };
  }
  if (row.mappingMethod === "campaign_name_exact_unique") {
    return { label: "Name match", confidence: "PARTIAL" };
  }
  if (row.mappingMethod === "ambiguous_name") {
    return { label: "Ambiguous", confidence: "NONE" };
  }
  if (!row.platformPresent && (row.ourRevenue > 0 || row.ourOrders > 0)) {
    return { label: "OUR only", confidence: "NONE" };
  }
  if (row.platformPresent && row.ourRevenue <= 0 && row.ourOrders <= 0) {
    return { label: "Platform only", confidence: "NONE" };
  }
  return { label: "Needs mapping", confidence: "NONE" };
}

export function partitionCampaignRows(rows: OurCampaignRow[]) {
  const matched = rows.filter((row) => row.mapped);
  const needsMapping = rows.filter((row) => !row.mapped);
  const platformOnly = needsMapping.filter(
    (row) => row.spend > 0 && row.ourRevenue <= 0 && row.ourOrders <= 0,
  );
  const ourOnly = needsMapping.filter(
    (row) =>
      row.mappingMethod === "unmapped" &&
      (row.ourRevenue > 0 || row.ourOrders > 0),
  );
  const ambiguous = needsMapping.filter((row) => row.mappingMethod === "ambiguous_name");
  return { matched, needsMapping, platformOnly, ourOnly, ambiguous };
}
