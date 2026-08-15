import { randomUUID } from "crypto";
import { readDurableJson, writeDurableJson } from "@/lib/durable-json";
import { insertRows, isPlatformBqReady } from "@/lib/platform/bq";

export type SyncStatus = "queued" | "running" | "completed" | "partial" | "failed";

export type SyncRun = {
  id: string;
  source: string;
  sync_type: string;
  started_at: string;
  completed_at: string | null;
  status: SyncStatus;
  records_requested: number;
  records_inserted: number;
  records_updated: number;
  records_failed: number;
  lookback_start: string | null;
  lookback_end: string | null;
  error_message: string | null;
  metadata: string | null;
};

const STORE = "sync-runs";
const MAX_LOCAL = 80;

type Store = { runs: SyncRun[] };

async function loadStore(): Promise<Store> {
  return (await readDurableJson<Store>(STORE)) ?? { runs: [] };
}

export async function startSyncRun(input: {
  source: string;
  syncType: string;
  lookbackStart?: string;
  lookbackEnd?: string;
  metadata?: Record<string, unknown>;
}): Promise<SyncRun> {
  const run: SyncRun = {
    id: randomUUID(),
    source: input.source,
    sync_type: input.syncType,
    started_at: new Date().toISOString(),
    completed_at: null,
    status: "running",
    records_requested: 0,
    records_inserted: 0,
    records_updated: 0,
    records_failed: 0,
    lookback_start: input.lookbackStart ?? null,
    lookback_end: input.lookbackEnd ?? null,
    error_message: null,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
  };
  const store = await loadStore();
  store.runs = [run, ...store.runs].slice(0, MAX_LOCAL);
  await writeDurableJson(STORE, store);
  return run;
}

export async function finishSyncRun(
  run: SyncRun,
  patch: Partial<SyncRun>,
): Promise<SyncRun> {
  const next: SyncRun = {
    ...run,
    ...patch,
    completed_at: patch.completed_at ?? new Date().toISOString(),
  };
  const store = await loadStore();
  store.runs = [next, ...store.runs.filter((row) => row.id !== run.id)].slice(
    0,
    MAX_LOCAL,
  );
  await writeDurableJson(STORE, store);
  if (isPlatformBqReady()) {
    try {
      await insertRows("sync_runs", [
        {
          id: next.id,
          source: next.source,
          sync_type: next.sync_type,
          started_at: next.started_at,
          completed_at: next.completed_at,
          status: next.status,
          records_requested: next.records_requested,
          records_inserted: next.records_inserted,
          records_updated: next.records_updated,
          records_failed: next.records_failed,
          lookback_start: next.lookback_start,
          lookback_end: next.lookback_end,
          error_message: next.error_message,
          metadata: next.metadata,
        },
      ]);
    } catch {
      // Local history still holds. BQ writer may lack CREATE/INSERT.
    }
  }
  return next;
}

export async function listSyncRuns(source?: string): Promise<SyncRun[]> {
  const store = await loadStore();
  if (!source) {
    return store.runs;
  }
  return store.runs.filter((run) => run.source === source);
}

export async function latestSync(source: string): Promise<SyncRun | null> {
  const runs = await listSyncRuns(source);
  return runs[0] ?? null;
}

export async function latestSuccessfulSync(source: string): Promise<SyncRun | null> {
  const runs = await listSyncRuns(source);
  return (
    runs.find((run) => run.status === "completed" || run.status === "partial") ??
    null
  );
}
