/**
 * Meta Ads performance-grid presentation.
 *
 * Does not recalculate attribution or redistribute spend. Campaign platform
 * metrics come from existing Flyweel campaign facts. Ad set / ad grains are
 * first-party observed IDs only — platform spend/ROAS stay unavailable.
 */

import {
  attributedNcac,
  cpc,
  cpm,
  ctr,
  platformCpa,
  platformRoas,
  ratio,
} from "../metrics/formulas.ts";
import {
  campaignMappingBadge,
  displayCampaignName,
  type OurCampaignRow,
} from "./campaign-map.ts";
import type {
  ObservedMetaAdRollup,
  ObservedMetaAdsetRollup,
} from "./observed-meta-grain.ts";
import {
  META_METRIC_DEFINITIONS,
  campaignMetricValue,
  rankingSortValue,
  searchMetricDefinitions,
  type MetaMetricDefinition,
  type PickerCategory,
  type TableGroupId,
} from "./meta-metric-defs.ts";

export const META_GRID_STORAGE_KEY = "goodsnova.meta.performance.columns.v2";
export const FLYWEEL_CAMPAIGN_ONLY_TOOLTIP =
  "Flyweel provides campaign-level reporting only.";

export type MetaGrain = "campaigns" | "adsets" | "ads";
export type ColumnGroupId = TableGroupId;
export type CampaignColumnId = string;

export type AdsetColumnId =
  | "adset"
  | "campaign"
  | "ourRevenue"
  | "ourOrders"
  | "newCustomerRevenue"
  | "newCustomerCredit"
  | "shareOfCampaign"
  | "ads"
  | "source";

export type AdColumnId =
  | "ad"
  | "adset"
  | "campaign"
  | "ourRevenue"
  | "ourOrders"
  | "newCustomerRevenue"
  | "newCustomerCredit"
  | "shareOfAdset"
  | "ordersTouched"
  | "source";

export type ChartMetricId =
  | "spend"
  | "metaRevenue"
  | "metaRoas"
  | "purchases"
  | "cpa"
  | "ourRevenue"
  | "ourRoas"
  | "attributedOrders"
  | "newCustomerRevenue"
  | "newCustomerCredit";

export type ColumnDef<Id extends string> = {
  id: Id;
  label: string;
  group: ColumnGroupId;
  groupLabel: string;
  numeric: boolean;
  sticky?: boolean;
  defaultOn?: boolean;
  category?: PickerCategory;
  format?: MetaMetricDefinition["format"];
  sortable?: boolean;
  platform?: boolean;
};

export const COLUMN_GROUPS: { id: ColumnGroupId; label: string }[] = [
  { id: "identity", label: "Identity" },
  { id: "platform", label: "META PLATFORM" },
  { id: "ours", label: "GOODSNOVA ATTRIBUTION" },
  { id: "diagnostics", label: "Diagnostics" },
];

export const CAMPAIGN_COLUMNS: ColumnDef<CampaignColumnId>[] = META_METRIC_DEFINITIONS.map((item) => ({
  id: item.id,
  label: item.label,
  group: item.group,
  groupLabel: item.groupLabel,
  numeric: item.numeric,
  sticky: item.sticky,
  defaultOn: item.defaultOn,
  category: item.category,
  format: item.format,
  sortable: item.sortable,
  platform: item.platform,
}));

export const ADSET_COLUMNS: ColumnDef<AdsetColumnId>[] = [
  { id: "adset", label: "Ad Set", group: "identity", groupLabel: "Identity", numeric: false, sticky: true, defaultOn: true },
  { id: "campaign", label: "Campaign", group: "identity", groupLabel: "Identity", numeric: false, defaultOn: true },
  { id: "ourRevenue", label: "OUR revenue", group: "ours", groupLabel: "GoodsNova attribution", numeric: true, defaultOn: true },
  { id: "ourOrders", label: "Attributed orders", group: "ours", groupLabel: "GoodsNova attribution", numeric: true, defaultOn: true },
  { id: "newCustomerRevenue", label: "New customer revenue", group: "ours", groupLabel: "GoodsNova attribution", numeric: true, defaultOn: true },
  { id: "newCustomerCredit", label: "New customer credit", group: "ours", groupLabel: "GoodsNova attribution", numeric: true, defaultOn: true },
  { id: "shareOfCampaign", label: "Share of campaign", group: "ours", groupLabel: "GoodsNova attribution", numeric: true, defaultOn: true },
  { id: "ads", label: "Ads", group: "ours", groupLabel: "GoodsNova attribution", numeric: true, defaultOn: true },
  { id: "source", label: "Source", group: "diagnostics", groupLabel: "Diagnostics", numeric: false, defaultOn: true },
];

