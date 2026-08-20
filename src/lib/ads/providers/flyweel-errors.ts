/**
 * Flyweel query_metrics error detection, valid_options parsing, and
 * bounded metric-retry planning. No request/cookie state.
 */

import {
  FLYWEEL_BASELINE_METRICS,
  groupedFlyweelMetaMetricBatches,
  isFlyweelAdsMetricName,
  splitMetricBatch,
  unknownMetricsFromError,
} from "./flyweel-catalog.ts";

export const FLYWEEL_ECOMMERCE_FUNNEL_CANDIDATES = [
  "landing_page_views",
  "add_to_cart",
  "initiate_checkout",
  "purchases",
  "purchase_value",
  "website_purchase_roas",
  "purchase_roas",
  "link_clicks",
] as const;

export type FlyweelEcommerceSupport = "SUPPORTED" | "UNSUPPORTED";

const VALID_OPTIONS_STOPWORDS = new Set([
  "ads",
  "for",
  "the",
  "and",
  "with",
  "from",
  "one",
  "must",
  "not",
  "any",
  "all",
  "valid",
  "options",
  "invalid",
  "metric",
  "metrics",
  "query",
  "error",
  "unknown",
  "please",
  "use",
  "only",
]);

const NESTED_ERROR_KEYS = [
  "results",
  "data",
  "query",
  "queries",
  "content",
  "structuredContent",
  "result",
  "output",
  "payload",
  "body",
  "rows",
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function isInsightish(row: Record<string, unknown>) {
  const keys = new Set(Object.keys(row).map((key) => key.toLowerCase().replace(/[\s-]+/g, "_")));
  return ["spend", "cost", "impressions", "clicks", "campaign_id", "campaignid", "campaign"].some((key) =>
    keys.has(key),
  );
}

export function looksLikeFlyweelMetricErrorText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }
  return (
    /invalid_metric|unknown metric|invalid metric|not connected|no ad account|no accounts? selected|isError|tool error/i.test(
      trimmed,
    ) || /^(error|failed|unknown|invalid)\b/i.test(trimmed)
  );
}

function collectTextChunks(payload: unknown, depth: number, seen: WeakSet<object>): string[] {
  if (payload == null || depth > 8) {
    return [];
  }
  if (typeof payload === "string") {
    const text = payload.trim();
    if (!text) {
      return [];
    }
    const out = [text];
    if ((text.startsWith("{") || text.startsWith("[")) && text.length < 200_000) {
      try {
        out.push(...collectTextChunks(JSON.parse(text), depth + 1, seen));
      } catch {
        // keep the raw string
      }
    }
    return out;
  }
  if (typeof payload !== "object") {
    return [];
  }
  if (seen.has(payload)) {
    return [];
  }
  seen.add(payload);
  if (Array.isArray(payload)) {
    return payload.flatMap((item) => collectTextChunks(item, depth + 1, seen));
  }
  const rec = payload as Record<string, unknown>;
  if (isInsightish(rec)) {
    return [];
  }
  const out: string[] = [];
  for (const key of ["error", "message", "text", "summary"]) {
    const value = rec[key];
    if (typeof value === "string" && value.trim()) {
      out.push(value);
    }
  }
  if (rec.isError) {
    out.push(String(rec.message || rec.error || rec.text || "tool error"));
  }
  if (Array.isArray(rec.content)) {
    for (const part of rec.content) {
      const item = asRecord(part);
      if (typeof item?.text === "string") {
        out.push(...collectTextChunks(item.text, depth + 1, seen));
      }
    }
  }
  for (const key of NESTED_ERROR_KEYS) {
    if (rec[key] !== undefined) {
      out.push(...collectTextChunks(rec[key], depth + 1, seen));
    }
  }
  return out;
}

export function payloadLooksLikeError(payload: unknown): string | null {
  const chunks = collectTextChunks(payload, 0, new WeakSet());
  const hit = chunks.find((chunk) => looksLikeFlyweelMetricErrorText(chunk));
  return hit ? hit.slice(0, 8000) : null;
}

export function looksLikeMetricOptionName(name: string) {
  const key = name.trim().toLowerCase();
  if (!isFlyweelAdsMetricName(key) || VALID_OPTIONS_STOPWORDS.has(key)) {
    return false;
  }
  return /^[a-z][a-z0-9_]{1,80}$/.test(key);
}

