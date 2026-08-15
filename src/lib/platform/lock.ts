import { readDurableJson, writeDurableJson } from "@/lib/durable-json";

type Lock = {
  source: string;
  runId: string;
  startedAt: string;
};

const STORE = "sync-locks";
const TTL_MS = 12 * 60 * 1000;

export async function acquireSyncLock(source: string, runId: string): Promise<boolean> {
  const locks = (await readDurableJson<Record<string, Lock>>(STORE)) ?? {};
  const existing = locks[source];
  if (existing) {
    const age = Date.now() - new Date(existing.startedAt).getTime();
    if (age < TTL_MS) {
      return false;
    }
  }
  locks[source] = { source, runId, startedAt: new Date().toISOString() };
  await writeDurableJson(STORE, locks);
  return true;
}

export async function releaseSyncLock(source: string) {
  const locks = (await readDurableJson<Record<string, Lock>>(STORE)) ?? {};
  delete locks[source];
  await writeDurableJson(STORE, locks);
}
