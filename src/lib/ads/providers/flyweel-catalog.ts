/**
 * Flyweel Meta metric names with explicit provenance.
 *
 * Do not treat probe candidates as live-verified. Runtime discovery
 * (MCP query_metrics enum, then isolated query_metrics) is the source of
 * truth for what this account can actually import.
 *
 * Sources:
 * - Baseline 10: Flyweel docs + production query_metrics (plural `conversions`).
 * - flyweel-docs: https://www.flyweel.co/docs/features/extended-metrics and
 *   https://www.flyweel.co/blog/top-5-mcps-for-google-meta-ads-in-2026
 * - meta-insights-probe: Meta Marketing API insights identifiers that match
 *   Flyweel's published Meta categories (funnel, video quartiles, rankings,
 *   engagement). Requested only with isolation; dropped if Flyweel rejects them.
 */

export type FlyweelMetricType = "number" | "string" | "object";
export type FlyweelMetricProvenance = "baseline" | "flyweel-docs" | "meta-insights-probe";
export type FlyweelMetricCategory =
  | "delivery"
  | "traffic"
  | "funnel"
  | "conversions"
  | "revenue"
  | "video"
  | "engagement"
  | "quality"
  | "other";

export type FlyweelMetricCatalogEntry = {
  name: string;
  type: FlyweelMetricType;
  platform: "meta";
  category: FlyweelMetricCategory;
  provenance: FlyweelMetricProvenance;
  description?: string;
};

function entry(
  name: string,
  category: FlyweelMetricCategory,
  provenance: FlyweelMetricProvenance,
  type: FlyweelMetricType = "number",
  description?: string,
): FlyweelMetricCatalogEntry {
  return { name, type, platform: "meta", category, provenance, description };
}

/** Production-verified 10-metric baseline. Emergency fallback only. */
export const FLYWEEL_BASELINE_METRICS = [
  "spend",
  "impressions",
  "clicks",
  "conversions",
  "cpc",
  "cpm",
  "ctr",
  "reach",
  "cost_per_conversion",
  "conversion_rate",
] as const;

export const FLYWEEL_BASELINE_CATALOG: FlyweelMetricCatalogEntry[] = [
  entry("spend", "delivery", "baseline"),
  entry("impressions", "delivery", "baseline"),
  entry("clicks", "traffic", "baseline"),
  entry("conversions", "conversions", "baseline", "number", "Platform conversions — not Meta Purchases"),
  entry("cpc", "traffic", "baseline"),
  entry("cpm", "delivery", "baseline"),
  entry("ctr", "traffic", "baseline"),
  entry("reach", "delivery", "baseline"),
  entry("cost_per_conversion", "conversions", "baseline"),
  entry("conversion_rate", "conversions", "baseline"),
];

/**
 * Extended Meta names Flyweel published (docs highlights + 2026 MCP blog table).
 * These are documented identifiers, not a guessed 67-name dump.
 */
export const FLYWEEL_DOCUMENTED_EXTENDED: FlyweelMetricCatalogEntry[] = [
  entry("frequency", "delivery", "flyweel-docs"),
  entry("unique_ctr", "traffic", "flyweel-docs"),
  entry("unique_reach", "delivery", "flyweel-docs"),
  entry("cost_per_1000_reached", "delivery", "flyweel-docs"),
  entry("link_clicks", "traffic", "flyweel-docs"),
  entry("outbound_clicks", "traffic", "flyweel-docs"),
  entry("purchase_value", "revenue", "flyweel-docs"),
  entry("website_purchase_roas", "revenue", "flyweel-docs"),
  entry("mobile_app_purchase_roas", "revenue", "flyweel-docs"),
  entry("action_values", "revenue", "flyweel-docs", "object"),
  entry("cost_per_action_type", "conversions", "flyweel-docs", "object"),
  entry("video_play_actions", "video", "flyweel-docs", "number", "3-second video views"),
  entry("video_p25_watched_actions", "video", "flyweel-docs"),
  entry("video_p50_watched_actions", "video", "flyweel-docs"),
  entry("video_p75_watched_actions", "video", "flyweel-docs"),
  entry("video_p95_watched_actions", "video", "flyweel-docs"),
  entry("video_p100_watched_actions", "video", "flyweel-docs"),
  entry("video_30_sec_watched", "video", "flyweel-docs"),
  entry("video_avg_time_watched", "video", "flyweel-docs"),
  entry("post_engagement", "engagement", "flyweel-docs"),
  entry("page_engagement", "engagement", "flyweel-docs"),
  entry("post_reactions", "engagement", "flyweel-docs"),
  entry("messaging_conversations_started", "engagement", "flyweel-docs"),
  entry("quality_ranking", "quality", "flyweel-docs", "string"),
  entry("engagement_rate_ranking", "quality", "flyweel-docs", "string"),
  entry("conversion_rate_ranking", "quality", "flyweel-docs", "string"),
];

