const DEFAULT_API_VERSION = "2026-07";

export type ShopifyConfig = {
  shop: string;
  clientId: string;
  clientSecret: string;
  apiVersion: string;
};

export function normalizeShopDomain(value: string) {
  const trimmed = value.trim().toLowerCase().replace(/^https?:\/\//, "");
  const host = trimmed.split("/")[0] ?? "";

  if (host.endsWith(".myshopify.com")) {
    return host;
  }

  return `${host}.myshopify.com`;
}

export function getShopifyConfig(): ShopifyConfig | null {
  const shopValue = process.env.SHOPIFY_STORE_DOMAIN;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!shopValue || !clientId || !clientSecret) {
    return null;
  }

  return {
    shop: normalizeShopDomain(shopValue),
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
    apiVersion: process.env.SHOPIFY_API_VERSION?.trim() || DEFAULT_API_VERSION,
  };
}

export function isShopifyConfigured() {
  return getShopifyConfig() !== null;
}
