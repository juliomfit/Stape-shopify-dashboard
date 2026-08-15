import { AI_TOOLS, aiSystemPrompt, executeAiTool } from "@/lib/ai/tools";
import { isOpenAiConfigured } from "@/lib/platform/config";
import { insertRows, isPlatformBqReady } from "@/lib/platform/bq";
import { randomUUID } from "crypto";

const MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
const MAX_OUTPUT = 900;
const MAX_TOOL_ROUNDS = 6;

type OpenAiFunctionCall = {
  type?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
};

async function openaiResponses(body: unknown) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as {
    output?: OpenAiFunctionCall[];
    output_text?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(json.error?.message || `OpenAI ${response.status}`);
  }
  return json;
}

function outputText(payload: { output?: OpenAiFunctionCall[]; output_text?: string }) {
  if (payload.output_text) {
    return payload.output_text;
  }
  const texts: string[] = [];
  for (const item of payload.output || []) {
    const content = (item as { content?: { type?: string; text?: string }[] }).content;
    for (const part of content || []) {
      if (part.type === "output_text" && part.text) {
        texts.push(part.text);
      }
    }
  }
  return texts.join("\n");
}

export async function askGoodsNovaAi(input: {
  question: string;
  viewContext?: string;
}) {
  if (!isOpenAiConfigured()) {
    return {
      ok: false,
      text: "OPENAI_API_KEY is not set. The dashboard still works without GPT.",
    };
  }

  const started = Date.now();
  const instructions = await aiSystemPrompt(input.viewContext);
  const tools = AI_TOOLS.map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    strict: false,
  }));

  let payload = await openaiResponses({
    model: MODEL,
    instructions,
    input: input.question.slice(0, 4000),
    tools,
    max_output_tokens: MAX_OUTPUT,
    store: false,
  });

  let toolCalls = 0;
  const inputItems: unknown[] = [{ role: "user", content: input.question.slice(0, 4000) }];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const calls = (payload.output || []).filter((item) => item.type === "function_call");
    if (calls.length === 0) {
      break;
    }
    const outputs: unknown[] = [];
    for (const call of calls) {
      toolCalls += 1;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.arguments || "{}") as Record<string, unknown>;
      } catch {
        args = {};
      }
      const allowed = new Set(AI_TOOLS.map((tool) => tool.name));
      if (!call.name || !allowed.has(call.name)) {
        outputs.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify({ error: "Tool not allowed" }),
        });
        continue;
      }
      const result = await executeAiTool(call.name, args);
      outputs.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(result).slice(0, 12000),
      });
    }
    inputItems.push(...(payload.output || []), ...outputs);
    payload = await openaiResponses({
      model: MODEL,
      instructions,
      input: inputItems,
      tools,
      max_output_tokens: MAX_OUTPUT,
      store: false,
    });
  }

  const text = outputText(payload) || "No response text.";
  if (isPlatformBqReady()) {
    try {
      await insertRows("openai_usage", [
        {
          id: randomUUID(),
          created_at: new Date().toISOString(),
          model: MODEL,
          input_tokens: payload.usage?.input_tokens ?? null,
          output_tokens: payload.usage?.output_tokens ?? null,
          tool_calls: toolCalls,
          latency_ms: Date.now() - started,
          estimated_usd: null,
        },
      ]);
    } catch {
      // ignore
    }
  }

  return { ok: true, text, model: MODEL, toolCalls };
}
