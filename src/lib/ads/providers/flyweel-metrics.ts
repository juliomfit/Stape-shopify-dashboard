/**
 * Read-only Flyweel Meta metric registry discovery.
 *
 * Preferred source: MCP tools/list → query_metrics input schema enum.
 * Fallback: documented catalog in flyweel-catalog.ts, then isolated
 * query_metrics probes at ingest time.
 *
 * Never put cookies / selected period / request state in this cache.
 */

import type { FlyweelMcpClient, McpTool } from "./flyweel-mcp.ts";
import {
  documentedFlyweelMetaCatalog,
  isFlyweelAdsMetricName,
  TEXT_METRIC_NAMES,
  type FlyweelMetricCatalogEntry,
  type FlyweelMetricType,
} from "./flyweel-catalog.ts";

export type FlyweelMetricHealth = {
  flyweel_candidate_metric_count: number;
  flyweel_metric_catalog_count: number;
  flyweel_metrics_requested: string[];
  flyweel_metrics_requested_count: number;
  flyweel_metric_batches: number;
  flyweel_metrics_returned: string[];
  flyweel_unknown_metrics: string[];
  campaign_rows: number;
  coverage: "full" | "partial" | "baseline" | "unavailable";
  flyweel_ecommerce_support: Record<string, "SUPPORTED" | "UNSUPPORTED">;
};

type MemoryCache = {
  at: number;
  catalog: FlyweelMetricCatalogEntry[];
  source: "mcp-schema" | "documented";
};

const CATALOG_TTL_MS = 6 * 60 * 60 * 1000;
let memoryCache: MemoryCache | null = null;

export function resetFlyweelMetricCatalogCache() {
  memoryCache = null;
}

export function extractMetricNamesFromSchema(schema: unknown): string[] {
  const enums: { path: string; names: string[] }[] = [];

  function walk(node: unknown, path: string) {
    if (!node || typeof node !== "object") {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    const rec = node as Record<string, unknown>;
    if (Array.isArray(rec.enum) && rec.enum.every((item) => typeof item === "string")) {
      enums.push({ path, names: rec.enum as string[] });
    }
    if (rec.const && typeof rec.const === "string") {
      enums.push({ path, names: [rec.const] });
    }
    if (rec.items) {
      walk(rec.items, `${path}.items`);
    }
    if (rec.properties && typeof rec.properties === "object") {
      for (const [key, value] of Object.entries(rec.properties as Record<string, unknown>)) {
        walk(value, `${path}.${key}`);
      }
    }
    for (const key of ["anyOf", "oneOf", "allOf"]) {
      if (Array.isArray(rec[key])) {
        walk(rec[key], `${path}.${key}`);
      }
    }
  }

  walk(schema, "schema");
  const metricEnums = enums.filter(
    (item) =>
      /metric/i.test(item.path) ||
      item.names.includes("spend") ||
      item.names.includes("impressions"),
  );
  const best = [...metricEnums].sort((a, b) => b.names.length - a.names.length)[0];
  return [...new Set((best?.names || []).filter((name) => isFlyweelAdsMetricName(name)))];
}

function typeForName(name: string): FlyweelMetricType {
  if (TEXT_METRIC_NAMES.has(name) || /ranking$/i.test(name)) {
    return "string";
  }
  if (
    name === "actions" ||
    name === "action_values" ||
    name === "cost_per_action_type" ||
    name === "unique_actions"
  ) {
    return "object";
  }
  return "number";
}

function entriesFromNames(
  names: string[],
  provenance: FlyweelMetricCatalogEntry["provenance"],
): FlyweelMetricCatalogEntry[] {
  const documented = new Map(documentedFlyweelMetaCatalog().map((item) => [item.name, item]));
  return names.map((name) => {
    const known = documented.get(name);
    if (known) {
      return known;
    }
    return {
      name,
      type: typeForName(name),
      platform: "meta" as const,
      category: "other" as const,
      provenance,
    };
  });
}

export function catalogFromMcpTools(tools: McpTool[]): FlyweelMetricCatalogEntry[] | null {
  const query = tools.find((tool) => tool.name === "query_metrics" || tool.name === "queryMetrics");
  if (!query?.inputSchema) {
    return null;
  }
  const names = extractMetricNamesFromSchema(query.inputSchema);
  if (names.length < 10) {
    return null;
  }
  return entriesFromNames(names, "flyweel-docs");
}

/**
 * Discover the Flyweel Meta metric registry.
 * MCP schema enum wins. Otherwise the documented + probe catalog.
 */
export async function getFlyweelMetricCatalog(
  client?: Pick<FlyweelMcpClient, "listTools">,
): Promise<{
  catalog: FlyweelMetricCatalogEntry[];
  source: "mcp-schema" | "documented";
}> {
  if (memoryCache && Date.now() - memoryCache.at < CATALOG_TTL_MS) {
    return { catalog: memoryCache.catalog, source: memoryCache.source };
  }
  if (client) {
    try {
      const tools = await client.listTools();
      const fromSchema = catalogFromMcpTools(tools);
      if (fromSchema?.length) {
        memoryCache = { at: Date.now(), catalog: fromSchema, source: "mcp-schema" };
        return { catalog: fromSchema, source: "mcp-schema" };
      }
    } catch {
      // Schema discovery is optional. Documented catalog + ingest probes remain.
    }
  }
  const catalog = documentedFlyweelMetaCatalog();
  memoryCache = { at: Date.now(), catalog, source: "documented" };
  return { catalog, source: "documented" };
}

export function coverageFromHealth(input: {
  requested: string[];
  accepted: string[];
  unknown: string[];
  baseline: readonly string[];
}): FlyweelMetricHealth["coverage"] {
  if (input.unknown.length === 0 && input.accepted.length >= input.requested.length) {
    return "full";
  }
  const acceptedSet = new Set(input.accepted);
  const onlyBaseline =
    input.accepted.length > 0 &&
    input.accepted.every((name) => (input.baseline as readonly string[]).includes(name)) &&
    acceptedSet.size <= input.baseline.length;
  if (onlyBaseline && input.requested.length > input.baseline.length) {
    return "baseline";
  }
  return "partial";
}

export function summarizeMetricKeysFromRows(rows: Record<string, unknown>[]): string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (isFlyweelAdsMetricName(key)) {
        keys.add(key);
      }
    }
  }
  return [...keys].sort();
}
