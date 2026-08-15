function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function parseNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  const text = String(value).replace(/[$,%\s]/g, "");
  if (!text) {
    return 0;
  }
  const amount = Number(text);
  return Number.isFinite(amount) ? amount : 0;
}

export function parseOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const amount = parseNumber(value);
  return Number.isFinite(amount) ? amount : null;
}

export function parseYmdLoose(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "object" && value && "value" in value) {
    return parseYmdLoose((value as { value: unknown }).value);
  }
  const text = String(value).trim();
  const match = text.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

export function pickField(row: Record<string, unknown>, aliases: string[]): unknown {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    if (alias in row) {
      return row[alias];
    }
    const found = keys.find((key) => key.toLowerCase() === alias.toLowerCase());
    if (found) {
      return row[found];
    }
  }
  return undefined;
}

export function pickString(row: Record<string, unknown>, aliases: string[]): string {
  const value = pickField(row, aliases);
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).replace(/^act_/, "").trim();
}

export function unwrapRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return [];
    }
    if (payload.every((item) => item && typeof item === "object")) {
      const objects = payload
        .map(asRecord)
        .filter((row): row is Record<string, unknown> => Boolean(row));
      if (objects.some((row) => Array.isArray(row.rows) || Array.isArray(row.data))) {
        return objects.flatMap((row) => unwrapRows(row));
      }
      return objects;
    }
    return [];
  }
  const root = asRecord(payload);
  if (!root) {
    return [];
  }
  const candidates = [
    root.rows,
    root.data,
    root.results,
    root.metrics,
    root.records,
    root.table,
    asRecord(root.result)?.rows,
    asRecord(root.result)?.data,
    asRecord(root.query)?.rows,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return unwrapRows(candidate);
    }
  }
  if (typeof root.text === "string") {
    try {
      return unwrapRows(JSON.parse(root.text));
    } catch {
      return [];
    }
  }
  if (
    "spend" in root ||
    "campaign_id" in root ||
    "campaignId" in root ||
    "date" in root ||
    "impressions" in root
  ) {
    return [root];
  }
  return [];
}

