import type { OurCampaignRow } from "./campaign-map.ts";

export type MetricFormat =
  | "currency"
  | "integer"
  | "decimal"
  | "percent"
  | "roas"
  | "duration"
  | "ranking"
  | "text"
  | "mapping"
  | "identity"
  | "orders";

export type PickerCategory =
  | "Performance"
  | "Delivery"
  | "Traffic"
  | "Funnel"
  | "Conversions"
  | "Revenue"
  | "Video"
  | "Engagement"
  | "Quality"
  | "GoodsNova Attribution"
  | "All Meta Metrics";

export type TableGroupId = "identity" | "platform" | "ours" | "diagnostics";

export type MetaMetricDefinition = {
  id: string;
  sourceField: keyof OurCampaignRow | `ext:${string}`;
  label: string;
  category: PickerCategory;
  group: TableGroupId;
  groupLabel: string;
  format: MetricFormat;
  sortable: boolean;
  derived?: boolean;
  description?: string;
  defaultOn?: boolean;
  sticky?: boolean;
  numeric: boolean;
  platform: boolean;
};

function platformCol(
  id: string,
  label: string,
  category: PickerCategory,
  format: MetricFormat,
  extra: Partial<MetaMetricDefinition> = {},
): MetaMetricDefinition {
  return {
    id,
    sourceField: (extra.sourceField as MetaMetricDefinition["sourceField"]) || (id as keyof OurCampaignRow),
    label,
    category,
    group: "platform",
    groupLabel: "META PLATFORM",
    format,
    sortable: extra.sortable ?? (format !== "ranking" && format !== "text"),
    numeric: extra.numeric ?? (format !== "ranking" && format !== "text"),
    platform: true,
    ...extra,
  };
}

function oursCol(
  id: string,
  label: string,
  format: MetricFormat,
  extra: Partial<MetaMetricDefinition> = {},
): MetaMetricDefinition {
  return {
    id,
    sourceField: id as keyof OurCampaignRow,
    label,
    category: "GoodsNova Attribution",
    group: "ours",
    groupLabel: "GOODSNOVA ATTRIBUTION",
    format,
    sortable: true,
    numeric: format !== "text",
    platform: false,
    ...extra,
  };
}

