import {
  flyweelApiKey,
  flyweelMcpUrl,
  assertFlyweelReadOnly,
} from "./config";
import { unwrapMcpToolResult } from "./normalize";

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
  readonly url: string;
  private readonly apiKey: string;

  constructor(url = flyweelMcpUrl(), apiKey = flyweelApiKey()) {
    this.url = url;
    this.apiKey = apiKey;
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
    const response = await fetch(this.url, {
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
      throw new Error(`Flyweel MCP HTTP ${response.status}: ${text.slice(0, 400)}`);
    }
    let parsed: unknown;
    try {
      parsed = this.parseBody(text, response.headers.get("content-type") || "");
    } catch {
      throw new Error(`Flyweel MCP returned non-JSON: ${text.slice(0, 400)}`);
    }
    const root = parsed as { error?: { message?: string }; result?: unknown };
    if (root?.error?.message) {
      throw new Error(root.error.message);
    }
    return root?.result ?? parsed;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }
    await this.rpc("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "goodsnova-analytics", version: "0.1.0" },
    });
    try {
      await this.rpc("notifications/initialized", {});
    } catch {
      // Some servers do not accept notifications as JSON-RPC requests.
    }
    this.initialized = true;
  }

  async listTools(): Promise<{ name: string; description?: string }[]> {
    await this.initialize();
    const result = (await this.rpc("tools/list", {})) as {
      tools?: { name: string; description?: string }[];
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
    if (
      unwrapped &&
      typeof unwrapped === "object" &&
      "isError" in unwrapped &&
      (unwrapped as { isError?: boolean }).isError
    ) {
      throw new Error(`Flyweel tool ${name} returned isError`);
    }
    return unwrapped;
  }
}