function extractValidOptionsFromText(text: string): string[] {
  const match = text.match(
    /valid_options\s*[:=]\s*\[?([\s\S]+)|valid options\s*[:=]\s*\[?([\s\S]+)|must be one of\s*[:=]?\s*\[?([\s\S]+)/i,
  );
  if (!match) {
    return [];
  }
  const chunk = match[1] || match[2] || match[3] || "";
  const tokens = chunk
    .split(/[\s,;|]+/)
    .map((token) => token.replace(/^['"`\[\(\{]+|['"`\]\)\}:.,]+$/g, "").trim().toLowerCase())
    .filter(looksLikeMetricOptionName);
  return [...new Set(tokens)];
}

export function parseFlyweelValidMetricOptions(payload: unknown): string[] {
  const names = new Set<string>();

  function walk(node: unknown, depth: number, seen: WeakSet<object>) {
    if (node == null || depth > 8) {
      return;
    }
    if (typeof node === "string") {
      extractValidOptionsFromText(node).forEach((name) => names.add(name));
      if ((node.trim().startsWith("{") || node.trim().startsWith("[")) && node.length < 200_000) {
        try {
          walk(JSON.parse(node), depth + 1, seen);
        } catch {
          // keep text-extracted names
        }
      }
      return;
    }
    if (typeof node !== "object") {
      return;
    }
    if (seen.has(node)) {
      return;
    }
    seen.add(node);
    if (Array.isArray(node)) {
      if (node.length && node.every((item) => typeof item === "string" && looksLikeMetricOptionName(item))) {
        node.forEach((item) => names.add(String(item).toLowerCase()));
      }
      node.forEach((item) => walk(item, depth + 1, seen));
      return;
    }
    const rec = node as Record<string, unknown>;
    for (const key of ["valid_options", "validOptions", "allowed_metrics", "allowedMetrics"]) {
      if (rec[key] !== undefined) {
        walk(rec[key], depth + 1, seen);
      }
    }
    for (const key of ["error", "message", "text", "summary", ...NESTED_ERROR_KEYS]) {
      if (rec[key] !== undefined) {
        walk(rec[key], depth + 1, seen);
      }
    }
  }

  walk(payload instanceof Error ? payload.message : payload, 0, new WeakSet());
  return [...names];
}

export function parseFlyweelInvalidMetricNames(payload: unknown, requested: string[]): string[] {
  const text =
    payload instanceof Error
      ? payload.message
      : typeof payload === "string"
        ? payload
        : payloadLooksLikeError(payload) || JSON.stringify(payload || "");
  const quoted = text.match(/invalid_metric\s+["'`]?([a-z][a-z0-9_]*)/i);
  if (quoted && requested.includes(quoted[1])) {
    return [quoted[1]];
  }
  const beforeValid = text.split(/valid_options/i)[0] || text;
  const named = unknownMetricsFromError(beforeValid, requested);
  if (named.length) {
    return named;
  }
  return [];
}

export function applyFlyweelValidOptions(requested: string[], validOptions: string[]) {
  const allowed = new Set(validOptions);
  return {
    verified: requested.filter((name) => allowed.has(name)),
    unknown: requested.filter((name) => !allowed.has(name)),
  };
}

export class FlyweelMetricQueryError extends Error {
  payload: unknown;
  validOptions: string[];
  invalidMetrics: string[];

  constructor(message: string, payload?: unknown, requested: string[] = []) {
    super(message);
    this.name = "FlyweelMetricQueryError";
    this.payload = payload ?? message;
    this.validOptions = parseFlyweelValidMetricOptions(this.payload);
    if (!this.validOptions.length) {
      this.validOptions = parseFlyweelValidMetricOptions(message);
    }
    this.invalidMetrics = parseFlyweelInvalidMetricNames(this.payload, requested);
    if (!this.invalidMetrics.length) {
      this.invalidMetrics = parseFlyweelInvalidMetricNames(message, requested);
    }
  }
}

export function sanitizeFlyweelUserError(message: string): string {
  const text = message.replace(/\s+/g, " ").trim();
  if (
    /invalid_metric|valid_options|Last metrics payload|\[\{\s*"error"/i.test(text) ||
    /Flyweel returned 0 campaign rows/i.test(text)
  ) {
    return "Extended Meta metrics partially supported. Unsupported optional metrics were skipped. Campaign reporting should still load after Refresh Meta.";
  }
  return text.slice(0, 400);
}

export function formatExtendedMetricsHealthMessage(input: {
  coverage: "full" | "partial" | "baseline" | "unavailable";
  candidateCount: number;
  acceptedCount: number;
  unknownCount: number;
}): string | null {
  if (input.coverage === "full") {
    return null;
  }
  if (input.coverage === "baseline" || input.coverage === "unavailable") {
    return `Extended Meta metrics unavailable. Using the verified ${FLYWEEL_BASELINE_METRICS.length}-metric baseline. ${input.unknownCount} unsupported metrics skipped.`;
  }
  return `Extended Meta metrics partially supported. ${input.acceptedCount} of ${input.candidateCount} candidate metrics accepted. ${input.unknownCount} unsupported metrics skipped.`;
}

export function ecommerceSupportFromLive(input: {
  validOptions: string[];
  accepted: string[];
  returned: string[];
}): Record<(typeof FLYWEEL_ECOMMERCE_FUNNEL_CANDIDATES)[number], FlyweelEcommerceSupport> {
  const live = new Set(
    (input.validOptions.length ? input.validOptions : [...input.accepted, ...input.returned]).map((name) =>
      name.toLowerCase(),
    ),
  );
  const out = {} as Record<(typeof FLYWEEL_ECOMMERCE_FUNNEL_CANDIDATES)[number], FlyweelEcommerceSupport>;
  for (const name of FLYWEEL_ECOMMERCE_FUNNEL_CANDIDATES) {
    out[name] = live.has(name) ? "SUPPORTED" : "UNSUPPORTED";
  }
  return out;
}

export type FlyweelBatchQueryResult = {
  rows: Record<string, unknown>[];
  accepted: string[];
  unknown: string[];
  validOptions: string[];
  strategy: "direct" | "valid_options" | "named_invalid" | "binary" | "baseline";
  queryCalls: number;
};

async function queryCounting(
  query: (batches: string[][]) => Promise<Record<string, unknown>[]>,
  batches: string[][],
  requested: string[],
): Promise<Record<string, unknown>[]> {
  try {
    return await query(batches);
  } catch (error) {
    if (error instanceof FlyweelMetricQueryError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new FlyweelMetricQueryError(message, error instanceof Error ? error.message : error, requested);
  }
}

/**
 * Query metric batches. On invalid_metric, prefer Flyweel valid_options
 * (one retry) over binary isolation.
 */
export async function fetchFlyweelMetricBatches(input: {
  batches: string[][];
  query: (batches: string[][]) => Promise<Record<string, unknown>[]>;
  baseline?: readonly string[];
  metricLimit?: number;
}): Promise<FlyweelBatchQueryResult> {
  const baseline = [...(input.baseline || FLYWEEL_BASELINE_METRICS)];
  const requested = input.batches.flat();
  let queryCalls = 0;
  const tracked = async (batches: string[][]) => {
    queryCalls += 1;
    return queryCounting(input.query, batches, batches.flat());
  };

  try {
    const rows = await tracked(input.batches);
    return {
      rows,
      accepted: requested,
      unknown: [],
      validOptions: [],
      strategy: "direct",
      queryCalls,
    };
  } catch (error) {
    const metricError =
      error instanceof FlyweelMetricQueryError
        ? error
        : new FlyweelMetricQueryError(
            error instanceof Error ? error.message : String(error),
            error,
            requested,
          );
    if (!/invalid_metric|unknown metric|invalid metric/i.test(metricError.message)) {
      throw metricError;
    }

    const validOptions = metricError.validOptions.length
      ? metricError.validOptions
      : parseFlyweelValidMetricOptions(metricError.payload);
    if (validOptions.length) {
      const { verified, unknown } = applyFlyweelValidOptions(requested, validOptions);
      if (!verified.length) {
        const rows = await tracked([baseline]);
        return {
          rows,
          accepted: baseline,
          unknown: [...new Set([...unknown, ...requested.filter((name) => !baseline.includes(name))])],
          validOptions,
          strategy: "baseline",
          queryCalls,
        };
      }
      try {
        const nextBatches = groupedFlyweelMetaMetricBatches(verified, input.metricLimit);
        const rows = await tracked(nextBatches);
        return {
          rows,
          accepted: verified,
          unknown,
          validOptions,
          strategy: "valid_options",
          queryCalls,
        };
      } catch {
        const rows = await tracked([baseline]);
        return {
          rows,
          accepted: baseline,
          unknown: [...new Set([...unknown, ...requested.filter((name) => !baseline.includes(name))])],
          validOptions,
          strategy: "baseline",
          queryCalls,
        };
      }
    }

    const named = metricError.invalidMetrics.length
      ? metricError.invalidMetrics
      : parseFlyweelInvalidMetricNames(metricError, requested);
    if (named.length && named.length < requested.length) {
      const remaining = requested.filter((name) => !named.includes(name));
      const nested = await fetchFlyweelMetricBatches({
        ...input,
        batches: groupedFlyweelMetaMetricBatches(remaining, input.metricLimit),
      });
      return {
        ...nested,
        unknown: [...new Set([...named, ...nested.unknown])],
        queryCalls: queryCalls + nested.queryCalls,
        strategy: nested.strategy === "direct" ? "named_invalid" : nested.strategy,
      };
    }

    if (requested.length <= 1) {
      const rows = await tracked([baseline]);
      return {
        rows,
        accepted: baseline,
        unknown: requested.filter((name) => !baseline.includes(name)),
        validOptions: [],
        strategy: "baseline",
        queryCalls,
      };
    }

    const [left, right] = splitMetricBatch(requested);
    const first = await fetchFlyweelMetricBatches({
      ...input,
      batches: groupedFlyweelMetaMetricBatches(left, input.metricLimit),
    });
    const second = await fetchFlyweelMetricBatches({
      ...input,
      batches: groupedFlyweelMetaMetricBatches(right, input.metricLimit),
    });
    return {
      rows: [...first.rows, ...second.rows],
      accepted: [...new Set([...first.accepted, ...second.accepted])],
      unknown: [...new Set([...first.unknown, ...second.unknown])],
      validOptions: [...new Set([...first.validOptions, ...second.validOptions])],
      strategy: "binary",
      queryCalls: queryCalls + first.queryCalls + second.queryCalls,
    };
  }
}