export const AD_COLUMNS: ColumnDef<AdColumnId>[] = [
  { id: "ad", label: "Ad / Creative content", group: "identity", groupLabel: "Identity", numeric: false, sticky: true, defaultOn: true },
  { id: "adset", label: "Ad Set", group: "identity", groupLabel: "Identity", numeric: false, defaultOn: true },
  { id: "campaign", label: "Campaign", group: "identity", groupLabel: "Identity", numeric: false, defaultOn: true },
  { id: "ourRevenue", label: "OUR revenue", group: "ours", groupLabel: "GoodsNova attribution", numeric: true, defaultOn: true },
  { id: "ourOrders", label: "Attributed orders", group: "ours", groupLabel: "GoodsNova attribution", numeric: true, defaultOn: true },
  { id: "newCustomerRevenue", label: "New customer revenue", group: "ours", groupLabel: "GoodsNova attribution", numeric: true, defaultOn: true },
  { id: "newCustomerCredit", label: "New customer credit", group: "ours", groupLabel: "GoodsNova attribution", numeric: true, defaultOn: true },
  { id: "shareOfAdset", label: "Share of ad set", group: "ours", groupLabel: "GoodsNova attribution", numeric: true, defaultOn: true },
  { id: "ordersTouched", label: "Orders touched", group: "ours", groupLabel: "GoodsNova attribution", numeric: true, defaultOn: true },
  { id: "source", label: "Source", group: "diagnostics", groupLabel: "Diagnostics", numeric: false, defaultOn: true },
];

export const CHILD_UNSUPPORTED_PLATFORM_METRICS = CAMPAIGN_COLUMNS.filter(
  (column) => column.platform,
).map((column) => column.id);

export const CAMPAIGN_CHART_METRICS: { id: ChartMetricId; label: string }[] = [
  { id: "spend", label: "Spend" },
  { id: "metaRevenue", label: "Meta revenue" },
  { id: "metaRoas", label: "Meta ROAS" },
  { id: "purchases", label: "Purchases" },
  { id: "cpa", label: "CPA" },
  { id: "ourRevenue", label: "OUR revenue" },
  { id: "ourRoas", label: "OUR ROAS" },
  { id: "attributedOrders", label: "Attributed orders" },
];

export const CHILD_CHART_METRICS: { id: ChartMetricId; label: string }[] = [
  { id: "ourRevenue", label: "OUR revenue" },
  { id: "attributedOrders", label: "Attributed orders" },
  { id: "newCustomerRevenue", label: "New customer revenue" },
  { id: "newCustomerCredit", label: "New customer credit" },
];

export const PLATFORM_CHART_METRICS: readonly ChartMetricId[] = [
  "spend",
  "metaRevenue",
  "metaRoas",
  "purchases",
  "cpa",
];

export const OUR_CHART_METRICS: readonly ChartMetricId[] = [
  "ourRevenue",
  "ourRoas",
  "attributedOrders",
  "newCustomerRevenue",
  "newCustomerCredit",
];

export const PLATFORM_CHART_SOURCE = "Meta platform · Flyweel · campaign level";
export const PLATFORM_CHART_DESCRIPTION = "Reported by platform date.";
export const OUR_CHART_SOURCE = "GoodsNova first-party attribution";
export const OUR_CHART_DESCRIPTION =
  "Existing attribution credit grouped by order purchase day in America/Los_Angeles.";
export const MISSING_CAMPAIGN_PLATFORM_SERIES =
  "No platform series available for this campaign";

