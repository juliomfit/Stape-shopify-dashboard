import { getMetaFactTableCounts } from "@/lib/ads/meta-fact-counts";
import { isPlatformBqReady } from "@/lib/platform/bq";
import { preparedFlags, type PreparedServing } from "@/lib/platform/prepared-serving";
import { summarizeShopifyWarehouse } from "@/lib/shopify/warehouse";

const PREPARED_TIMEOUT_MS = 4_000;

async function loadPreparedServing(): Promise<PreparedServing> {
  if (!isPlatformBqReady()) {
    return { shopify: null, shopifyState: "unavailable", meta: null };
  }
  try {
    const [shopify, meta] = await Promise.all([
      summarizeShopifyWarehouse(),
      getMetaFactTableCounts(),
    ]);
    return preparedFlags({
      shopify,
      meta: { available: meta.available, campaigns: meta.campaigns },
    });
  } catch {
    return { shopify: null, shopifyState: "unavailable", meta: null };
  }
}

function withTimeout(
  promise: Promise<PreparedServing>,
  ms: number,
): Promise<PreparedServing> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ shopify: null, shopifyState: "unavailable", meta: null }), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve({ shopify: null, shopifyState: "unavailable", meta: null });
      },
    );
  });
}

/** Public census for /api/build. Booleans only; fails open. */
export async function getPreparedServing(): Promise<PreparedServing> {
  return withTimeout(loadPreparedServing(), PREPARED_TIMEOUT_MS);
}