/**
 * Meta insights / Ads Manager identifiers that match Flyweel's published
 * ecommerce, delivery, video, and quality categories. Probe-only.
 */
export const FLYWEEL_META_PROBE_CANDIDATES: FlyweelMetricCatalogEntry[] = [
  entry("purchases", "funnel", "meta-insights-probe", "number", "Explicit Meta Purchase — not generic conversions"),
  entry("purchase", "funnel", "meta-insights-probe"),
  entry("omni_purchase", "funnel", "meta-insights-probe"),
  entry("add_to_cart", "funnel", "meta-insights-probe"),
  entry("omni_add_to_cart", "funnel", "meta-insights-probe"),
  entry("initiate_checkout", "funnel", "meta-insights-probe"),
  entry("omni_initiated_checkout", "funnel", "meta-insights-probe"),
  entry("landing_page_views", "funnel", "meta-insights-probe"),
  entry("landing_page_view", "funnel", "meta-insights-probe"),
  entry("inline_link_clicks", "traffic", "meta-insights-probe"),
  entry("unique_clicks", "traffic", "meta-insights-probe"),
  entry("unique_inline_link_clicks", "traffic", "meta-insights-probe"),
  entry("unique_outbound_clicks", "traffic", "meta-insights-probe"),
  entry("inline_link_click_ctr", "traffic", "meta-insights-probe"),
  entry("outbound_clicks_ctr", "traffic", "meta-insights-probe"),
  entry("unique_outbound_clicks_ctr", "traffic", "meta-insights-probe"),
  entry("cost_per_unique_click", "traffic", "meta-insights-probe"),
  entry("cost_per_inline_link_click", "traffic", "meta-insights-probe"),
  entry("cost_per_outbound_click", "traffic", "meta-insights-probe"),
  entry("website_ctr", "traffic", "meta-insights-probe"),
  entry("cpp", "delivery", "meta-insights-probe", "number", "Cost per 1,000 people reached"),
  entry("purchase_roas", "revenue", "meta-insights-probe"),
  entry("cost_per_purchase", "funnel", "meta-insights-probe"),
  entry("conversion_value", "conversions", "meta-insights-probe"),
  entry("conversion_values", "conversions", "meta-insights-probe"),
  entry("unique_conversions", "conversions", "meta-insights-probe"),
  entry("leads", "conversions", "meta-insights-probe"),
  entry("cost_per_lead", "conversions", "meta-insights-probe"),
  entry("actions", "conversions", "meta-insights-probe", "object"),
  entry("video_30_sec_watched_actions", "video", "meta-insights-probe"),
  entry("video_avg_time_watched_actions", "video", "meta-insights-probe"),
  entry("video_thruplay_watched_actions", "video", "meta-insights-probe"),
  entry("cost_per_thruplay", "video", "meta-insights-probe"),
  entry("inline_post_engagement", "engagement", "meta-insights-probe"),
  entry("cost_per_inline_post_engagement", "engagement", "meta-insights-probe"),
  entry("social_spend", "delivery", "meta-insights-probe"),
  entry("estimated_ad_recallers", "engagement", "meta-insights-probe"),
  entry("full_view_impressions", "video", "meta-insights-probe"),
  entry("full_view_reach", "video", "meta-insights-probe"),
];

