import {
  flyweelApiKey,
  flyweelMcpUrl,
  assertFlyweelReadOnly,
} from "./config";
import { unwrapMcpToolResult } from "./normalize";

export type McpTool = {
  name: string;
  description?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
};

type JsonRpc = {
  jsonrpc: "2.0";
  id?: number;
  method: string;
  params?: Record<string, unknown>;
};

export function parseMcpRpcBody(text: string, contentType = ""): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  const sse =
    contentType.includes("text/event-stream") ||
    trimmed.startsWith("event:") ||
    /^data:/m.test(trimmed);
  if (sse) {
    const payloads: unknown[] = [];
    const dataLines: string[] = [];
    for (const line of trimmed.split(/\r?\n/)) {
      if (!line.startsWith("data:")) {
        continue;
      }
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") {
        continue;
      }
      dataLines.push(data);
      try {
        payloads.push(JSON.parse(data));
      } catch {
        // ignore a broken event and keep looking for a result frame
      }
    }
    const rpc = [...payloads].reverse().find((payload) => {
      if (!payload || typeof payload !== "object") {
        return false;
      }
      const row = payload as { result?: unknown; error?: unknown };
      return row.result !== undefined || row.error !== undefined;
    });
    if (rpc) {
      return rpc;
    }
    if (payloads.length) {
      return payloads[payloads.length - 1];
    }
    const joined = dataLines.join("");
    if (joined) {
      try {
        return JSON.parse(joined);
      } catch {
        try {
          return JSON.parse(dataLines.join("\n"));
        } catch {
          // fall through to whole-body JSON
        }
      }
    }
  }
  return JSON.parse(trimmed);
}

export class FlyweelMcpClient {
  private sessionId = "";
  private nextId = 1;
  private initialized = false;
  requestCount = 0;
  lastRawSnippet = "";
  url: string;
  private readonly apiKey: string;
  private readonly urls: string[];

  constructor(url = flyweelMcpUrl(), apiKey = flyweelApiKey()) {
    this.apiKey = apiKey;
    const extra = url.endsWith("/mcp") ? url.slice(0, -4) : `${url.replace(/\/$/, "")}/mcp`;
    this.urls = [...new Set([url, extra])];
    this.url = this.urls[0];
  }

  configured() {
    return Boolean(this.apiKey);
  }

  private headerSets() {
    const base: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2024-11-05",
    };
    if (this.sessionId) {
      base["mcp-session-id"] = this.sessionId;
    }
    return [
      { ...base, authorization: `Bearer ${this.apiKey}`, "x-api-key": this.apiKey },
      { ...base, "x-api-key": this.apiKey },
      { ...base, authorization: `Bearer ${this.apiKey}` },
    ];
  }

  private parseBody(text: string, contentType: string): unknown {
    return parseMcpRpcBody(text, contentType);
  }

  async rpc(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.apiKey) {
      throw new Error("FLYWEEL_API_KEY is not set. Production cannot use a Cursor OAuth session.");
    }
    const body: JsonRpc = {
      jsonrpc: "2.0",
      id: this.nextId++,
      method,
      params,
    };
    this.requestCount += 1;
    let lastError: Error | null = null;
    for (const url of this.urls) {
      let auth401 = false;
      for (const headers of this.headerSets()) {
        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
        const session = response.headers.get("mcp-session-id");
        if (session) {
          this.sessionId = session;
        }
        const text = await response.text();
        if (!response.ok) {
          const invalidKey = /invalid api key|unauthorized|401/i.test(text) || response.status === 401;
          lastError = new Error(
            invalidKey
              ? "Flyweel rejected the API key. Generate a new full fwl_ key in Flyweel → Settings → API & MCP, paste it on Integrations, then Refresh Meta. The fwl_abcd… prefix in the token list is not the key."
              : `Flyweel MCP HTTP ${response.status}: ${text.slice(0, 400)}`,
          );
          if (!invalidKey) {
            break;
          }
          auth401 = true;
          continue;
        }
        this.url = url;
        this.remember(text);
        let parsed: unknown;
        try {
          parsed = this.parseBody(text, response.headers.get("content-type") || "");
        } catch {
          lastError = new Error(`Flyweel MCP returned non-JSON: ${text.slice(0, 400)}`);
          break;
        }
        const root = parsed as { error?: { message?: string; code?: number }; result?: unknown };
        if (root?.error?.message) {
          const message = root.error.message;
          lastError = new Error(
            /invalid api key/i.test(message)
              ? "Flyweel rejected the API key. Paste a new full fwl_ key on Integrations, then Refresh Meta."
              : message,
          );
          if (/invalid api key/i.test(message)) {
            auth401 = true;
            continue;
          }
          break;
        }
        const result = root?.result ?? parsed;
        this.remember(result);
        return result;
      }
      if (!auth401) {
        continue;
      }
    }
    throw lastError || new Error("Flyweel MCP request failed");
  }

  private remember(value: unknown) {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    this.lastRawSnippet = text.replace(/fwl_[A-Za-z0-9_-]+/g, "fwl_***").slice(0, 800);
  }

  async initialize() {
    if (this.initialized) {
      return;
    }
    try {
      await this.rpc("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "goodsnova-analytics", version: "0.1.0" },
      });
    } catch {
      await this.rpc("initialize");
    }
    try {
      await this.notify("notifications/initialized");
    } catch {
      // Some MCP servers ignore this notification.
    }
    this.initialized = true;
  }

  private async notify(method: string) {
    const response = await fetch(this.url, {
      method: "POST",
      headers: this.headerSets()[0],
      body: JSON.stringify({ jsonrpc: "2.0", method }),
    });
    const session = response.headers.get("mcp-session-id");
    if (session) {
      this.sessionId = session;
    }
    await response.text().catch(() => "");
  }

  async listTools(): Promise<McpTool[]> {
    await this.initialize();
    const result = (await this.rpc("tools/list", {})) as {
      tools?: McpTool[];
    };
    return result?.tools || [];
  }

  async callTool(name: string, args: Record<string, unknown> = {}) {
    assertFlyweelReadOnly(name);
    await this.initialize();
    const result = await this.rpc("tools/call", {
      name,
      arguments: args,
    });
    const unwrapped = unwrapMcpToolResult(result);
    this.remember(unwrapped);
    if (
      unwrapped &&
      typeof unwrapped === "object" &&
      "isError" in unwrapped &&
      (unwrapped as { isError?: boolean }).isError
    ) {
      throw new Error(
        `Flyweel tool ${name} returned isError: ${String((unwrapped as { message?: unknown }).message || this.lastRawSnippet).slice(0, 400)}`,
      );
    }
    return unwrapped;
  }
}
