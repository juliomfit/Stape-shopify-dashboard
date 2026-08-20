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
  const iso = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) {
    return iso[1];
  }
  const ymdSlash = text.match(/\b(\d{4})\/(\d{1,2})\/(\d{1,2})\b/);
  if (ymdSlash) {
    return `${ymdSlash[1]}-${ymdSlash[2].padStart(2, "0")}-${ymdSlash[3].padStart(2, "0")}`;
  }
  const us = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (us) {
    const month = Number(us[1]);
    const day = Number(us[2]);
    const year = Number(us[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return null;
}

function normalizeLookup(key: string) {
  return key.toLowerCase().replace(/[\s-]+/g, "_");
}

export function pickField(row: Record<string, unknown>, aliases: string[]): unknown {
  const keys = Object.keys(row);
  const lookup = new Map(keys.map((key) => [normalizeLookup(key), key]));
  for (const alias of aliases) {
    if (alias in row) {
      return row[alias];
    }
    const found = lookup.get(normalizeLookup(alias));
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

function normalizeHeader(cell: string) {
  return cell.trim().replace(/[\s-]+/g, "_").toLowerCase();
}

export function parseDelimitedTable(text: string, delimiter: "," | "\t"): Record<string, unknown>[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return [];
  }
  let headerIndex = -1;
  let header: string[] = [];
  for (let i = 0; i < lines.length - 1; i += 1) {
    const cells = lines[i].split(delimiter).map(normalizeHeader);
    if (cells.length < 2) {
      continue;
    }
    if (cells.some((key) => /^(date|campaign|campaign_id|spend|impressions|clicks)$/.test(key))) {
      headerIndex = i;
      header = cells;
      break;
    }
  }
  if (headerIndex < 0) {
    return [];
  }
  const rows: Record<string, unknown>[] = [];
  for (const line of lines.slice(headerIndex + 1)) {
    if (delimiter === "," && !line.includes(",")) {
      continue;
    }
    if (delimiter === "\t" && !line.includes("\t")) {
      continue;
    }
    const cells = line.split(delimiter).map((cell) => cell.trim());
    const row: Record<string, unknown> = {};
    header.forEach((key, index) => {
      if (key) {
        row[key] = cells[index] ?? "";
      }
    });
    if (Object.values(row).some((value) => String(value).trim() !== "")) {
      rows.push(row);
    }
  }
  return rows;
}

export function parseMarkdownTable(text: string): Record<string, unknown>[] {
  const lines = text
    .replace(/│/g, "|")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("|"));
  if (lines.length < 2) {
    return [];
  }

  const splitRow = (line: string) =>
    line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());

  const isSeparator = (cells: string[]) =>
    cells.length > 0 &&
    cells.every((cell) => {
      const compact = cell.replace(/\s/g, "");
      return !compact || /^:?-{2,}:?$/.test(compact);
    });

  let header: string[] | null = null;
  const rows: Record<string, unknown>[] = [];
  for (const line of lines) {
    const cells = splitRow(line);
    if (!header) {
      if (isSeparator(cells)) {
        continue;
      }
      header = cells.map(normalizeHeader);
      continue;
    }
    if (isSeparator(cells)) {
      continue;
    }
    const row: Record<string, unknown> = {};
    header.forEach((key, index) => {
      if (!key) {
        return;
      }
      row[key] = cells[index] ?? "";
    });
    if (Object.values(row).some((value) => String(value).trim() !== "")) {
      rows.push(row);
    }
  }
  return rows;
}

export function extractPartialJsonRows(text: string): Record<string, unknown>[] {
  const match = text.match(/"rows"\s*:\s*\[/);
  if (!match || match.index === undefined) {
    return [];
  }
  const start = text.indexOf("[", match.index);
  if (start < 0) {
    return [];
  }
  const slice = text.slice(start);
  try {
    const parsed = JSON.parse(slice);
    if (Array.isArray(parsed)) {
      return parsed.map(asRecord).filter((row): row is Record<string, unknown> => Boolean(row));
    }
  } catch {
    // Truncated JSON — keep complete objects only.
  }
  const rows: Record<string, unknown>[] = [];
  let depth = 0;
  let begin = -1;
  for (let i = 0; i < slice.length; i += 1) {
    const char = slice[i];
    if (char === "{") {
      if (depth === 0) {
        begin = i;
      }
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0 && begin >= 0) {
        try {
          const row = asRecord(JSON.parse(slice.slice(begin, i + 1)));
          if (row) {
            rows.push(row);
          }
        } catch {
          // skip a broken object
        }
        begin = -1;
      }
    }
  }
  return rows;
}

export function parseJsonOrTable(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    return trimmed;
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    const inner = fence[1].trim();
    try {
      return JSON.parse(inner);
    } catch {
      const table = parseMarkdownTable(inner);
      if (table.length) {
        return table;
      }
    }
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    const table = parseMarkdownTable(trimmed);
    if (table.length) {
      return table;
    }
    const csv = parseDelimitedTable(trimmed, ",");
    if (csv.length) {
      return csv;
    }
    const tsv = parseDelimitedTable(trimmed, "\t");
    if (tsv.length) {
      return tsv;
    }
    const partial = extractPartialJsonRows(trimmed);
    if (partial.length) {
      return partial;
    }
    return trimmed;
  }
}