export type PlatformDailySeries = {
  spend: number[];
  purchase_value: number[];
  purchases: number[];
  roas: number[];
  cpa: number[];
  cpm: number[];
  ctr: number[];
  cpc: number[];
  frequency: number[];
};

export function isPlatformChartMetric(id: ChartMetricId) {
  return (PLATFORM_CHART_METRICS as readonly string[]).includes(id);
}

export function chartMetricCopy(id: ChartMetricId) {
  if (isPlatformChartMetric(id)) {
    return {
      source: PLATFORM_CHART_SOURCE,
      description: PLATFORM_CHART_DESCRIPTION,
    };
  }
  return {
    source: OUR_CHART_SOURCE,
    description: OUR_CHART_DESCRIPTION,
  };
}

/**
 * Account-wide platformDaily is only for "All campaigns".
 * A selected campaign with no own series is unavailable — never the account totals.
 */
export function resolvePlatformDailySeries(args: {
  entityKey: string;
  allCampaignsKey: string;
  platformDaily: PlatformDailySeries;
  platformDailyByCampaign: Record<string, PlatformDailySeries | undefined>;
}): PlatformDailySeries | null {
  if (!args.entityKey || args.entityKey === args.allCampaignsKey) {
    return args.platformDaily;
  }
  if (!Object.prototype.hasOwnProperty.call(args.platformDailyByCampaign, args.entityKey)) {
    return null;
  }
  return args.platformDailyByCampaign[args.entityKey] ?? null;
}

export type ColumnPreset =
  | "performance"
  | "funnel"
  | "creative"
  | "delivery"
  | "conversion"
  | "attribution"
  | "all";

export const COLUMN_PRESETS: Record<ColumnPreset, CampaignColumnId[]> = {
  performance: [
    "campaign",
    "spend",
    "impressions",
    "cpm",
    "linkClicks",
    "ctr",
    "cpc",
    "landingPageViews",
    "addToCart",
    "costAtc",
    "initiateCheckout",
    "costCheckout",
    "purchases",
    "cpa",
    "metaRevenue",
    "metaRoas",
    "ourRevenue",
    "ourOrders",
    "ourRoas",
    "mapping",
  ],
  funnel: [
    "campaign",
    "spend",
    "linkClicks",
    "landingPageViews",
    "costLpv",
    "addToCart",
    "costAtc",
    "initiateCheckout",
    "costCheckout",
    "purchases",
    "cpa",
    "metaRevenue",
    "metaRoas",
  ],
  creative: [
    "campaign",
    "spend",
    "impressions",
    "cpm",
    "videoP25",
    "videoP50",
    "videoP75",
    "videoP95",
    "videoP100",
    "video30s",
    "videoAvgTime",
    "ctr",
    "cpc",
    "purchases",
    "cpa",
    "metaRoas",
  ],
  delivery: ["campaign", "spend", "impressions", "reach", "frequency", "mapping"],
  conversion: ["campaign", "spend", "purchases", "cpa", "metaRevenue", "metaRoas", "mapping"],
  attribution: [
    "campaign",
    "spend",
    "ourRevenue",
    "ourOrders",
    "ourRoas",
    "newCustomerCredit",
    "newCustomerRevenue",
    "attributedNcac",
    "mapping",
  ],
  all: CAMPAIGN_COLUMNS.map((column) => column.id),
};

export const DEFAULT_CAMPAIGN_COLUMNS = COLUMN_PRESETS.performance;

export type MappingFilter = "all" | "exact_id" | "name_match" | "needs_mapping";

export function chartMetricsForGrain(grain: MetaGrain) {
  return grain === "campaigns" ? CAMPAIGN_CHART_METRICS : CHILD_CHART_METRICS;
}

export function isChildPlatformMetric(id: string) {
  return (CHILD_UNSUPPORTED_PLATFORM_METRICS as readonly string[]).includes(id);
}

export function campaignHref(row: OurCampaignRow) {
  if (row.campaignId) return `/meta/${encodeURIComponent(row.campaignId)}`;
  return `/meta/our/campaign/${encodeURIComponent(row.campaignName)}`;
}

