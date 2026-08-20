import { unstable_cache } from "next/cache";
import { DASHBOARD_CACHE_SECONDS } from "@/lib/cache/tags";
import { logLoader, type LoaderSource } from "@/lib/observability/loader-log";

const lastGood = new Map<string, unknown>();

/**
 * Cross-request Next Data Cache for expensive loaders.
 * Never call cookies() inside `fn`. Pass period primitives in `key`.
 */
export async function cachedLoad<T>(opts: {
  key: string[];
  tags: string[];
  loader: string;
  period?: string;
  fn: () => Promise<T>;
}): Promise<T> {
  const cacheKey = opts.key.join("|");
  const started = Date.now();
  let live = false;
  try {
    const value = await unstable_cache(
      async () => {
        live = true;
        return opts.fn();
      },
      opts.key,
      { revalidate: DASHBOARD_CACHE_SECONDS, tags: opts.tags },
    )();
    lastGood.set(cacheKey, value);
    const source: LoaderSource = live ? "live" : "cache";
    logLoader({
      loader: opts.loader,
      elapsed_ms: Date.now() - started,
      source,
      fallback_used: false,
      period: opts.period,
    });
    return value;
  } catch (error) {
    const stale = lastGood.get(cacheKey) as T | undefined;
    if (stale !== undefined) {
      logLoader({
        loader: opts.loader,
        elapsed_ms: Date.now() - started,
        source: "stale-fallback",
        fallback_used: true,
        period: opts.period,
        error,
      });
      return stale;
    }
    logLoader({
      loader: opts.loader,
      elapsed_ms: Date.now() - started,
      source: "live",
      fallback_used: false,
      period: opts.period,
      error,
    });
    throw error;
  }
}

export function periodCacheKey(period: {
  startMs: number;
  endMs: number;
  startDate: string;
  endDate: string;
}): string[] {
  return [
    String(period.startMs),
    String(period.endMs),
    period.startDate,
    period.endDate,
  ];
}
