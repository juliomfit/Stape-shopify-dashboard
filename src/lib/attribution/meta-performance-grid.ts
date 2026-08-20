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

export const META_GRID_STORAGE_KEY = "goodsnova.meta.performance.columns.v1";
export const FLYWEEL_CAMPAIGN_ONLY_TOOLTIP =
  "Flyweel provides campaign-level reporting only.";

export type MetaGrain = "campaigns" | "adsets" | "ads";
export type ColumnGroupId =
  | "identity"
  | "delivery"
  | "traffic"
  | "meta"
  | "ours"
  | "diagnostics";

export type CampaignColumnId =
  | "campaign"
  | "spend"
  | "impressions"
  | "reach"
  | "frequency"
  | "clicks"
  | "linkClicks"
  | "ctr"
  | "cpc"
  | "cpm"
  | "purchases"
  | "cpa"
  | "metaRevenue"
  | "metaRoas"
  | "ourRevenue"
  | "ourOrders"
  | "ourRoas"
  | "newCustomerCredit"
  | "newCustomerRevenue"
  | "attributedNcac"
  | "mapping";

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
};

export const COLUMN_GROUPS: { id: ColumnGroupId; label: string }[] = [
  { id: "identity", label: "Identity" },
  { id: "delivery", label: "Delivery" },
  { id: "traffic", label: "Traffic" },
  { id: "meta", label: "Meta conversions" },
  { id: "ours", label: "GoodsNova attribution" },
  { id: "diagnostics", label: "Diagnostics" },
];

export const CAMPAIGN_COLUMNS: ColumnDef<CampaignColumnId>[] = [
  { id: "campaign", label: "Campaign", group: "identity", groupLabel: "Identity", numeric: false, sticky: true, defaultOn: true },
  { id: "spend", label: "Spend", group: "delivery", groupLabel: "Delivery", numeric: true, defaultOn: true },
  { id: "impressions", label: "Impressions", group: "delivery", groupLabel: "Delivery", numeric: true },
  { id: "reach", label: "Reach", group: "delivery", groupLabel: "Delivery", numeric: true },
  { id: "frequency", label: "Frequency", group: "delivery", groupLabel: "Delivery", numeric: true },
  { id: "clicks", label: "Clicks", group: "traffic", groupLabel: "Traffic", numeric: true },
  { id: "linkClicks", label: "Link clicks", group: "traffic", groupLabel: "Traffic", numeric: true },
  { id: "ctr", label: "CTR", group: "traffic", groupLabel: "Traffic", numeric: true, defaultOn: true },
  { id: "cpc", label: "CPC", group: "traffic", groupLabel: "Traffic", numeric: true, defaultOn: true },
  { id: "cpm", label: "CPM", group: "traffic", groupLabel: "Traffic", numeric: true },
  { id: "purchases", label: "Purchases", group: "meta", groupLabel: "Meta conversions", numeric: true, defaultOn: true },
  { id: "cpa", label: "CPA", group: "meta", groupLabel: "Meta conversions", numeric: true, defaultOn: true },
  { id: "metaRevenue", label: "Meta revenue", group: "meta", groupLabel: "Meta conversions", numeric: true, defaultOn: true },
  { id: "metaRoas", label: "Meta ROAS", group: "meta", groupLabel: "Meta conversions", numeric: true, defaultOn: true },
  { id: "ourRevenue", label: "OUR revenue", group: "ours", groupLabel: "GoodsNova attribution", numeric: true, defaultOn: true },
  { id: "ourOrders", label: "OUR attributed orders", group: "ours", groupLabel: "GoodsNova attribution", numeric: true, defaultOn: true },
  { id: "ourRoas", label: "OUR ROAS", group: "ours", groupLabel: "GoodsNova attribution", numeric: true, defaultOn: true },
  { id: "newCustomerCredit", label: "New customer credit", group: "ours", groupLabel: "GoodsNova attribution", numeric: true },
  { id: "newCustomerRevenue", label: "New customer revenue", group: "ours", groupLabel: "GoodsNova attribution", numeric: true },
  { id: "attributedNcac", label: "Attributed nCAC", group: "ours", groupLabel: "GoodsNova attribution", numeric: true },
  { id: "mapping", label: "Mapping", group: "diagnostics", groupLabel: "Diagnostics", numeric: false, defaultOn: true },
];

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