export function adsetHref(adsetId: string) {
  return `/meta/our/adset/${encodeURIComponent(adsetId)}`;
}

export function adHref(adId: string) {
  return `/meta/our/ad/${encodeURIComponent(adId)}`;
}

export function searchCampaignRows(rows: OurCampaignRow[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => displayCampaignName(row.campaignName).toLowerCase().includes(needle));
}

export function searchText(value: string, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return displayCampaignName(value).toLowerCase().includes(needle);
}

export function filterCampaignsByMapping(rows: OurCampaignRow[], filter: MappingFilter) {
  if (filter === "all") return rows;
  if (filter === "exact_id") {
    return rows.filter((row) => row.mappingMethod === "campaign_id_exact");
  }
  if (filter === "name_match") {
    return rows.filter((row) => row.mappingMethod === "campaign_name_exact_unique");
  }
  return rows.filter(
    (row) =>
      row.mappingMethod === "unmapped" || row.mappingMethod === "ambiguous_name",
  );
}

export type SortDir = "asc" | "desc";

function cmp(a: number | string | null | undefined, b: number | string | null | undefined) {
  const emptyA = a == null || a === "";
  const emptyB = b == null || b === "";
  if (emptyA && emptyB) return 0;
  if (emptyA) return 1;
  if (emptyB) return -1;
  if (typeof a === "string" || typeof b === "string") {
    return String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
  }
  return a === b ? 0 : a < b ? -1 : 1;
}

export function campaignSortValue(row: OurCampaignRow, column: CampaignColumnId): number | string | null {
  if (column === "mapping") {
    return campaignMappingBadge(row).label;
  }
  const def = CAMPAIGN_COLUMNS.find((item) => item.id === column);
  const value = campaignMetricValue(row, column);
  if (def?.format === "ranking" && typeof value === "string") {
    return rankingSortValue(value);
  }
  return value;
}

export function sortCampaignRows(
  rows: OurCampaignRow[],
  column: CampaignColumnId,
  dir: SortDir,
) {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => sign * cmp(campaignSortValue(a, column), campaignSortValue(b, column)));
}

export function sortAdsetRows(
  rows: ObservedMetaAdsetRollup[],
  column: AdsetColumnId,
  dir: SortDir,
) {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av =
      column === "adset"
        ? a.adsetLabel
        : column === "campaign"
          ? a.campaignLabel
          : column === "ourRevenue"
            ? a.attributedRevenue
            : column === "ourOrders"
              ? a.attributedOrders
              : column === "newCustomerRevenue"
                ? a.newCustomerRevenue
                : column === "newCustomerCredit"
                  ? a.newCustomerCredit
                  : column === "shareOfCampaign"
                    ? a.shareOfParentRevenue
                    : column === "ads"
                      ? a.numberOfAds
                      : a.source;
    const bv =
      column === "adset"
        ? b.adsetLabel
        : column === "campaign"
          ? b.campaignLabel
          : column === "ourRevenue"
            ? b.attributedRevenue
            : column === "ourOrders"
              ? b.attributedOrders
              : column === "newCustomerRevenue"
                ? b.newCustomerRevenue
                : column === "newCustomerCredit"
                  ? b.newCustomerCredit
                  : column === "shareOfCampaign"
                    ? b.shareOfParentRevenue
                    : column === "ads"
                      ? b.numberOfAds
                      : b.source;
    return sign * cmp(av, bv);
  });
}

export function sortAdRows(rows: ObservedMetaAdRollup[], column: AdColumnId, dir: SortDir) {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const value = (row: ObservedMetaAdRollup) => {
      switch (column) {
        case "ad":
          return row.adLabel;
        case "adset":
          return row.parentAdsetId || "";
        case "campaign":
          return row.parentCampaignId || "";
        case "ourRevenue":
          return row.attributedRevenue;
        case "ourOrders":
          return row.attributedOrders;
        case "newCustomerRevenue":
          return row.newCustomerRevenue;
        case "newCustomerCredit":
          return row.newCustomerCredit;
        case "shareOfAdset":
          return row.shareOfAdsetRevenue;
        case "ordersTouched":
          return row.numberOfOrders;
        case "source":
          return row.source;
        default:
          return 0;
      }
    };
    return sign * cmp(value(a), value(b));
  });
}