export const META_METRIC_DEFINITIONS: MetaMetricDefinition[] = [
  {
    id: "campaign",
    sourceField: "campaignName",
    label: "Campaign",
    category: "Performance",
    group: "identity",
    groupLabel: "Identity",
    format: "identity",
    sortable: true,
    numeric: false,
    platform: false,
    sticky: true,
    defaultOn: true,
  },
  platformCol("spend", "Spend", "Performance", "currency", { defaultOn: true, category: "Performance" }),
  platformCol("impressions", "Impressions", "Delivery", "integer", { defaultOn: true }),
  platformCol("reach", "Reach", "Delivery", "integer"),
  platformCol("frequency", "Frequency", "Delivery", "decimal"),
  platformCol("cpm", "CPM", "Delivery", "currency", { defaultOn: true, derived: true }),
  platformCol("clicks", "Clicks", "Traffic", "integer"),
  platformCol("linkClicks", "Link Clicks", "Traffic", "integer", { defaultOn: true }),
  platformCol("uniqueClicks", "Unique Clicks", "Traffic", "integer"),
  platformCol("outboundClicks", "Outbound Clicks", "Traffic", "integer"),
  platformCol("ctr", "CTR", "Traffic", "percent", { defaultOn: true, derived: true }),
  platformCol("uniqueCtr", "Unique CTR", "Traffic", "percent"),
  platformCol("cpc", "CPC", "Traffic", "currency", { defaultOn: true, derived: true }),
  platformCol("landingPageViews", "Landing Page Views", "Funnel", "integer", { defaultOn: true }),
  platformCol("costLpv", "Cost / LPV", "Funnel", "currency", { derived: true }),
  platformCol("addToCart", "Add to Cart", "Funnel", "integer", { defaultOn: true }),
  platformCol("costAtc", "Cost / ATC", "Funnel", "currency", { defaultOn: true, derived: true }),
  platformCol("initiateCheckout", "Initiate Checkout", "Funnel", "integer", { defaultOn: true }),
  platformCol("costCheckout", "Cost / Checkout", "Funnel", "currency", { defaultOn: true, derived: true }),
  platformCol("purchases", "Purchases", "Funnel", "integer", {
    sourceField: "metaPurchases",
    defaultOn: true,
  }),
  platformCol("cpa", "CPA", "Funnel", "currency", {
    sourceField: "metaCpa",
    defaultOn: true,
    derived: true,
  }),
  platformCol("conversions", "Conversions", "Conversions", "integer", {
    description: "Platform conversions — not Meta Purchases",
  }),
  platformCol("metaRevenue", "Meta Revenue", "Revenue", "currency", { defaultOn: true }),
  platformCol("metaRoas", "Meta ROAS", "Revenue", "roas", { defaultOn: true, derived: true }),
  platformCol("videoP25", "Video 25%", "Video", "integer"),
  platformCol("videoP50", "Video 50%", "Video", "integer"),
  platformCol("videoP75", "Video 75%", "Video", "integer"),
  platformCol("videoP95", "Video 95%", "Video", "integer"),
  platformCol("videoP100", "Video 100%", "Video", "integer"),
  platformCol("video30s", "30-sec views", "Video", "integer"),
  platformCol("videoAvgTime", "Average watch time", "Video", "duration"),
  platformCol("postEngagement", "Post engagement", "Engagement", "integer"),
  platformCol("pageEngagement", "Page engagement", "Engagement", "integer"),
  platformCol("postReactions", "Post reactions", "Engagement", "integer"),
  platformCol("messagingConversations", "Messaging conversations started", "Engagement", "integer"),
  platformCol("qualityRanking", "Quality ranking", "Quality", "ranking", { sortable: true, numeric: false }),
  platformCol("engagementRateRanking", "Engagement rate ranking", "Quality", "ranking", {
    sortable: true,
    numeric: false,
  }),
  platformCol("conversionRateRanking", "Conversion rate ranking", "Quality", "ranking", {
    sortable: true,
    numeric: false,
  }),
  oursCol("ourRevenue", "OUR Revenue", "currency", { defaultOn: true }),
  oursCol("ourOrders", "OUR Attributed Orders", "orders", { defaultOn: true }),
  oursCol("ourRoas", "OUR ROAS", "roas", { defaultOn: true, derived: true }),
  oursCol("newCustomerRevenue", "New Customer Revenue", "currency"),
  oursCol("newCustomerCredit", "New Customer Credit", "orders"),
  oursCol("attributedNcac", "Attributed nCAC", "currency"),
  {
    id: "mapping",
    sourceField: "mappingMethod",
    label: "Mapping",
    category: "GoodsNova Attribution",
    group: "diagnostics",
    groupLabel: "Diagnostics",
    format: "mapping",
    sortable: true,
    numeric: false,
    platform: false,
    defaultOn: true,
  },
];

export const PICKER_CATEGORIES: PickerCategory[] = [
  "Performance",
  "Delivery",
  "Traffic",
  "Funnel",
  "Conversions",
  "Revenue",
  "Video",
  "Engagement",
  "Quality",
  "GoodsNova Attribution",
  "All Meta Metrics",
];

export function metricDefinitionById(id: string) {
  return META_METRIC_DEFINITIONS.find((item) => item.id === id);
}

export function searchMetricDefinitions(query: string, definitions = META_METRIC_DEFINITIONS) {
  const needle = query.trim().toLowerCase();
  if (!needle) return definitions;
  return definitions.filter(
    (item) =>
      item.label.toLowerCase().includes(needle) ||
      item.id.toLowerCase().includes(needle) ||
      item.category.toLowerCase().includes(needle) ||
      (item.description || "").toLowerCase().includes(needle),
  );
}

export function definitionsForCategory(category: PickerCategory) {
  if (category === "All Meta Metrics") {
    return META_METRIC_DEFINITIONS.filter((item) => item.platform);
  }
  if (category === "Performance") {
    return META_METRIC_DEFINITIONS.filter((item) => item.defaultOn || item.category === "Performance");
  }
  return META_METRIC_DEFINITIONS.filter((item) => item.category === category);
}