export { payloadLooksLikeError } from "./flyweel-errors.ts";

function columnNames(columns: unknown[]): string[] {
  return columns.map((column) => {
    if (typeof column === "string") {
      return column;
    }
    const rec = asRecord(column);
    return String(rec?.name || rec?.key || rec?.id || rec?.field || "");
  });
}

function matrixRow(row: unknown): unknown[] | null {
  if (Array.isArray(row)) {
    return row;
  }
  const rec = asRecord(row);
  if (Array.isArray(rec?.values)) {
    return rec.values as unknown[];
  }
  if (Array.isArray(rec?.cells)) {
    return rec.cells as unknown[];
  }
  return null;
}

function columnsAndMatrix(root: Record<string, unknown>): Record<string, unknown>[] | null {
  const columns = root.columns ?? root.headers ?? root.fields;
  const matrix = root.rows ?? root.values ?? (Array.isArray(root.data) ? root.data : undefined);
  if (!Array.isArray(columns) || !Array.isArray(matrix) || matrix.length === 0) {
    return null;
  }
  const names = columnNames(columns);
  if (!names.some(Boolean)) {
    return null;
  }
  const arrays = matrix.map(matrixRow);
  if (!arrays.every(Boolean)) {
    return null;
  }
  return arrays.map((row) => {
    const object: Record<string, unknown> = {};
    names.forEach((name, index) => {
      if (name) {
        object[name] = (row as unknown[])[index];
      }
    });
    return object;
  });
}

function normalizedKeySet(row: Record<string, unknown>) {
  return new Set(Object.keys(row).map((key) => key.toLowerCase().replace(/[\s-]+/g, "_")));
}

function isInsightish(row: Record<string, unknown>) {
  const keys = normalizedKeySet(row);
  return [
    "spend",
    "cost",
    "amount_spent",
    "campaign_id",
    "campaignid",
    "campaign",
    "campaign_name",
    "date",
    "date_start",
    "impressions",
    "clicks",
  ].some((key) => keys.has(key));
}

function isQueryWrapper(row: Record<string, unknown>) {
  return "queryIndex" in row || (row.success !== undefined && row.data !== undefined);
}

const NESTED_ROW_KEYS = [
  "rows",
  "data",
  "results",
  "metrics",
  "records",
  "table",
  "values",
  "items",
  "preview",
  "sample",
  "dataset",
  "output",
  "queries",
  "rowData",
  "tableData",
  "entries",
];

function unwrapStringField(value: unknown): Record<string, unknown>[] {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }
  return unwrapRows(parseJsonOrTable(value));
}

export function describeFlyweelPayload(payload: unknown): string {
  const root = asRecord(payload);
  if (!root) {
    return `type:${typeof payload}`;
  }
  const result0 = Array.isArray(root.results) ? asRecord(root.results[0]) : null;
  const data = asRecord(result0?.data) || asRecord(root.data);
  const rows = data?.rows ?? root.rows;
  const sample = Array.isArray(rows) ? asRecord(rows[0]) : null;
  return JSON.stringify({
    keys: Object.keys(root),
    dataKeys: data ? Object.keys(data) : [],
    rowCount: Array.isArray(rows) ? rows.length : 0,
    rowType: Array.isArray(rows) ? typeof rows[0] : typeof rows,
    rowKeys: sample ? Object.keys(sample) : [],
    unwrapCount: unwrapRows(payload).length,
    summaryHead: typeof data?.summary === "string" ? String(data.summary).slice(0, 180) : undefined,
  });
}