export type CampaignTotals = {
  spend: number;
  impressions: number;
  /** Account unique reach is not available from summed campaign rows. */
  reach: number | null;
  /** Frequency from summed reach is not a true account frequency. */
  frequency: number | null;
  clicks: number;
  linkClicks: number;
  uniqueClicks: number | null;
  uniqueCtr: number | null;
  outboundClicks: number | null;
  landingPageViews: number | null;
  addToCart: number | null;
  initiateCheckout: number | null;
  conversions: number | null;
  costLpv: number | null;
  costAtc: number | null;
  costCheckout: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  purchases: number | null;
  cpa: number | null;
  metaRevenue: number | null;
  metaRoas: number | null;
  videoP25: number | null;
  videoP50: number | null;
  videoP75: number | null;
  videoP95: number | null;
  videoP100: number | null;
  video30s: number | null;
  videoAvgTime: number | null;
  postEngagement: number | null;
  pageEngagement: number | null;
  postReactions: number | null;
  messagingConversations: number | null;
  qualityRanking: string | null;
  engagementRateRanking: string | null;
  conversionRateRanking: string | null;
  ourRevenue: number;
  ourOrders: number;
  ourRoas: number | null;
  newCustomerCredit: number;
  newCustomerRevenue: number;
  attributedNcac: number | null;
};

function sumNullable(rows: OurCampaignRow[], read: (row: OurCampaignRow) => number | null | undefined) {
  let saw = false;
  let sum = 0;
  for (const row of rows) {
    const value = read(row);
    if (value == null) continue;
    saw = true;
    sum += value;
  }
  return saw ? sum : null;
}

export function totalCampaignPerformance(rows: OurCampaignRow[]): CampaignTotals {
  const platform = rows.filter((row) => row.platformPresent);
  const spend = platform.reduce((sum, row) => sum + row.spend, 0);
  const impressions = platform.reduce((sum, row) => sum + row.impressions, 0);
  const clicks = platform.reduce((sum, row) => sum + row.clicks, 0);
  const linkClicks = platform.reduce((sum, row) => sum + row.linkClicks, 0);
  const landingPageViews = sumNullable(platform, (row) => row.landingPageViews);
  const addToCart = sumNullable(platform, (row) => row.addToCart);
  const initiateCheckout = sumNullable(platform, (row) => row.initiateCheckout);
  const purchases = sumNullable(platform, (row) => row.metaPurchases);
  const metaRevenue = sumNullable(platform, (row) => row.metaRevenue);
  const conversions = sumNullable(platform, (row) => row.conversions);
  const ourRevenue = rows.reduce((sum, row) => sum + row.ourRevenue, 0);
  const ourOrders = rows.reduce((sum, row) => sum + row.ourOrders, 0);
  const newCustomerCredit = rows.reduce((sum, row) => sum + row.newCustomerCredit, 0);
  const newCustomerRevenue = rows.reduce((sum, row) => sum + row.newCustomerRevenue, 0);
  return {
    spend,
    impressions,
    reach: null,
    frequency: null,
    clicks,
    linkClicks,
    uniqueClicks: sumNullable(platform, (row) => row.uniqueClicks),
    uniqueCtr: null,
    outboundClicks: sumNullable(platform, (row) => row.outboundClicks),
    landingPageViews,
    addToCart,
    initiateCheckout,
    conversions,
    costLpv: platformCpa(spend, landingPageViews),
    costAtc: platformCpa(spend, addToCart),
    costCheckout: platformCpa(spend, initiateCheckout),
    ctr: ctr(clicks, impressions),
    cpc: cpc(spend, clicks),
    cpm: cpm(spend, impressions),
    purchases,
    cpa: platformCpa(spend, purchases),
    metaRevenue,
    metaRoas: metaRevenue == null ? null : platformRoas(metaRevenue, spend),
    videoP25: sumNullable(platform, (row) => row.videoP25),
    videoP50: sumNullable(platform, (row) => row.videoP50),
    videoP75: sumNullable(platform, (row) => row.videoP75),
    videoP95: sumNullable(platform, (row) => row.videoP95),
    videoP100: sumNullable(platform, (row) => row.videoP100),
    video30s: sumNullable(platform, (row) => row.video30s),
    videoAvgTime: null,
    postEngagement: sumNullable(platform, (row) => row.postEngagement),
    pageEngagement: sumNullable(platform, (row) => row.pageEngagement),
    postReactions: sumNullable(platform, (row) => row.postReactions),
    messagingConversations: sumNullable(platform, (row) => row.messagingConversations),
    qualityRanking: null,
    engagementRateRanking: null,
    conversionRateRanking: null,
    ourRevenue,
    ourOrders,
    ourRoas: ratio(ourRevenue, spend),
    newCustomerCredit,
    newCustomerRevenue,
    attributedNcac: attributedNcac(spend, newCustomerCredit),
  };
}