const RANK_ORDER: Record<string, number> = {
  ABOVE_AVERAGE: 3,
  AVERAGE: 2,
  BELOW_AVERAGE: 1,
};

export function rankingSortValue(value: string | null | undefined) {
  if (!value) return null;
  return RANK_ORDER[value.toUpperCase()] ?? value;
}

export function campaignMetricValue(
  row: OurCampaignRow,
  id: string,
): number | string | null {
  switch (id) {
    case "campaign":
      return row.campaignName;
    case "spend":
      return row.platformPresent ? row.spend : null;
    case "impressions":
      return row.platformPresent ? row.impressions : null;
    case "reach":
      return row.platformPresent ? row.reach : null;
    case "frequency":
      return row.platformPresent ? row.frequency : null;
    case "clicks":
      return row.platformPresent ? row.clicks : null;
    case "linkClicks":
      return row.platformPresent ? row.linkClicks : null;
    case "uniqueClicks":
      return row.platformPresent ? row.uniqueClicks ?? null : null;
    case "uniqueCtr":
      return row.uniqueCtr ?? null;
    case "outboundClicks":
      return row.platformPresent ? row.outboundClicks ?? null : null;
    case "ctr":
      return row.ctr;
    case "cpc":
      return row.cpc;
    case "cpm":
      return row.cpm;
    case "landingPageViews":
      return row.platformPresent ? row.landingPageViews ?? null : null;
    case "costLpv":
      return row.costLpv ?? null;
    case "addToCart":
      return row.platformPresent ? row.addToCart ?? null : null;
    case "costAtc":
      return row.costAtc ?? null;
    case "initiateCheckout":
      return row.platformPresent ? row.initiateCheckout ?? null : null;
    case "costCheckout":
      return row.costCheckout ?? null;
    case "purchases":
      return row.platformPresent ? row.metaPurchases : null;
    case "cpa":
      return row.metaCpa;
    case "conversions":
      return row.platformPresent ? row.conversions ?? null : null;
    case "metaRevenue":
      return row.platformPresent ? row.metaRevenue : null;
    case "metaRoas":
      return row.metaRoas;
    case "videoP25":
      return row.platformPresent ? row.videoP25 ?? null : null;
    case "videoP50":
      return row.platformPresent ? row.videoP50 ?? null : null;
    case "videoP75":
      return row.platformPresent ? row.videoP75 ?? null : null;
    case "videoP95":
      return row.platformPresent ? row.videoP95 ?? null : null;
    case "videoP100":
      return row.platformPresent ? row.videoP100 ?? null : null;
    case "video30s":
      return row.platformPresent ? row.video30s ?? null : null;
    case "videoAvgTime":
      return row.platformPresent ? row.videoAvgTime ?? null : null;
    case "postEngagement":
      return row.platformPresent ? row.postEngagement ?? null : null;
    case "pageEngagement":
      return row.platformPresent ? row.pageEngagement ?? null : null;
    case "postReactions":
      return row.platformPresent ? row.postReactions ?? null : null;
    case "messagingConversations":
      return row.platformPresent ? row.messagingConversations ?? null : null;
    case "qualityRanking":
      return row.qualityRanking ?? null;
    case "engagementRateRanking":
      return row.engagementRateRanking ?? null;
    case "conversionRateRanking":
      return row.conversionRateRanking ?? null;
    case "ourRevenue":
      return row.ourRevenue;
    case "ourOrders":
      return row.ourOrders;
    case "ourRoas":
      return row.ourRoas;
    case "newCustomerCredit":
      return row.newCustomerCredit;
    case "newCustomerRevenue":
      return row.newCustomerRevenue;
    case "attributedNcac":
      return row.attributedNcac;
    default:
      if (id.startsWith("ext:")) {
        const key = id.slice(4);
        const value = row.extendedMetrics?.[key];
        return value ?? null;
      }
      return null;
  }
}