export function unwrapRows(payload: unknown): Record<string, unknown>[] {
  if (typeof payload === "string") {
    const parsed = parseJsonOrTable(payload);
    if (parsed === payload) {
      const table = parseMarkdownTable(payload);
      if (table.length) {
        return table;
      }
      return extractPartialJsonRows(payload);
    }
    return unwrapRows(parsed);
  }
  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return [];
    }
    if (payload.every((item) => Array.isArray(item))) {
      return [];
    }
    if (payload.every((item) => item && typeof item === "object")) {
      const objects = payload
        .map(asRecord)
        .filter((row): row is Record<string, unknown> => Boolean(row));
      if (objects.some(isQueryWrapper)) {
        return objects.flatMap((row) => unwrapRows(row.data !== undefined ? row.data : row));
      }
      if (objects.some((row) => NESTED_ROW_KEYS.some((key) => Array.isArray(row[key]) || typeof row[key] === "string"))) {
        const nested = objects.flatMap((row) => unwrapRows(row));
        if (nested.length) {
          return nested;
        }
      }
      if (objects.every((row) => "dataSource" in row || ("metrics" in row && "dimensions" in row))) {
        return objects.flatMap((row) => unwrapRows(row));
      }
      return objects.filter(isInsightish);
    }
    if (payload.every((item) => typeof item === "string")) {
      return payload.flatMap((item) => unwrapRows(item));
    }
    return [];
  }
  const root = asRecord(payload);
  if (!root) {
    return [];
  }
  if (Array.isArray(root.results) && root.results.length) {
    const nested = unwrapRows(root.results);
    if (nested.length) {
      return nested;
    }
  }
  if (root.data !== undefined && !Array.isArray(root.data)) {
    const nested = unwrapRows(root.data);
    if (nested.length) {
      return nested;
    }
  }
  const matrix = columnsAndMatrix(root);
  if (matrix?.length) {
    return matrix;
  }
  for (const key of NESTED_ROW_KEYS) {
    const candidate = root[key];
    if (Array.isArray(candidate) && candidate.length > 0) {
      const nested = unwrapRows(candidate);
      if (nested.length) {
        return nested;
      }
    }
    const fromString = unwrapStringField(candidate);
    if (fromString.length) {
      return fromString;
    }
  }
  for (const nestedRoot of [asRecord(root.result), asRecord(root.query), asRecord(root.table)]) {
    if (nestedRoot?.rows !== undefined) {
      const nested = unwrapRows(nestedRoot.rows);
      if (nested.length) {
        return nested;
      }
    }
  }
  for (const field of [root.summary, root.text, root.markdown, root.csv]) {
    const nested = unwrapStringField(field);
    if (nested.length) {
      return nested;
    }
  }
  if (isInsightish(root)) {
    return [root];
  }
  return [];
}

function mcpTextParts(root: Record<string, unknown>): string[] {
  const content = root.content;
  if (!Array.isArray(content)) {
    return [];
  }
  return content
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .filter((item) => item.type === "text" || typeof item.text === "string" || item.type === "resource")
    .map((item) => {
      if (typeof item.text === "string" && item.text) {
        return item.text;
      }
      const resource = asRecord(item.resource);
      return String(resource?.text || resource?.blob || "");
    })
    .filter(Boolean);
}