export function visibleCampaignColumns(selected: CampaignColumnId[]) {
  const allowed = new Set(selected);
  const ids = CAMPAIGN_COLUMNS.map((column) => column.id).filter(
    (id) => id === "campaign" || allowed.has(id),
  );
  if (!ids.includes("campaign")) ids.unshift("campaign");
  return CAMPAIGN_COLUMNS.filter((column) => ids.includes(column.id));
}

export function groupedHeader(columns: ColumnDef<string>[]) {
  const groups: { id: ColumnGroupId; label: string; span: number }[] = [];
  for (const column of columns) {
    const last = groups[groups.length - 1];
    if (last && last.id === column.group) {
      last.span += 1;
    } else {
      groups.push({ id: column.group, label: column.groupLabel, span: 1 });
    }
  }
  return groups;
}

export function parseStoredColumns(raw: string | null): CampaignColumnId[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const allowed = new Set(CAMPAIGN_COLUMNS.map((column) => column.id));
    const ids = parsed.filter((id): id is CampaignColumnId => typeof id === "string" && allowed.has(id as CampaignColumnId));
    return ids.length ? ids : null;
  } catch {
    return null;
  }
}

export function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function formatMoneyCell(
  amount: number | null | undefined,
  available: boolean,
  currencyCode: string,
) {
  if (!available || amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCountCell(value: number | null | undefined, available = true) {
  if (!available || value == null) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

export function formatOrdersCell(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatPercentCell(value: number | null | undefined) {
  if (value == null) return "—";
  return `${(value * 100).toFixed(2)}%`;
}

export function formatRoasCell(value: number | null | undefined) {
  if (value == null) return "—";
  return `${value.toFixed(2)}x`;
}

export function formatFrequencyCell(value: number | null | undefined, available = true) {
  if (!available || value == null) return "—";
  return value.toFixed(2);
}

export function formatDecimalCell(value: number | null | undefined, available = true) {
  if (!available || value == null) return "—";
  return value.toFixed(2);
}

export function formatDurationCell(value: number | null | undefined, available = true) {
  if (!available || value == null) return "—";
  return `${value.toFixed(1)}s`;
}

export function formatRankingCell(value: string | null | undefined) {
  if (!value) return "—";
  return value.replace(/_/g, " ");
}

export function formatCampaignMetricCell(
  row: OurCampaignRow,
  id: CampaignColumnId,
  currencyCode: string,
) {
  const def = CAMPAIGN_COLUMNS.find((column) => column.id === id);
  const value = campaignMetricValue(row, id);
  const available = !def?.platform || row.platformPresent;
  return formatMetricValue(def, value, available, currencyCode);
}

export function formatTotalsMetricCell(
  totals: CampaignTotals,
  id: CampaignColumnId,
  currencyCode: string,
) {
  const def = CAMPAIGN_COLUMNS.find((column) => column.id === id);
  const value = totalMetricValue(totals, id);
  const available = id !== "reach" && id !== "frequency" && def?.format !== "ranking";
  return formatMetricValue(def, value, available, currencyCode);
}

function totalMetricValue(totals: CampaignTotals, id: CampaignColumnId): number | string | null {
  switch (id) {
    case "spend":
      return totals.spend;
    case "impressions":
      return totals.impressions;
    case "reach":
      return totals.reach;
    case "frequency":
      return totals.frequency;
    case "clicks":
      return totals.clicks;
    case "linkClicks":
      return totals.linkClicks;
    case "uniqueClicks":
      return totals.uniqueClicks;
    case "uniqueCtr":
      return totals.uniqueCtr;
    case "outboundClicks":
      return totals.outboundClicks;
    case "ctr":
      return totals.ctr;
    case "cpc":
      return totals.cpc;
    case "cpm":
      return totals.cpm;
    case "landingPageViews":
      return totals.landingPageViews;
    case "costLpv":
      return totals.costLpv;
    case "addToCart":
      return totals.addToCart;
    case "costAtc":
      return totals.costAtc;
    case "initiateCheckout":
      return totals.initiateCheckout;
    case "costCheckout":
      return totals.costCheckout;
    case "purchases":
      return totals.purchases;
    case "cpa":
      return totals.cpa;
    case "conversions":
      return totals.conversions;
    case "metaRevenue":
      return totals.metaRevenue;
    case "metaRoas":
      return totals.metaRoas;
    case "videoP25":
      return totals.videoP25;
    case "videoP50":
      return totals.videoP50;
    case "videoP75":
      return totals.videoP75;
    case "videoP95":
      return totals.videoP95;
    case "videoP100":
      return totals.videoP100;
    case "video30s":
      return totals.video30s;
    case "videoAvgTime":
      return totals.videoAvgTime;
    case "postEngagement":
      return totals.postEngagement;
    case "pageEngagement":
      return totals.pageEngagement;
    case "postReactions":
      return totals.postReactions;
    case "messagingConversations":
      return totals.messagingConversations;
    case "qualityRanking":
    case "engagementRateRanking":
    case "conversionRateRanking":
      return null;
    case "ourRevenue":
      return totals.ourRevenue;
    case "ourOrders":
      return totals.ourOrders;
    case "ourRoas":
      return totals.ourRoas;
    case "newCustomerCredit":
      return totals.newCustomerCredit;
    case "newCustomerRevenue":
      return totals.newCustomerRevenue;
    case "attributedNcac":
      return totals.attributedNcac;
    default:
      return null;
  }
}

export function formatMetricValue(
  def: ColumnDef<string> | undefined,
  value: number | string | null,
  available: boolean,
  currencyCode: string,
) {
  const format = def?.format;
  if (format === "currency") {
    return formatMoneyCell(typeof value === "number" ? value : null, available && value != null, currencyCode);
  }
  if (format === "percent") {
    return formatPercentCell(typeof value === "number" ? value : null);
  }
  if (format === "roas") {
    return formatRoasCell(typeof value === "number" ? value : null);
  }
  if (format === "orders") {
    return formatOrdersCell(typeof value === "number" ? value : null);
  }
  if (format === "duration") {
    return formatDurationCell(typeof value === "number" ? value : null, available);
  }
  if (format === "ranking" || format === "text") {
    return formatRankingCell(typeof value === "string" ? value : null);
  }
  if (format === "decimal") {
    return formatDecimalCell(typeof value === "number" ? value : null, available);
  }
  if (format === "integer") {
    return formatCountCell(typeof value === "number" ? value : null, available);
  }
  if (!available || value == null) return "—";
  return String(value);
}

export function pickerColumns(category: PickerCategory, query: string) {
  const searched = searchMetricDefinitions(query).filter((item) => item.id !== "campaign");
  if (category === "All Meta Metrics") {
    return searched.filter((item) => item.platform);
  }
  if (category === "Performance") {
    return searched.filter((item) => item.platform && item.defaultOn);
  }
  return searched.filter((item) => item.category === category);
}

export { searchMetricDefinitions, PICKER_CATEGORIES } from "./meta-metric-defs.ts";

export function mappingFilterLabel(filter: MappingFilter) {
  if (filter === "exact_id") return "Exact ID";
  if (filter === "name_match") return "Name match";
  if (filter === "needs_mapping") return "Needs mapping";
  return "All";
}
