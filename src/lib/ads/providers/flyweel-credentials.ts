import { clearDurableJson, readDurableJson, writeDurableJson } from "@/lib/durable-json";
import {
  flyweelApiKey,
  flyweelApiKeyProblem,
  flyweelMetaAccountId,
  sanitizeFlyweelApiKey,
} from "@/lib/ads/providers/config";

const STORE = "flyweel-credentials";

export type FlyweelStoredCredentials = {
  apiKey?: string;
  accountId?: string;
};

export async function readFlyweelStore(): Promise<FlyweelStoredCredentials> {
  return (await readDurableJson<FlyweelStoredCredentials>(STORE)) ?? {};
}

export async function resolveFlyweelApiKey(): Promise<string> {
  const stored = sanitizeFlyweelApiKey((await readFlyweelStore()).apiKey || "");
  if (stored) {
    return stored;
  }
  return flyweelApiKey();
}

export async function resolveFlyweelAccountId(): Promise<string> {
  const env = flyweelMetaAccountId();
  if (env) {
    return env;
  }
  return ((await readFlyweelStore()).accountId || "").replace(/^act_/, "");
}

export async function saveFlyweelCredentials(input: { apiKey?: string; accountId?: string }) {
  const current = await readFlyweelStore();
  const apiKey = input.apiKey !== undefined ? sanitizeFlyweelApiKey(input.apiKey) : current.apiKey || "";
  const accountId = (input.accountId !== undefined ? input.accountId : current.accountId || "")
    .replace(/^act_/, "")
    .trim();
  if (input.apiKey !== undefined) {
    const problem = flyweelApiKeyProblem(apiKey);
    if (problem) {
      throw new Error(problem);
    }
  }
  await writeDurableJson(STORE, { apiKey, accountId });
}

export async function clearFlyweelCredentials() {
  await clearDurableJson(STORE);
}

export function flyweelKeyHint(key: string) {
  if (!key) {
    return "";
  }
  return `fwl_…${key.slice(-4)}`;
}