const CRM_METRIC_NAMES = new Set([
  "deals_created",
  "deals_won",
  "deals_lost",
  "deals_open",
  "pipeline_value",
  "win_rate",
  "velocity_days",
  "avg_deal_size",
  "revenue",
]);

const DIMENSION_NAMES = new Set([
  "date",
  "week",
  "month",
  "channel",
  "account",
  "campaign",
  "campaign_id",
  "campaign_status",
  "campaign_name",
  "objective",
  "currency",
]);

export function isFlyweelAdsMetricName(name: string) {
  const key = name.trim();
  if (!key || CRM_METRIC_NAMES.has(key) || DIMENSION_NAMES.has(key)) {
    return false;
  }
  return true;
}

export function documentedFlyweelMetaCatalog(): FlyweelMetricCatalogEntry[] {
  const map = new Map<string, FlyweelMetricCatalogEntry>();
  for (const item of [
    ...FLYWEEL_BASELINE_CATALOG,
    ...FLYWEEL_DOCUMENTED_EXTENDED,
    ...FLYWEEL_META_PROBE_CANDIDATES,
  ]) {
    if (!map.has(item.name)) {
      map.set(item.name, item);
    }
  }
  return [...map.values()];
}

export function documentedFlyweelMetaMetricNames() {
  return documentedFlyweelMetaCatalog().map((item) => item.name);
}

export const TEXT_METRIC_NAMES = new Set(
  documentedFlyweelMetaCatalog()
    .filter((item) => item.type === "string")
    .map((item) => item.name),
);

export const OBJECT_METRIC_NAMES = new Set(
  documentedFlyweelMetaCatalog()
    .filter((item) => item.type === "object")
    .map((item) => item.name),
);

/** Semantic batches kept at or under the Flyweel 30-metric query limit. */
export function groupedFlyweelMetaMetricBatches(names: string[], limit = 30): string[][] {
  const wanted = new Set(names);
  const catalog = documentedFlyweelMetaCatalog().filter((item) => wanted.has(item.name));
  const leftover = names.filter((name) => !catalog.some((item) => item.name === name));
  const groups: Record<string, string[]> = {
    core: [],
    commerce: [],
    video: [],
  };
  for (const item of catalog) {
    if (item.category === "video" || item.category === "engagement" || item.category === "quality") {
      groups.video.push(item.name);
    } else if (
      item.category === "funnel" ||
      item.category === "conversions" ||
      item.category === "revenue"
    ) {
      groups.commerce.push(item.name);
    } else {
      groups.core.push(item.name);
    }
  }
  groups.core.push(...leftover);
  return [groups.core, groups.commerce, groups.video]
    .filter((group) => group.length > 0)
    .flatMap((group) => chunkMetrics(group, limit));
}

export function chunkMetrics(names: string[], limit = 30): string[][] {
  const unique = [...new Set(names.filter(Boolean))];
  const batches: string[][] = [];
  for (let i = 0; i < unique.length; i += limit) {
    batches.push(unique.slice(i, i + limit));
  }
  return batches;
}

export function splitMetricBatch(names: string[]): [string[], string[]] {
  const mid = Math.max(1, Math.ceil(names.length / 2));
  return [names.slice(0, mid), names.slice(mid)];
}

export function unknownMetricsFromError(message: string, requested: string[]): string[] {
  const hits = requested.filter((name) => {
    const pattern = new RegExp(`(?:metric|unknown|invalid)[^\\n]{0,80}\\b${name}\\b`, "i");
    return pattern.test(message) || message.includes(`"${name}"`) || message.includes(`'${name}'`);
  });
  if (hits.length) {
    return [...new Set(hits)];
  }
  const quoted = [...message.matchAll(/['"`]([a-z][a-z0-9_]{1,80})['"`]/gi)].map((match) => match[1]);
  return [...new Set(quoted.filter((name) => requested.includes(name)))];
}
