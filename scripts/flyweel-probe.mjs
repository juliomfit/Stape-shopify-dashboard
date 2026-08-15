/**
 * Probe Flyweel MCP with FLYWEEL_API_KEY. Read-only tools only.
 * Usage: FLYWEEL_API_KEY=fwl_... node scripts/flyweel-probe.mjs
 */
const url =
  process.env.FLYWEEL_MCP_URL?.trim() ||
  "https://api.flyweel.co/functions/v1/mcp-server/mcp";
const key = process.env.FLYWEEL_API_KEY?.trim() || "";
if (!key) {
  console.error("FLYWEEL_API_KEY is required. Cursor OAuth is not used here.");
  process.exit(1);
}

let session = "";
let id = 1;

async function rpc(method, params) {
  const headers = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    authorization: `Bearer ${key}`,
    "x-api-key": key,
  };
  if (session) headers["mcp-session-id"] = session;
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: id++, method, params }),
  });
  const next = response.headers.get("mcp-session-id");
  if (next) session = next;
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 400)}`);
  }
  return JSON.parse(text.includes("data:") ? text.split("data:").pop() : text);
}

const forbidden = new Set(["connect_ad_platform", "select_ad_accounts"]);

async function main() {
  await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "goodsnova-probe", version: "0.1.0" },
  });
  const tools = await rpc("tools/list", {});
  const names = (tools.result?.tools || []).map((t) => t.name);
  console.log("tools", names);
  for (const name of names) {
    if (forbidden.has(name)) {
      console.log("skip write tool", name);
    }
  }
  if (names.includes("list_ad_accounts")) {
    const accounts = await rpc("tools/call", {
      name: "list_ad_accounts",
      arguments: {},
    });
    console.log("accounts", JSON.stringify(accounts.result || accounts, null, 2).slice(0, 4000));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
