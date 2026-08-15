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
  id: number;
  method: string;
  params?: Record<string, unknown>;
};

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

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${this.apiKey}`,
      "x-api-key": this.apiKey,
      "mcp-protocol-version": "2024-11-05",
    };
    if (this.sessionId) {
      headers["mcp-session-id"] = this.sessionId;
    }
    return headers;
  }

  private parseBody(text: string, contentType: string): unknown {
    const trimmed = text.trim();
    if (!trimmed) {
      return null;
    }
    if (contentType.includes("text/event-stream") || trimmed.startsWith("event:") || trimmed.includes("data:")) {
      const dataLines = trimmed
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .filter(Boolean);
      const joined = dataLines.join("");
      if (joined) {
        return JSON.parse(joined);
      }
    }
    return JSON.parse(trimmed);
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
      const response = await fetch(url, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body),
      });
      const session = response.headers.get("mcp-session-id");
      if (session) {
        this.sessionId = session;
      }
      const text = await response.text();
      if (!response.ok) {
        lastError = new Error(`Flyweel MCP HTTP ${response.status}: ${text.slice(0, 400)}`);
        continue;
      }
      this.url = url;
      this.remember(text);
      let parsed: unknown;
      try {
        parsed = this.parseBody(text, response.headers.get("content-type") || "");
      } catch {
        lastError = new Error(`Flyweel MCP returned non-JSON: ${text.slice(0, 400)}`);
        continue;
      }
      const root = parsed as { error?: { message?: string; code?: number }; result?: unknown };
      if (root?.error?.message) {
        lastError = new Error(root.error.message);
        continue;
      }
      const result = root?.result ?? parsed;
      this.remember(result);
      return result;
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
    this.initialized = true;
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
