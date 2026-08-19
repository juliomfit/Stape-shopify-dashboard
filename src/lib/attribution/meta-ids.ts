/**
 * Phase 2 Meta deterministic identity contract.
 *
 * Authoritative first-party query / cookie / cart names. IDs are the
 * join keys. Names are diagnostic/display fallback only — never the
 * preferred campaign join once IDs exist.
 *
 * Attribution math is NOT here. This module only sanitizes, parses,
 * and collapses Meta identity values.
 */

export const META_QUERY_CAMPAIGN_ID = "gn_meta_campaign_id";
export const META_QUERY_ADSET_ID = "gn_meta_adset_id";
export const META_QUERY_AD_ID = "gn_meta_ad_id";
export const META_QUERY_CAMPAIGN_NAME = "gn_meta_campaign_name";
export const META_QUERY_ADSET_NAME = "gn_meta_adset_name";
export const META_QUERY_AD_NAME = "gn_meta_ad_name";

export const META_COOKIE_CAMPAIGN_ID = "gn_meta_campaign_id";
export const META_COOKIE_ADSET_ID = "gn_meta_adset_id";
export const META_COOKIE_AD_ID = "gn_meta_ad_id";

export const META_CART_CAMPAIGN_ID = "gn_meta_campaign_id";
export const META_CART_ADSET_ID = "gn_meta_adset_id";
export const META_CART_AD_ID = "gn_meta_ad_id";

export const BQ_META_CAMPAIGN_ID = "meta_campaign_id";
export const BQ_META_ADSET_ID = "meta_adset_id";
export const BQ_META_AD_ID = "meta_ad_id";

const META_ID_RE = /^[0-9]{1,32}$/;

export type MetaTouchIds = {
  campaignId: string | null;
  adsetId: string | null;
  adId: string | null;
  campaignName: string | null;
  adsetName: string | null;
  adName: string | null;
};

export type SessionMetaCollapse = MetaTouchIds & {
  campaignIdConflict: boolean;
  adsetIdConflict: boolean;
  adIdConflict: boolean;
};

export type MappingCoverageStatus =
  | "COLLECTING_DATA"
  | "NOT_YET_VALIDATED"
  | "HAS_HIGH_ID_MAPS";

export function sanitizeMetaId(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === "(not set)") return null;
  if (!META_ID_RE.test(trimmed)) return null;
  return trimmed;
}

export function sanitizeMetaName(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim().slice(0, 200);
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === "(not set)") return null;
  return trimmed;
}

export function parseMetaIdsFromQuery(
  params: URLSearchParams | Record<string, string | null | undefined>,
): MetaTouchIds {
  const get = (key: string): string | null => {
    if (params instanceof URLSearchParams) return params.get(key);
    const v = params[key];
    return v == null ? null : String(v);
  };
  return {
    campaignId: sanitizeMetaId(get(META_QUERY_CAMPAIGN_ID)),
    adsetId: sanitizeMetaId(get(META_QUERY_ADSET_ID)),
    adId: sanitizeMetaId(get(META_QUERY_AD_ID)),
    campaignName: sanitizeMetaName(get(META_QUERY_CAMPAIGN_NAME)),
    adsetName: sanitizeMetaName(get(META_QUERY_ADSET_NAME)),
    adName: sanitizeMetaName(get(META_QUERY_AD_NAME)),
  };
}

export function parseMetaIdsFromUrl(url: string | null | undefined): MetaTouchIds {
  if (!url) {
    return {
      campaignId: null,
      adsetId: null,
      adId: null,
      campaignName: null,
      adsetName: null,
      adName: null,
    };
  }
  try {
    const parsed = new URL(url, "https://placeholder.invalid");
    return parseMetaIdsFromQuery(parsed.searchParams);
  } catch {
    const q = url.includes("?") ? url.slice(url.indexOf("?") + 1) : url;
    return parseMetaIdsFromQuery(new URLSearchParams(q.split("#")[0]));
  }
}

/**
 * Collapse Meta IDs observed on multiple event rows of one session.
 *
 * Prefer the acquisition / first-eligible landing event. If later events
 * disagree, KEEP the landing value and surface a quality warning. Never
 * pick randomly. Never pick by spend.
 */
export function collapseSessionMetaIds(args: {
  landing: MetaTouchIds;
  later: MetaTouchIds[];
}): SessionMetaCollapse {
  const distinct = (pick: (ids: MetaTouchIds) => string | null) => {
    const set = new Set<string>();
    const land = pick(args.landing);
    if (land) set.add(land);
    for (const row of args.later) {
      const v = pick(row);
      if (v) set.add(v);
    }
    return set;
  };
  const campaignIds = distinct((x) => x.campaignId);
  const adsetIds = distinct((x) => x.adsetId);
  const adIds = distinct((x) => x.adId);
  return {
    campaignId: args.landing.campaignId,
    adsetId: args.landing.adsetId,
    adId: args.landing.adId,
    campaignName: args.landing.campaignName,
    adsetName: args.landing.adsetName,
    adName: args.landing.adName,
    campaignIdConflict: campaignIds.size > 1,
    adsetIdConflict: adsetIds.size > 1,
    adIdConflict: adIds.size > 1,
  };
}

export function mappingCoverageStatus(args: {
  highIdMappedTouches: number;
  nameFallbackTouches: number;
  unmappedTouches: number;
}): MappingCoverageStatus {
  if (args.highIdMappedTouches > 0) return "HAS_HIGH_ID_MAPS";
  if (args.nameFallbackTouches + args.unmappedTouches === 0) return "COLLECTING_DATA";
  return "NOT_YET_VALIDATED";
}

export function formatMappingCoverageLabel(status: MappingCoverageStatus): string {
  if (status === "HAS_HIGH_ID_MAPS") return "HAS HIGH-ID MAPS";
  if (status === "COLLECTING_DATA") return "COLLECTING DATA";
  return "NOT YET VALIDATED";
}

/** Canonical OUR campaign grain key: numeric Meta campaign ID wins over UTM name. */
export function campaignGrainKey(touch: {
  campaignId?: string | null;
  campaign?: string | null;
}): string {
  return sanitizeMetaId(touch.campaignId) ?? (touch.campaign?.trim() || "(unmapped)");
}
