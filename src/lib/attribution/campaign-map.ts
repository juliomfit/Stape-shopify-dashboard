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
  purchases: number;
  purchase_value: number;
  reach?: number;
  inline_link_clicks?: number;
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
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  metaPurchases: number;
  metaRevenue: number;
  metaCpa: number | null;
  metaRoas: number | null;
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

type MetaAgg = {
  campaignId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  linkClicks: number;
  purchases: number;
  revenue: number;
};

function platformFromAgg(agg: MetaAgg | null) {
  if (!agg) {
    return {
      platformPresent: false,
      spend: 0,
      impressions: 0,
      reach: 0,
      frequency: 0,
      clicks: 0,
      linkClicks: 0,
      ctr: null as number | null,
      cpc: null as number | null,
      cpm: null as number | null,
      metaPurchases: 0,
      metaRevenue: 0,
      metaCpa: null as number | null,
      metaRoas: null as number | null,
    };
  }
  return {
    platformPresent: true,
    spend: agg.spend,
    impressions: agg.impressions,
    reach: agg.reach,
    frequency: metaFrequency(agg.impressions, agg.reach),
    clicks: agg.clicks,
    linkClicks: agg.linkClicks,
    ctr: ctr(agg.clicks, agg.impressions),
    cpc: cpc(agg.spend, agg.clicks),
    cpm: cpm(agg.spend, agg.impressions),
    metaPurchases: agg.purchases,
    metaRevenue: agg.revenue,
    metaCpa: platformCpa(agg.spend, agg.purchases),
    metaRoas: platformRoas(agg.revenue, agg.spend),
  };
}

function aggregateMeta(facts: CampaignMapMetaFact[]) {
  const byId = new Map<string, MetaAgg>();
  const idsByName = new Map<string, Set<string>>();

  for (const fact of facts) {
    const id = fact.campaign_id?.trim();
    const name = fact.campaign_name?.trim() || id;
    if (id) {
      const current = byId.get(id) ?? {
        campaignId: id,
        campaignName: name || id,
        spend: 0,
        impressions: 0,
        reach: 0,
        clicks: 0,
        linkClicks: 0,
        purchases: 0,
        revenue: 0,
      };
      current.spend += fact.spend;
      current.impressions += fact.impressions;
      current.reach += fact.reach ?? 0;
      current.clicks += fact.clicks;
      current.linkClicks += fact.inline_link_clicks ?? 0;
      current.purchases += fact.purchases;
      current.revenue += fact.purchase_value;
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
        existing.metaRevenue,
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
    applyOurCredit(row, ours, resolved.meta.spend, resolved.meta.revenue, nc, ncRevenue);
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
      differencePct: fact.revenue > 0 ? -1 : null,
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
