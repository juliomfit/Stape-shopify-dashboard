import { DASHBOARD_TZ, type DashboardPeriod } from "@/lib/period";
import { shopifyGraphql } from "@/lib/shopify/client";

export type ShopifyqlColumn = {
  name: string;
  dataType: string;
  displayName: string;
};

export type ShopifyqlResult = {
  rows: Record<string, unknown>[];
  columns: ShopifyqlColumn[];
  error: string | null;
};

type ShopifyqlResponse = {
  shopifyqlQuery: {
    parseErrors: string[];
    tableData: {
      columns: ShopifyqlColumn[];
      rows: Record<string, unknown>[];
    } | null;
  } | null;
};

export function shopifyqlDates(period: DashboardPeriod) {
  return `SINCE date('${period.startDate}') UNTIL date('${period.endDate}')`;
}

export function shopifyqlTimezone() {
  return `TIMEZONE '${DASHBOARD_TZ}'`;
}

export async function runShopifyql(query: string): Promise<ShopifyqlResult> {
  try {
    const data = await shopifyGraphql<ShopifyqlResponse>(
      `query RunShopifyql($query: String!) {
        shopifyqlQuery(query: $query) {
          parseErrors
          tableData {
            columns { name dataType displayName }
            rows
          }
        }
      }`,
      { query },
    );

    const payload = data.shopifyqlQuery;
    if (!payload) {
      return { rows: [], columns: [], error: "ShopifyQL returned no payload." };
    }
    if (payload.parseErrors?.length) {
      return {
        rows: [],
        columns: [],
        error: payload.parseErrors.join("; "),
      };
    }
    if (!payload.tableData) {
      return { rows: [], columns: [], error: "ShopifyQL returned no table." };
    }

    return {
      rows: payload.tableData.rows || [],
      columns: payload.tableData.columns || [],
      error: null,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ShopifyQL request failed.";
    return { rows: [], columns: [], error: message };
  }
}

export function shopifyqlNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function shopifyqlString(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

export const SHOPIFY_ATTRIBUTION_MODELS = [
  { key: "first_click", label: "First click", modifier: "FIRST_CLICK_ATTRIBUTION" },
  { key: "last_click", label: "Last click", modifier: "LAST_CLICK_ATTRIBUTION" },
  {
    key: "last_non_direct",
    label: "Last non-direct click",
    modifier: "LAST_NON_DIRECT_CLICK_ATTRIBUTION",
  },
  { key: "linear", label: "Linear", modifier: "LINEAR_ATTRIBUTION" },
  { key: "any_click", label: "Any click", modifier: "ANY_CLICK_ATTRIBUTION" },
] as const;

export type ShopifyAttributionModel =
  (typeof SHOPIFY_ATTRIBUTION_MODELS)[number]["key"];

export function isShopifyAttributionModel(
  value: string,
): value is ShopifyAttributionModel {
  return SHOPIFY_ATTRIBUTION_MODELS.some((item) => item.key === value);
}

export function attributionSuffix(model: ShopifyAttributionModel) {
  switch (model) {
    case "first_click":
      return "first_click";
    case "last_click":
      return "last_click";
    case "last_non_direct":
      return "last_non_direct_click";
    case "linear":
      return "linear";
    case "any_click":
      return "any_click";
  }
}
