export const DASHBOARD_CACHE_SECONDS = 45;

export const CACHE_TAGS = {
  shopify: "shopify",
  stape: "stape",
  meta: "meta",
  warehouse: "warehouse",
  ga4: "ga4",
  dashboardCore: "dashboard-core",
  health: "health",
  cogs: "cogs",
  paste: "paste",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

export type InvalidationSource =
  | "shopify"
  | "meta"
  | "stape"
  | "ga4"
  | "google_ads"
  | "all";

export type CachedSource = InvalidationSource;

export type InvalidationMode = "hard" | "swr";

export type CacheMutation = "cogs" | "paste" | "credentials";

/**
 * Tag map for refresh buttons. Meta refresh must not clear Shopify.
 * Google Ads paste/env totals live in dashboard-core, not warehouse facts.
 */
export function tagsForSource(source: InvalidationSource): readonly string[] {
  switch (source) {
    case "shopify":
      return [CACHE_TAGS.shopify, CACHE_TAGS.dashboardCore, CACHE_TAGS.health];
    case "meta":
      return [CACHE_TAGS.meta, CACHE_TAGS.dashboardCore, CACHE_TAGS.health];
    case "stape":
      return [
        CACHE_TAGS.stape,
        CACHE_TAGS.warehouse,
        CACHE_TAGS.dashboardCore,
        CACHE_TAGS.health,
      ];
    case "ga4":
      return [CACHE_TAGS.ga4, CACHE_TAGS.health];
    case "google_ads":
      return [CACHE_TAGS.dashboardCore, CACHE_TAGS.health];
    case "all":
      return Object.values(CACHE_TAGS);
    default:
      return [CACHE_TAGS.health];
  }
}

export function tagsForMutation(kind: CacheMutation): readonly string[] {
  switch (kind) {
    case "cogs":
      return [CACHE_TAGS.cogs];
    case "paste":
      return [CACHE_TAGS.paste];
    case "credentials":
      return [CACHE_TAGS.dashboardCore, CACHE_TAGS.health];
  }
}

/**
 * Next.js 16.3 Route Handler profile for `revalidateTag`.
 * `"max"` is stale-while-revalidate (background refresh).
 * `{ expire: 0 }` expires the entry immediately so the next read is a miss.
 * Do not use `updateTag` in Route Handlers — it is Server-Action only.
 */
export function revalidateProfile(mode: InvalidationMode): "max" | { expire: 0 } {
  return mode === "swr" ? "max" : { expire: 0 };
}
