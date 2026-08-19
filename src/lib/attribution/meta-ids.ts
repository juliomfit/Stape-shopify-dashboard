/**
 * Phase 2 Meta deterministic identity contract.
 *
 * Authoritative first-party query / cookie / cart names. IDs are the
 * join keys. Names are diagnostic/display fallback only — never the
 * preferred campaign join once IDs exist.
 *
 * Two different identity lifetimes:
 * - CURRENT SESSION / CLICK (`gn_meta_*` session storage): this landing.
 *   Typed BigQuery `meta_*` columns and canonical session touches use this.
 * - FIRST TOUCH / Shopify audit (`gn_first_meta_*`, 365-day first-write):
 *   the visitor's original Meta click. Never treat as the converting campaign.
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

/** Current session / click cookies. 30-minute inactivity TTL. Overwrite on a new Meta landing. */
export const META_COOKIE_CAMPAIGN_ID = "gn_meta_campaign_id";
export const META_COOKIE_ADSET_ID = "gn_meta_adset_id";
export const META_COOKIE_AD_ID = "gn_meta_ad_id";

/** Durable first-touch cookies / Shopify cart audit keys. First-write only. */
export const META_FIRST_COOKIE_CAMPAIGN_ID = "gn_first_meta_campaign_id";
export const META_FIRST_COOKIE_ADSET_ID = "gn_first_meta_adset_id";
export const META_FIRST_COOKIE_AD_ID = "gn_first_meta_ad_id";

export const META_CART_CAMPAIGN_ID = "gn_first_meta_campaign_id";
export const META_CART_ADSET_ID = "gn_first_meta_adset_id";
export const META_CART_AD_ID = "gn_first_meta_ad_id";

/** Legacy cart keys from the 365-day first-write stitch. Read-only fallback. */
export const META_CART_CAMPAIGN_ID_LEGACY = "gn_meta_campaign_id";
export const META_CART_ADSET_ID_LEGACY = "gn_meta_adset_id";
export const META_CART_AD_ID_LEGACY = "gn_meta_ad_id";

/**
 * Typed BigQuery columns. CURRENT SESSION / CLICK identity, never first-touch
 * cookies. Canonical warehouse SQL still extracts the same IDs from
 * `page_location` until migration 006 is confirmed.
 */
export const BQ_META_CAMPAIGN_ID = "meta_campaign_id";
export const BQ_META_ADSET_ID = "meta_adset_id";
export const BQ_META_AD_ID = "meta_ad_id";

export const META_HIERARCHY_CONFLICT = "META_HIERARCHY_CONFLICT";
export const SESSION_ID_CONFLICT = "SESSION_ID_CONFLICT";

/** Browser current-session Meta IDs expire after 30 minutes of inactivity. */
export const META_SESSION_TTL_MS = 30 * 60 * 1000;

const META_ID_RE = /^[0-9]{1,32}$/;

export type MetaIdTriple = {
  campaignId: string | null;
  adsetId: string | null;
  adId: string | null;
};

export type MetaTouchIds = MetaIdTriple & {
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

export type AcquisitionRowKey = {
  eventTimestamp: number;
  eventId: string;
};

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

export function emptyMetaIdTriple(): MetaIdTriple {
  return { campaignId: null, adsetId: null, adId: null };
}

export function hasMetaId(ids: MetaIdTriple): boolean {
  return Boolean(ids.campaignId || ids.adsetId || ids.adId);
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

export type StoredSessionMeta = MetaIdTriple & {
  lastSeen: number | null;
};

/**
 * Browser identity split used by the stitch HTML.
 *
 * When the landing URL contains `gn_meta_*` IDs:
 * - CURRENT SESSION values become that click (overwrite) and lastSeen resets.
 * - FIRST TOUCH values are first-write only.
 *
 * When the URL has no `gn_meta_*` IDs:
 * - age <= 30 minutes: keep current IDs and refresh lastSeen (active browsing).
 * - inactivity > 30 minutes: clear current session IDs. First-touch is unchanged.
 *
 * Typed event identity (`meta_*`) is always the current session triple.
 */
export function applyMetaLandingIdentity(args: {
  urlIds: MetaIdTriple;
  firstTouch: MetaIdTriple;
  sessionIds: MetaIdTriple;
  lastSeen?: number | null;
  now?: number;
  ttlMs?: number;
}): {
  firstTouch: MetaIdTriple;
  sessionIds: MetaIdTriple;
  typedEventIds: MetaIdTriple;
  lastSeen: number | null;
  expired: boolean;
} {
  const now = args.now ?? 0;
  const ttlMs = args.ttlMs ?? META_SESSION_TTL_MS;
  const firstTouch: MetaIdTriple = { ...args.firstTouch };
  let sessionIds: MetaIdTriple = { ...args.sessionIds };
  let lastSeen = args.lastSeen ?? null;
  let expired = false;

  if (hasMetaId(args.urlIds)) {
    sessionIds = {
      campaignId: args.urlIds.campaignId,
      adsetId: args.urlIds.adsetId,
      adId: args.urlIds.adId,
    };
    lastSeen = now;
    if (!firstTouch.campaignId && args.urlIds.campaignId) {
      firstTouch.campaignId = args.urlIds.campaignId;
    }
    if (!firstTouch.adsetId && args.urlIds.adsetId) {
      firstTouch.adsetId = args.urlIds.adsetId;
    }
    if (!firstTouch.adId && args.urlIds.adId) {
      firstTouch.adId = args.urlIds.adId;
    }
  } else if (hasMetaId(sessionIds)) {
    const age = lastSeen == null || now === 0 ? Number.POSITIVE_INFINITY : now - lastSeen;
    if (age > ttlMs) {
      sessionIds = emptyMetaIdTriple();
      lastSeen = null;
      expired = true;
    } else {
      lastSeen = now;
    }
  }

  return { firstTouch, sessionIds, typedEventIds: sessionIds, lastSeen, expired };
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

/**
 * Stable secondary key after event_timestamp for acquisition/session ARRAY_AGG.
 * Same timestamp must not pick campaign/adset/ad IDs nondeterministically.
 */
export function compareAcquisitionRowKeys(a: AcquisitionRowKey, b: AcquisitionRowKey): number {
  if (a.eventTimestamp !== b.eventTimestamp) return a.eventTimestamp - b.eventTimestamp;
  if (a.eventId === b.eventId) return 0;
  return a.eventId < b.eventId ? -1 : 1;
}

export function pickAcquisitionRow<T extends AcquisitionRowKey>(rows: T[]): T | undefined {
  if (rows.length === 0) return undefined;
  return [...rows].sort(compareAcquisitionRowKeys)[0];
}
