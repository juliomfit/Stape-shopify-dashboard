export const FLYWEEL_ADS_DIMENSIONS = new Set([
  "channel",
  "account",
  "campaign",
  "campaign_id",
  "campaign_status",
  "objective",
  "currency",
  "date",
  "week",
  "month",
]);

export function buildFlyweelAdsQuery(params: {
  startDate: string;
  endDate: string;
  metrics: string[];
  dimensions: string[];
  campaignName?: string;
}): Record<string, unknown> {
  const allowed = params.dimensions.filter((name) => FLYWEEL_ADS_DIMENSIONS.has(name));
  const query: Record<string, unknown> = {
    dataSource: "ads",
    metrics: params.metrics,
    dimensions: allowed.length ? allowed : ["date", "campaign", "channel"],
    dateRange: { start: params.startDate, end: params.endDate },
    filters: { channel: ["Meta"] },
    limit: 500,
  };
  if (params.campaignName) {
    query.filters = { channel: ["Meta"], campaign: [params.campaignName] };
  }
  return { queries: [query] };
}
