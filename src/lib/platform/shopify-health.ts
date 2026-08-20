import type { ShopifyReadSource } from "../shopify/types.ts";

export function shopifyHealthMessage(input: {
  configured: boolean;
  readSource?: ShopifyReadSource;
}): string {
  if (!input.configured) {
    return "SHOPIFY_STORE_DOMAIN / CLIENT_ID / CLIENT_SECRET missing.";
  }
  if (input.readSource === "warehouse") {
    return "Prepared warehouse (analytics.fct_shopify_orders). Admin API is fallback only.";
  }
  if (input.readSource === "admin") {
    return "Serving live Admin API because warehouse facts are not ready for this range.";
  }
  return "Prepared warehouse when fct_shopify_orders has rows for the range; otherwise Admin API fallback.";
}

export function shopifyHealthStatus(input: {
  configured: boolean;
  syncing: boolean;
  readSource?: ShopifyReadSource;
  errorMessage?: string | null;
}): "healthy" | "delayed" | "syncing" | "partial" | "error" | "disconnected" {
  if (!input.configured) return "disconnected";
  if (input.syncing) return "syncing";
  if (input.errorMessage) return "error";
  if (input.readSource === "admin") return "partial";
  return "healthy";
}