export const CHILD_UNSUPPORTED_PLATFORM_METRICS = [
  "spend",
  "impressions",
  "reach",
  "frequency",
  "clicks",
  "linkClicks",
  "ctr",
  "cpc",
  "cpm",
  "purchases",
  "cpa",
  "metaRevenue",
  "metaRoas",
] as const;

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

export type ColumnPreset = "performance" | "delivery" | "conversion" | "attribution" | "all";

export const COLUMN_PRESETS: Record<ColumnPreset, CampaignColumnId[]> = {
  performance: [
    "campaign",
    "spend",
    "purchases",
    "cpa",
    "metaRevenue",
    "metaRoas",
    "ourRevenue",
    "ourOrders",
    "ourRoas",
    "ctr",
    "cpc",
    "mapping",
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
  switch (column) {
    case "campaign":
      return displayCampaignName(row.campaignName);
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
    case "ctr":
      return row.ctr;
    case "cpc":
      return row.cpc;
    case "cpm":
      return row.cpm;
    case "purchases":
      return row.platformPresent ? row.metaPurchases : null;
    case "cpa":
      return row.metaCpa;
    case "metaRevenue":
      return row.platformPresent ? row.metaRevenue : null;
    case "metaRoas":
      return row.metaRoas;
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
    case "mapping":
      return campaignMappingBadge(row).label;
    default:
      return null;
  }
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
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  purchases: number;
  cpa: number | null;
  metaRevenue: number;
  metaRoas: number | null;
  ourRevenue: number;
  ourOrders: number;
  ourRoas: number | null;
  newCustomerCredit: number;
  newCustomerRevenue: number;
  attributedNcac: number | null;
};

export function totalCampaignPerformance(rows: OurCampaignRow[]): CampaignTotals {
  const platform = rows.filter((row) => row.platformPresent);
  const spend = platform.reduce((sum, row) => sum + row.spend, 0);
  const impressions = platform.reduce((sum, row) => sum + row.impressions, 0);
  const clicks = platform.reduce((sum, row) => sum + row.clicks, 0);
  const linkClicks = platform.reduce((sum, row) => sum + row.linkClicks, 0);
  const purchases = platform.reduce((sum, row) => sum + row.metaPurchases, 0);
  const metaRevenue = platform.reduce((sum, row) => sum + row.metaRevenue, 0);
  const ourRevenue = rows.reduce((sum, row) => sum + row.ourRevenue, 0);
  const ourOrders = rows.reduce((sum, row) => sum + row.ourOrders, 0);
  const newCustomerCredit = rows.reduce((sum, row) => sum + row.newCustomerCredit, 0);
  const newCustomerRevenue = rows.reduce((sum, row) => sum + row.newCustomerRevenue, 0);
  return {
    spend,
    impressions,
    // People can appear in multiple campaigns. Do not sum row-level reach.
    reach: null,
    frequency: null,
    clicks,
    linkClicks,
    ctr: ctr(clicks, impressions),
    cpc: cpc(spend, clicks),
    cpm: cpm(spend, impressions),
    purchases,
    cpa: platformCpa(spend, purchases),
    metaRevenue,
    metaRoas: platformRoas(metaRevenue, spend),
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

export function mappingFilterLabel(filter: MappingFilter) {
  if (filter === "exact_id") return "Exact ID";
  if (filter === "name_match") return "Name match";
  if (filter === "needs_mapping") return "Needs mapping";
  return "All";
}