function richestPayload(candidates: unknown[]): unknown {
  let best: unknown = candidates[0];
  let bestCount = -1;
  for (const candidate of candidates) {
    if (candidate === undefined) {
      continue;
    }
    const count = unwrapRows(candidate).length;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

export function unwrapMcpToolResult(payload: unknown): unknown {
  const root = asRecord(payload);
  if (!root) {
    return payload;
  }
  const texts = mcpTextParts(root);
  const fromContent =
    texts.length === 1
      ? parseJsonOrTable(texts[0])
      : texts.length > 1
        ? (() => {
            const parts = texts.map((text) => parseJsonOrTable(text));
            const joined = parseJsonOrTable(texts.join("\n"));
            return richestPayload([...parts, joined, texts]);
          })()
        : undefined;
  const structured = root.structuredContent;
  const picked = richestPayload([fromContent, structured, root.result, payload]);
  if (unwrapRows(picked).length) {
    return picked;
  }
  if (fromContent !== undefined) {
    return fromContent;
  }
  if (structured !== undefined) {
    return structured;
  }
  if (root.result !== undefined) {
    return unwrapMcpToolResult(root.result);
  }
  return payload;
}

const SPEND = ["spend", "cost", "amount_spent", "amountSpent"];
const IMPRESSIONS = ["impressions", "impr"];
const REACH = ["reach"];
const UNIQUE_REACH = ["unique_reach", "uniqueReach"];
const FREQUENCY = ["frequency"];
const CLICKS = ["clicks", "inline_clicks"];
const LINK_CLICKS = ["link_clicks", "inline_link_clicks", "linkClicks"];
const OUTBOUND_CLICKS = ["outbound_clicks", "outboundClicks"];
const UNIQUE_CLICKS = ["unique_clicks", "uniqueClicks"];
const UNIQUE_CTR = ["unique_ctr", "uniqueCtr"];
const CTR = ["ctr", "click_through_rate"];
const CPC = ["cpc", "cost_per_click"];
const CPM = ["cpm", "cost_per_mille"];
/** Explicit Meta purchase metrics only. Generic conversions stay separate. */
const PURCHASES = ["purchases", "purchase", "omni_purchase", "omni_purchases"];
const CONVERSIONS = ["conversions", "conversion"];
const PURCHASE_VALUE = [
  "purchase_value",
  "purchaseValue",
  "action_values_purchase",
];
const CONVERSION_VALUE = ["conversion_value", "conversion_values", "conversionValue"];
const ROAS = ["roas", "purchase_roas", "website_purchase_roas", "return_on_ad_spend"];
const CPA = ["cost_per_purchase", "cpa", "costPerPurchase"];
const COST_PER_CONVERSION = ["cost_per_conversion"];
const LPV = ["landing_page_views", "landing_page_view", "landingPageViews"];
const ATC = ["add_to_cart", "omni_add_to_cart", "addToCart"];
const CHECKOUT = ["initiate_checkout", "omni_initiated_checkout", "checkouts", "initiateCheckout"];

const DIMENSION_OR_META_KEYS = new Set([
  "date",
  "date_start",
  "day",
  "report_date",
  "reportdate",
  "day_date",
  "dt",
  "account",
  "account_id",
  "accountid",
  "ad_account_id",
  "campaign",
  "campaign_id",
  "campaignid",
  "campaign_name",
  "campaignname",
  "campaign_status",
  "channel",
  "objective",
  "currency",
  "adset",
  "adset_id",
  "adsetid",
  "adset_name",
  "ad_set",
  "ad_id",
  "adid",
  "ad_name",
  "adname",
  "ad",
  "week",
  "month",
]);

export function parseMetricScalar(value: unknown): number | string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  if (/^(above_average|average|below_average|unknown|not_applicable)$/i.test(text)) {
    return text;
  }
  const cleaned = text.replace(/[$,%\s]/g, "");
  if (!cleaned || /[a-z]/i.test(cleaned.replace(/[eE._+-]/g, ""))) {
    return text;
  }
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : text;
}

function parseRanking(value: unknown): string | null {
  const scalar = parseMetricScalar(value);
  if (scalar == null || typeof scalar === "number") {
    return null;
  }
  return scalar;
}

function costPer(spend: number, count: number | null): number | null {
  if (count == null || count === 0) {
    return null;
  }
  return spend / count;
}

const FIRST_CLASS_ALIASES = new Set(
  [
    ...SPEND,
    ...IMPRESSIONS,
    ...REACH,
    ...UNIQUE_REACH,
    ...FREQUENCY,
    ...CLICKS,
    ...LINK_CLICKS,
    ...OUTBOUND_CLICKS,
    ...UNIQUE_CLICKS,
    ...UNIQUE_CTR,
    ...CTR,
    ...CPC,
    ...CPM,
    ...PURCHASES,
    ...CONVERSIONS,
    ...PURCHASE_VALUE,
    ...CONVERSION_VALUE,
    ...ROAS,
    ...CPA,
    ...COST_PER_CONVERSION,
    ...LPV,
    ...ATC,
    ...CHECKOUT,
    "video_views",
    "video_play_actions",
    "videoviews",
    "video_p25_watched_actions",
    "video_p50_watched_actions",
    "video_p75_watched_actions",
    "video_p95_watched_actions",
    "video_p100_watched_actions",
    "video_30_sec_watched",
    "video_30_sec_watched_actions",
    "video_avg_time_watched",
    "video_avg_time_watched_actions",
    "post_engagement",
    "page_engagement",
    "post_reactions",
    "messaging_conversations_started",
    "quality_ranking",
    "engagement_rate_ranking",
    "conversion_rate_ranking",
  ].map((name) => name.toLowerCase()),
);

function collectExtendedMetrics(row: Record<string, unknown>): Record<string, number | string | null> {
  const extended: Record<string, number | string | null> = {};
  for (const [key, value] of Object.entries(row)) {
    const lookup = key.toLowerCase().replace(/[\s-]+/g, "_");
    if (DIMENSION_OR_META_KEYS.has(lookup) || FIRST_CLASS_ALIASES.has(lookup)) {
      continue;
    }
    const scalar = parseMetricScalar(value);
    if (scalar !== null) {
      extended[lookup] = scalar;
    }
  }
  const conversionValue = parseOptionalNumber(pickField(row, CONVERSION_VALUE));
  if (conversionValue != null && extended.conversion_value == null) {
    extended.conversion_value = conversionValue;
  }
  const costPerConversion = parseOptionalNumber(pickField(row, COST_PER_CONVERSION));
  if (costPerConversion != null && extended.cost_per_conversion == null) {
    extended.cost_per_conversion = costPerConversion;
  }
  return extended;
}

export function deriveInsightMetrics<
  T extends {
    spend: number | null;
    impressions: number | null;
    clicks: number | null;
    ctr: number | null;
    cpc: number | null;
    cpm: number | null;
    purchases: number | null;
    purchaseValue: number | null;
    costPerPurchase: number | null;
    costPerLandingPageView: number | null;
    costPerAddToCart: number | null;
    costPerCheckout: number | null;
    roas: number | null;
    landingPageViews: number | null;
    addToCart: number | null;
    initiateCheckout: number | null;
  },
>(row: T): T {
  const spend = row.spend;
  const impressions = row.impressions;
  const clicks = row.clicks;
  return {
    ...row,
    ctr: row.ctr ?? (impressions != null && impressions > 0 && clicks != null ? clicks / impressions : null),
    cpc: row.cpc ?? (spend != null && clicks != null && clicks > 0 ? spend / clicks : null),
    cpm: row.cpm ?? (spend != null && impressions != null && impressions > 0 ? (spend / impressions) * 1000 : null),
    costPerPurchase: row.costPerPurchase ?? (spend != null ? costPer(spend, row.purchases) : null),
    costPerLandingPageView:
      row.costPerLandingPageView ?? (spend != null ? costPer(spend, row.landingPageViews) : null),
    costPerAddToCart: row.costPerAddToCart ?? (spend != null ? costPer(spend, row.addToCart) : null),
    costPerCheckout: row.costPerCheckout ?? (spend != null ? costPer(spend, row.initiateCheckout) : null),
    roas:
      row.roas ??
      (spend != null && spend > 0 && row.purchaseValue != null ? row.purchaseValue / spend : null),
  };
}

export function normalizeInsightRow(
  row: Record<string, unknown>,
  fallback: { accountId: string; provider: string; date?: string },
) {
  const date =
    parseYmdLoose(
      pickField(row, ["date", "date_start", "day", "report_date", "reportDate", "day_date", "dt"]),
    ) ||
    fallback.date ||
    "";
  const spend = parseOptionalNumber(pickField(row, SPEND));
  const impressions = parseOptionalNumber(pickField(row, IMPRESSIONS));
  const uniqueReach = parseOptionalNumber(pickField(row, UNIQUE_REACH));
  const reach = parseOptionalNumber(pickField(row, REACH)) ?? uniqueReach;
  const clicks = parseOptionalNumber(pickField(row, CLICKS));
  const purchases = parseOptionalNumber(pickField(row, PURCHASES));
  const conversions = parseOptionalNumber(pickField(row, CONVERSIONS));
  const purchaseValue = parseOptionalNumber(pickField(row, PURCHASE_VALUE));
  const frequencyRaw = parseOptionalNumber(pickField(row, FREQUENCY));
  const ctrRaw = parseOptionalNumber(pickField(row, CTR));
  const cpcRaw = parseOptionalNumber(pickField(row, CPC));
  const cpmRaw = parseOptionalNumber(pickField(row, CPM));
  const roasRaw = parseOptionalNumber(pickField(row, ROAS));
  const cpaRaw = parseOptionalNumber(pickField(row, CPA));
  const landingPageViews = parseOptionalNumber(pickField(row, LPV));
  const addToCart = parseOptionalNumber(pickField(row, ATC));
  const initiateCheckout = parseOptionalNumber(pickField(row, CHECKOUT));

  return deriveInsightMetrics({
    date,
    accountId:
      pickString(row, ["account_id", "accountId", "ad_account_id", "account"]) || fallback.accountId,
    campaignId: pickString(row, ["campaign_id", "campaignId"]) || undefined,
    campaignName: pickString(row, ["campaign_name", "campaignName", "campaign"]) || undefined,
    adsetId: pickString(row, ["adset_id", "adsetId", "ad_set_id"]) || undefined,
    adsetName: pickString(row, ["adset_name", "adsetName", "ad_set", "adset"]) || undefined,
    adId: pickString(row, ["ad_id", "adId"]) || undefined,
    adName: pickString(row, ["ad_name", "adName", "ad"]) || undefined,
    spend,
    impressions,
    reach,
    frequency: frequencyRaw ?? (reach && reach > 0 && impressions ? impressions / reach : null),
    clicks,
    linkClicks: parseOptionalNumber(pickField(row, LINK_CLICKS)),
    uniqueClicks: parseOptionalNumber(pickField(row, UNIQUE_CLICKS)),
    uniqueCtr: parseOptionalNumber(pickField(row, UNIQUE_CTR)),
    outboundClicks: parseOptionalNumber(pickField(row, OUTBOUND_CLICKS)),
    landingPageViews,
    conversions,
    ctr: ctrRaw !== null && ctrRaw > 1 ? ctrRaw / 100 : ctrRaw,
    cpc: cpcRaw,
    cpm: cpmRaw,
    purchases,
    purchaseValue,
    costPerPurchase: cpaRaw,
    costPerLandingPageView: null as number | null,
    costPerAddToCart: null as number | null,
    costPerCheckout: null as number | null,
    roas: roasRaw,
    addToCart,
    initiateCheckout,
    videoViews: parseOptionalNumber(pickField(row, ["video_views", "video_play_actions", "videoViews"])),
    videoP25: parseOptionalNumber(pickField(row, ["video_p25_watched_actions", "video_25", "videoP25"])),
    videoP50: parseOptionalNumber(pickField(row, ["video_p50_watched_actions", "video_50", "videoP50"])),
    videoP75: parseOptionalNumber(pickField(row, ["video_p75_watched_actions", "video_75", "videoP75"])),
    videoP95: parseOptionalNumber(pickField(row, ["video_p95_watched_actions", "video_95", "videoP95"])),
    videoP100: parseOptionalNumber(pickField(row, ["video_p100_watched_actions", "video_100", "videoP100"])),
    video30s: parseOptionalNumber(
      pickField(row, ["video_30_sec_watched", "video_30_sec_watched_actions", "video30s"]),
    ),
    videoAvgTime: parseOptionalNumber(
      pickField(row, ["video_avg_time_watched", "video_avg_time_watched_actions", "videoAvgTime"]),
    ),
    postEngagement: parseOptionalNumber(pickField(row, ["post_engagement", "postEngagement"])),
    pageEngagement: parseOptionalNumber(pickField(row, ["page_engagement", "pageEngagement"])),
    postReactions: parseOptionalNumber(pickField(row, ["post_reactions", "postReactions"])),
    messagingConversations: parseOptionalNumber(
      pickField(row, ["messaging_conversations_started", "messagingConversations"]),
    ),
    qualityRanking: parseRanking(pickField(row, ["quality_ranking", "qualityRanking"])),
    engagementRateRanking: parseRanking(
      pickField(row, ["engagement_rate_ranking", "engagementRateRanking"]),
    ),
    conversionRateRanking: parseRanking(
      pickField(row, ["conversion_rate_ranking", "conversionRateRanking"]),
    ),
    extended: collectExtendedMetrics(row),
    provider: fallback.provider,
    raw: row,
  });
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

const RAW_DATE_ALIASES = ["date", "date_start", "day", "report_date", "reportDate", "day_date", "dt"];
const RAW_ACCOUNT_ALIASES = ["account_id", "accountId", "ad_account_id", "account"];
const RAW_CAMPAIGN_ID_ALIASES = ["campaign_id", "campaignId"];

export function flyweelRawFactIdentity(
  row: Record<string, unknown>,
  fallbackAccountId: string,
): string {
  const date = parseYmdLoose(pickField(row, RAW_DATE_ALIASES)) || "";
  const account = pickString(row, RAW_ACCOUNT_ALIASES) || fallbackAccountId;
  const campaignId = pickString(row, RAW_CAMPAIGN_ID_ALIASES);
  return [date, account, campaignId].join("|");
}

/**
 * Merge raw Flyweel query_metrics rows for the same campaign/day BEFORE
 * normalizeInsightRow. Later batches add fields; they must not replace the row.
 * Explicit 0 is kept. Missing keys stay missing (not coerced to 0).
 */
export function mergeFlyweelMetricRows(
  rows: Record<string, unknown>[],
  fallbackAccountId: string,
): Record<string, unknown>[] {
  const map = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key = flyweelRawFactIdentity(row, fallbackAccountId);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...row });
      continue;
    }
    for (const [field, value] of Object.entries(row)) {
      if (value !== undefined) {
        existing[field] = value;
      }
    }
  }
  return [...map.values()];
}

