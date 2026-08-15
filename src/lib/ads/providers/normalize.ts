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

export function payloadLooksLikeError(payload: unknown): string | null {
  if (typeof payload === "string") {
    const text = payload.trim();
    if (
      /^(error|failed|unknown|invalid)/i.test(text) ||
      /not connected|no ad account|no accounts? selected|isError|tool error/i.test(text)
    ) {
      return text.slice(0, 600);
    }
  }
  const root = asRecord(payload);
  if (!root) {
    return null;
  }
  if (root.isError && (root.message || root.text || root.error)) {
    return String(root.message || root.text || root.error).slice(0, 600);
  }
  if (typeof root.error === "string") {
    return root.error.slice(0, 600);
  }
  return null;
}

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
  const date = parseYmdLoose(pickField(row, ["date", "date_start", "day", "report_date", "reportDate", "day_date", "dt"]))
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
