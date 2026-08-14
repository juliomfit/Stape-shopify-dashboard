import { unstable_cache } from "next/cache";
import { cache } from "react";

/** Cross-request TTL for Shopify/BigQuery payloads. Spend paste is not cached. */
export const DASHBOARD_CACHE_SECONDS = 60;

export function rememberAcrossRequests<T>(
  keyParts: string[],
  loader: () => Promise<T>,
): Promise<T> {
  const cached = unstable_cache(loader, keyParts, {
    revalidate: DASHBOARD_CACHE_SECONDS,
  });
  return cached();
}

/** Same request + 60s across requests. */
export function rememberDashboard<T>(
  keyParts: string[],
  loader: () => Promise<T>,
): Promise<T> {
  const requestCached = cache(async (key: string) => {
    void key;
    return rememberAcrossRequests(keyParts, loader);
  });
  return requestCached(keyParts.join(":"));
}
