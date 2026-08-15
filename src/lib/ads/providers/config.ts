export type ActiveMetaProviderId = "flyweel" | "meta_graph" | "none";

export const FLYWEEL_DEFAULT_MCP_URL =
  "https://api.flyweel.co/functions/v1/mcp-server/mcp";

export const FLYWEEL_WRITE_TOOLS = [
  "connect_ad_platform",
  "select_ad_accounts",
] as const;

export class FlyweelWriteRefusedError extends Error {
  constructor(tool: string) {
    super(`Refused Flyweel write tool ${tool}. Meta is read-only in GoodsNova.`);
    this.name = "FlyweelWriteRefusedError";
  }
}

export function assertFlyweelReadOnly(tool: string) {
  if ((FLYWEEL_WRITE_TOOLS as readonly string[]).includes(tool)) {
    throw new FlyweelWriteRefusedError(tool);
  }
}

export const FLYWEEL_ROW_LIMIT = 500;
export const FLYWEEL_METRIC_LIMIT = 30;
export const FLYWEEL_DIMENSION_LIMIT = 5;
export const FLYWEEL_QUERY_BATCH_LIMIT = 5;
export const FLYWEEL_STALE_MINUTES = 15;

export function sanitizeFlyweelApiKey(raw: string) {
  return raw
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/^["']+|["']+$/g, "")
    .replace(/\s+/g, "")
    .trim();
}

export function flyweelApiKey() {
  return sanitizeFlyweelApiKey(process.env.FLYWEEL_API_KEY || "");
}

export function flyweelApiKeyProblem(key = flyweelApiKey()): string | null {
  if (!key) {
    return "FLYWEEL_API_KEY is missing on Vercel Production.";
  }
  if (key.includes("...") || key.includes("…")) {
    return "FLYWEEL_API_KEY looks like the masked prefix from Flyweel (fwl_abcd…). Create a new key and paste the full secret shown once.";
  }
  if (!key.startsWith("fwl_")) {
    return "FLYWEEL_API_KEY must start with fwl_. Do not paste the Cursor mcp.json block.";
  }
  if (key.length < 40) {
    return "FLYWEEL_API_KEY is too short. Flyweel only shows the full key once when you generate it.";
  }
  return null;
}

export function flyweelMcpUrl() {
  return process.env.FLYWEEL_MCP_URL?.trim() || FLYWEEL_DEFAULT_MCP_URL;
}

export function flyweelMetaAccountId() {
  return (process.env.FLYWEEL_META_ACCOUNT_ID?.trim() || "").replace(/^act_/, "");
}

export function flyweelConfigured() {
  return Boolean(flyweelApiKey());
}

export function requestedMetaProvider(): "auto" | "flyweel" | "meta_graph" {
  const raw = (process.env.META_ADS_PROVIDER || process.env.ACTIVE_PROVIDER || "auto")
    .trim()
    .toLowerCase();
  if (raw === "flyweel" || raw === "meta_graph" || raw === "auto") {
    return raw;
  }
  return "auto";
}

export function resolveActiveMetaProviderId(graphConfigured: boolean): ActiveMetaProviderId {
  const requested = requestedMetaProvider();
  if (requested === "flyweel") {
    return flyweelConfigured() ? "flyweel" : "none";
  }
  if (requested === "meta_graph") {
    return graphConfigured ? "meta_graph" : "none";
  }
  if (flyweelConfigured()) {
    return "flyweel";
  }
  if (graphConfigured) {
    return "meta_graph";
  }
  return "none";
}
