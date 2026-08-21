export type PreparedShopifyState = "populated" | "empty" | "missing" | "unavailable";

export type PreparedServing = {
  shopify: boolean | null;
  shopifyState: PreparedShopifyState | null;
  meta: boolean | null;
};

/** Booleans only — never order counts, revenue, or customer PII. */
export function preparedFlags(input: {
  shopify: {
    available: boolean;
    tableExists: boolean | null;
    rowCount: number | null;
  };
  meta: {
    available: boolean;
    campaigns: number | null;
  };
}): PreparedServing {
  let shopify: boolean | null = null;
  let shopifyState: PreparedShopifyState | null = "unavailable";
  if (input.shopify.tableExists === false) {
    shopify = false;
    shopifyState = "missing";
  } else if (input.shopify.available && input.shopify.rowCount != null) {
    shopify = input.shopify.rowCount > 0;
    shopifyState = shopify ? "populated" : "empty";
  }

  let meta: boolean | null = null;
  if (input.meta.available && input.meta.campaigns != null) {
    meta = input.meta.campaigns > 0;
  }

  return { shopify, shopifyState, meta };
}
