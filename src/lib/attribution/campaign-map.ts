import { attributedNcac, platformRoas, ratio } from "../metrics/formulas.ts";
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
  spend: number;
  impressions: number;
  clicks: number;
  metaPurchases: number;
  metaRevenue: number;
  metaRoas: number | null;
  ourOrders: number;
  ourRevenue: number;
  ourRoas: number | null;
  attributedNcac: number | null;
  differencePct: number | null;
  mapped: boolean;
  mappingMethod: CampaignMappingMethod;
  mappingConfidence: CampaignMappingConfidence;
  mappingStatus: typeof CAMPAIGN_MAPPING_STATUS | CampaignMappingMethod;
};

function norm(value: string) {
  return value.trim().toLowerCase();
}

type MetaAgg = {
  campaignId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
};

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
        clicks: 0,
        purchases: 0,
        revenue: 0,
      };
      current.spend += fact.spend;
      current.impressions += fact.impressions;
      current.clicks += fact.clicks;
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
    spend: 0,
    impressions: 0,
    clicks: 0,
    metaPurchases: 0,
    metaRevenue: 0,
    metaRoas: null,
    ourOrders: ours?.orders ?? 0,
    ourRevenue: ours?.revenue ?? 0,
    ourRoas: null,
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
export function joinMetaAndOurCampaigns(
  metaFacts: CampaignMapMetaFact[],
  ourRows: CampaignMapOurRow[],
  newCustomerCreditByCampaign: Record<string, number> = {},
): OurCampaignRow[] {
  const meta = aggregateMeta(metaFacts);
  const usedIds = new Set<string>();
  const rows: OurCampaignRow[] = [];

  for (const ours of ourRows) {
    const resolved = resolveCampaignMapping(ours.campaign, meta);
    if (!resolved.meta) {
      rows.push(emptyOurRow(ours.campaign || "(unmapped)", ours, resolved.method));
      continue;
    }
    usedIds.add(resolved.meta.campaignId);
    const mappingReliable =
      resolved.confidence === "HIGH" || resolved.confidence === "PARTIAL";
    rows.push({
      campaignId: resolved.meta.campaignId,
      campaignName: resolved.meta.campaignName,
      spend: resolved.meta.spend,
      impressions: resolved.meta.impressions,
      clicks: resolved.meta.clicks,
      metaPurchases: resolved.meta.purchases,
      metaRevenue: resolved.meta.revenue,
      metaRoas: platformRoas(resolved.meta.revenue, resolved.meta.spend),
      ourOrders: ours.orders,
      ourRevenue: ours.revenue,
      ourRoas: ratio(ours.revenue, resolved.meta.spend),
      attributedNcac: mappingReliable
        ? attributedNcac(
            resolved.meta.spend,
            newCustomerCreditByCampaign[ours.campaign] ?? null,
          )
        : null,
      differencePct:
        resolved.meta.revenue > 0
          ? (ours.revenue - resolved.meta.revenue) / resolved.meta.revenue
          : null,
      mapped: true,
      mappingMethod: resolved.method,
      mappingConfidence: resolved.confidence,
      mappingStatus: resolved.method,
    });
  }

  for (const [id, fact] of meta.byId) {
    if (usedIds.has(id)) {
      continue;
    }
    rows.push({
      campaignId: fact.campaignId,
      campaignName: fact.campaignName,
      spend: fact.spend,
      impressions: fact.impressions,
      clicks: fact.clicks,
      metaPurchases: fact.purchases,
      metaRevenue: fact.revenue,
      metaRoas: platformRoas(fact.revenue, fact.spend),
      ourOrders: 0,
      ourRevenue: 0,
      ourRoas: ratio(0, fact.spend),
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