export function unwrapMcpToolResult(payload: unknown): unknown {
  const root = asRecord(payload);
  if (!root) {
    return payload;
  }
  if (root.structuredContent) {
    return root.structuredContent;
  }
  const content = root.content;
  if (Array.isArray(content)) {
    const texts = content
      .map((item) => asRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .filter((item) => item.type === "text" || typeof item.text === "string")
      .map((item) => String(item.text || ""));
    if (texts.length === 1) {
      try {
        return JSON.parse(texts[0]);
      } catch {
        return texts[0];
      }
    }
    if (texts.length > 1) {
      try {
        return JSON.parse(texts.join(""));
      } catch {
        return texts;
      }
    }
  }
  if (root.result !== undefined) {
    return unwrapMcpToolResult(root.result);
  }
  return payload;
}

const SPEND = ["spend", "cost", "amount_spent", "amountSpent"];
const IMPRESSIONS = ["impressions", "impr"];
const REACH = ["reach", "unique_reach", "uniqueReach"];
const FREQUENCY = ["frequency"];
const CLICKS = ["clicks", "inline_clicks"];
const LINK_CLICKS = ["link_clicks", "inline_link_clicks", "outbound_clicks", "linkClicks"];
const CTR = ["ctr", "click_through_rate"];
const CPC = ["cpc", "cost_per_click"];
const CPM = ["cpm", "cost_per_mille"];
const PURCHASES = ["purchases", "purchase", "conversions", "conversion", "omni_purchase"];
const PURCHASE_VALUE = [
  "purchase_value",
  "purchaseValue",
  "conversion_value",
  "action_values_purchase",
  "website_purchase_roas_value",
];
const ROAS = ["roas", "purchase_roas", "website_purchase_roas", "return_on_ad_spend"];
const CPA = ["cost_per_purchase", "cpa", "cost_per_conversion", "costPerPurchase"];
const LPV = ["landing_page_views", "landing_page_view", "landingPageViews"];
const ATC = ["add_to_cart", "omni_add_to_cart", "addToCart"];
const CHECKOUT = ["initiate_checkout", "omni_initiated_checkout", "checkouts", "initiateCheckout"];

export function normalizeInsightRow(
  row: Record<string, unknown>,
  fallback: { accountId: string; provider: string; date?: string },
) {
  const date = parseYmdLoose(pickField(row, ["date", "date_start", "day", "report_date"]))
    || fallback.date
    || "";
  const spend = parseNumber(pickField(row, SPEND));
  const impressions = parseNumber(pickField(row, IMPRESSIONS));
  const reach = parseNumber(pickField(row, REACH));
  const clicks = parseNumber(pickField(row, CLICKS));
  const purchases = parseNumber(pickField(row, PURCHASES));
  const purchaseValue = parseNumber(pickField(row, PURCHASE_VALUE));
  const frequencyRaw = parseOptionalNumber(pickField(row, FREQUENCY));
  const ctrRaw = parseOptionalNumber(pickField(row, CTR));
  const cpcRaw = parseOptionalNumber(pickField(row, CPC));
  const cpmRaw = parseOptionalNumber(pickField(row, CPM));
  const roasRaw = parseOptionalNumber(pickField(row, ROAS));
  const cpaRaw = parseOptionalNumber(pickField(row, CPA));

  return {
    date,
    accountId: pickString(row, ["account_id", "accountId", "ad_account_id", "account"]) || fallback.accountId,
    campaignId: pickString(row, ["campaign_id", "campaignId"]) || undefined,
    campaignName: pickString(row, ["campaign_name", "campaignName", "campaign"]) || undefined,
    adsetId: pickString(row, ["adset_id", "adsetId", "ad_set_id"]) || undefined,
    adsetName: pickString(row, ["adset_name", "adsetName", "ad_set", "adset"]) || undefined,
    adId: pickString(row, ["ad_id", "adId"]) || undefined,
    adName: pickString(row, ["ad_name", "adName", "ad"]) || undefined,
    spend,
    impressions,
    reach,
    frequency: frequencyRaw ?? (reach > 0 ? impressions / reach : 0),
    clicks,
    linkClicks: parseNumber(pickField(row, LINK_CLICKS)),
    landingPageViews: parseNumber(pickField(row, LPV)),
    ctr: ctrRaw !== null && ctrRaw > 1 ? ctrRaw / 100 : ctrRaw ?? (impressions > 0 ? clicks / impressions : 0),
    cpc: cpcRaw ?? (clicks > 0 ? spend / clicks : 0),
    cpm: cpmRaw ?? (impressions > 0 ? (spend / impressions) * 1000 : 0),
    purchases,
    purchaseValue,
    costPerPurchase: cpaRaw ?? (purchases > 0 ? spend / purchases : 0),
    roas: roasRaw ?? (spend > 0 ? purchaseValue / spend : 0),
    addToCart: parseNumber(pickField(row, ATC)),
    initiateCheckout: parseNumber(pickField(row, CHECKOUT)),
    videoViews: parseOptionalNumber(pickField(row, ["video_views", "video_play_actions", "videoViews"])) ?? undefined,
    videoP25: parseOptionalNumber(pickField(row, ["video_p25_watched_actions", "video_25", "videoP25"])) ?? undefined,
    videoP50: parseOptionalNumber(pickField(row, ["video_p50_watched_actions", "video_50", "videoP50"])) ?? undefined,
    videoP75: parseOptionalNumber(pickField(row, ["video_p75_watched_actions", "video_75", "videoP75"])) ?? undefined,
    videoP100: parseOptionalNumber(pickField(row, ["video_p100_watched_actions", "video_100", "videoP100"])) ?? undefined,
    provider: fallback.provider,
    raw: row,
  };
}

export function normalizeAccount(row: Record<string, unknown>, provider: string) {
  const accountId = pickString(row, [
    "account_id",
    "accountId",
    "id",
    "ad_account_id",
    "adAccountId",
  ]);
  return {
    accountId,
    accountName: pickString(row, ["account_name", "accountName", "name", "descriptive_name"]) || accountId,
    currency: pickString(row, ["currency", "account_currency"]) || undefined,
    timezone: pickString(row, ["timezone", "timezone_name", "account_timezone"]) || undefined,
    platform: "meta" as const,
    provider,
    raw: row,
  };
}

export function insightPersistKey(row: {
  date: string;
  accountId: string;
  campaignId?: string;
  adsetId?: string;
  adId?: string;
}) {
  return [row.date, row.accountId, row.campaignId || "", row.adsetId || "", row.adId || ""].join("|");
}

export function mergeInsightBatches(
  batches: ReturnType<typeof normalizeInsightRow>[][],
): ReturnType<typeof normalizeInsightRow>[] {
  const map = new Map<string, ReturnType<typeof normalizeInsightRow>>();
  for (const batch of batches) {
    for (const row of batch) {
      const key = insightPersistKey(row);
      map.set(key, row);
    }
  }
  return [...map.values()];
}
