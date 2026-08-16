import { unstable_cache } from "next/cache";

/** Cross-request TTL for Shopify / Stape / Meta warehouse payloads. Paste spend is not cached. */
export const DASHBOARD_CACHE_SECONDS = 60;

/** Reuses a 60s payload across requests. Keys must include the period. */
export function rememberDashboard<T>(
  keyParts: string[],
  loader: () => Promise<T>,
  tags: string[] = ["dashboard"],
): Promise<T> {
  return unstable_cache(loader, keyParts, {
    revalidate: DASHBOARD_CACHE_SECONDS,
    tags,
  })();
}