export function mergeOptionalScalar<T>(
  previous: T | null | undefined,
  next: T | null | undefined,
): T | null | undefined {
  if (next !== null && next !== undefined) {
    return next;
  }
  if (previous !== null && previous !== undefined) {
    return previous;
  }
  return next === null ? null : previous;
}

function mergeExtended(
  previous: Record<string, number | string | null> | undefined,
  next: Record<string, number | string | null> | undefined,
) {
  const out: Record<string, number | string | null> = { ...(previous || {}) };
  for (const [key, value] of Object.entries(next || {})) {
    const merged = mergeOptionalScalar(out[key], value);
    if (merged !== undefined) {
      out[key] = merged as number | string | null;
    }
  }
  return out;
}

export function mergeInsightRow(
  previous: ReturnType<typeof normalizeInsightRow>,
  next: ReturnType<typeof normalizeInsightRow>,
): ReturnType<typeof normalizeInsightRow> {
  const spend = mergeOptionalScalar(previous.spend, next.spend) ?? null;
  const impressions = mergeOptionalScalar(previous.impressions, next.impressions) ?? null;
  const clicks = mergeOptionalScalar(previous.clicks, next.clicks) ?? null;
  const reach = mergeOptionalScalar(previous.reach, next.reach) ?? null;
  return deriveInsightMetrics({
    ...previous,
    ...next,
    date: next.date || previous.date,
    accountId: next.accountId || previous.accountId,
    campaignId: next.campaignId || previous.campaignId,
    campaignName: next.campaignName || previous.campaignName,
    adsetId: next.adsetId || previous.adsetId,
    adsetName: next.adsetName || previous.adsetName,
    adId: next.adId || previous.adId,
    adName: next.adName || previous.adName,
    spend,
    impressions,
    reach,
    clicks,
    frequency: mergeOptionalScalar(previous.frequency, next.frequency) ?? null,
    linkClicks: mergeOptionalScalar(previous.linkClicks, next.linkClicks) ?? null,
    uniqueClicks: mergeOptionalScalar(previous.uniqueClicks, next.uniqueClicks) ?? null,
    uniqueCtr: mergeOptionalScalar(previous.uniqueCtr, next.uniqueCtr) ?? null,
    outboundClicks: mergeOptionalScalar(previous.outboundClicks, next.outboundClicks) ?? null,
    landingPageViews: mergeOptionalScalar(previous.landingPageViews, next.landingPageViews) ?? null,
    conversions: mergeOptionalScalar(previous.conversions, next.conversions) ?? null,
    ctr: mergeOptionalScalar(previous.ctr, next.ctr) ?? null,
    cpc: mergeOptionalScalar(previous.cpc, next.cpc) ?? null,
    cpm: mergeOptionalScalar(previous.cpm, next.cpm) ?? null,
    purchases: mergeOptionalScalar(previous.purchases, next.purchases) ?? null,
    purchaseValue: mergeOptionalScalar(previous.purchaseValue, next.purchaseValue) ?? null,
    costPerPurchase: mergeOptionalScalar(previous.costPerPurchase, next.costPerPurchase) ?? null,
    costPerLandingPageView:
      mergeOptionalScalar(previous.costPerLandingPageView, next.costPerLandingPageView) ?? null,
    costPerAddToCart: mergeOptionalScalar(previous.costPerAddToCart, next.costPerAddToCart) ?? null,
    costPerCheckout: mergeOptionalScalar(previous.costPerCheckout, next.costPerCheckout) ?? null,
    roas: mergeOptionalScalar(previous.roas, next.roas) ?? null,
    addToCart: mergeOptionalScalar(previous.addToCart, next.addToCart) ?? null,
    initiateCheckout: mergeOptionalScalar(previous.initiateCheckout, next.initiateCheckout) ?? null,
    videoViews: mergeOptionalScalar(previous.videoViews, next.videoViews) ?? null,
    videoP25: mergeOptionalScalar(previous.videoP25, next.videoP25) ?? null,
    videoP50: mergeOptionalScalar(previous.videoP50, next.videoP50) ?? null,
    videoP75: mergeOptionalScalar(previous.videoP75, next.videoP75) ?? null,
    videoP95: mergeOptionalScalar(previous.videoP95, next.videoP95) ?? null,
    videoP100: mergeOptionalScalar(previous.videoP100, next.videoP100) ?? null,
    video30s: mergeOptionalScalar(previous.video30s, next.video30s) ?? null,
    videoAvgTime: mergeOptionalScalar(previous.videoAvgTime, next.videoAvgTime) ?? null,
    postEngagement: mergeOptionalScalar(previous.postEngagement, next.postEngagement) ?? null,
    pageEngagement: mergeOptionalScalar(previous.pageEngagement, next.pageEngagement) ?? null,
    postReactions: mergeOptionalScalar(previous.postReactions, next.postReactions) ?? null,
    messagingConversations:
      mergeOptionalScalar(previous.messagingConversations, next.messagingConversations) ?? null,
    qualityRanking: mergeOptionalScalar(previous.qualityRanking, next.qualityRanking) ?? null,
    engagementRateRanking:
      mergeOptionalScalar(previous.engagementRateRanking, next.engagementRateRanking) ?? null,
    conversionRateRanking:
      mergeOptionalScalar(previous.conversionRateRanking, next.conversionRateRanking) ?? null,
    extended: mergeExtended(previous.extended, next.extended),
    provider: next.provider || previous.provider,
    raw: { ...previous.raw, ...next.raw },
  });
}

export function mergeInsightBatches(
  batches: ReturnType<typeof normalizeInsightRow>[][],
): ReturnType<typeof normalizeInsightRow>[] {
  const map = new Map<string, ReturnType<typeof normalizeInsightRow>>();
  for (const batch of batches) {
    for (const row of batch) {
      const key = insightPersistKey(row);
      const existing = map.get(key);
      map.set(key, existing ? mergeInsightRow(existing, row) : row);
    }
  }
  return [...map.values()].map((row) => deriveInsightMetrics(row));
}
