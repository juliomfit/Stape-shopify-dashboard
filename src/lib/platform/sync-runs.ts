import { randomUUID } from "crypto";
import { readDurableJson, writeDurableJson } from "@/lib/durable-json";
import { insertRows, isPlatformBqReady, replaceRowsById, runPlatformQuery } from "@/lib/platform/bq";
import { platformTable } from "@/lib/platform/config";
import {
  collapseSyncRunsById,
  formatWarehouseFinishError,
  mergeSyncRunMetadata,
  pickActiveSyncWinner,
  WAREHOUSE_FINISH_ERROR_KEY,
} from "@/lib/platform/sync-run-state";

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
  if (isPlatformBqReady()) {
    try {
      await insertRows("sync_runs", [
        {
          id: run.id,
          source: run.source,
          sync_type: run.sync_type,
          started_at: run.started_at,
          completed_at: null,
          status: run.status,
          records_requested: 0,
          records_inserted: 0,
          records_updated: 0,
          records_failed: 0,
          lookback_start: run.lookback_start,
          lookback_end: run.lookback_end,
          error_message: null,
          metadata: run.metadata,
        },
      ]);
    } catch {
      // finishSyncRun still writes the outcome.
    }
  }
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
    let warehouseFinishError: string | null = null;
    try {
      await replaceRowsById("sync_runs", [
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
    } catch (replaceError) {
      console.error("[sync-runs] replaceRowsById failed", replaceError);
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
      } catch (insertError) {
        warehouseFinishError = formatWarehouseFinishError(replaceError, insertError);
        console.error("[sync-runs] insertRows fallback failed", warehouseFinishError);
      }
    }
    if (warehouseFinishError) {
      next.metadata = mergeSyncRunMetadata(next.metadata, {
        [WAREHOUSE_FINISH_ERROR_KEY]: warehouseFinishError,
      });
      store.runs = [next, ...store.runs.filter((row) => row.id !== run.id)].slice(0, MAX_LOCAL);
      await writeDurableJson(STORE, store);
    }
  }
  return next;
}

function asIso(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object" && value && "value" in value) {
    return String((value as { value: string }).value);
  }
  return String(value);
}

function asInt(value: unknown): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function fromBq(row: Record<string, unknown>): SyncRun {
  return {
    id: String(row.id || ""),
    source: String(row.source || ""),
    sync_type: String(row.sync_type || ""),
    started_at: asIso(row.started_at) || "",
    completed_at: asIso(row.completed_at),
    status: (String(row.status || "failed") as SyncRun["status"]),
    records_requested: asInt(row.records_requested),
    records_inserted: asInt(row.records_inserted),
    records_updated: asInt(row.records_updated),
    records_failed: asInt(row.records_failed),
    lookback_start: asIso(row.lookback_start),
    lookback_end: asIso(row.lookback_end),
    error_message: row.error_message == null ? null : String(row.error_message),
    metadata: row.metadata == null ? null : String(row.metadata),
  };
}

export async function listSyncRuns(source?: string): Promise<SyncRun[]> {
  const table = platformTable("sync_runs");
  let remote: SyncRun[] = [];
  if (table && isPlatformBqReady()) {
    try {
      const rows = await runPlatformQuery<Record<string, unknown>>(
        `SELECT id, source, sync_type, started_at, completed_at, status,
                records_requested, records_inserted, records_updated, records_failed,
                lookback_start, lookback_end, error_message, metadata
         FROM ${table}
         ${source ? "WHERE source = @source" : ""}
         ORDER BY started_at DESC
         LIMIT 80`,
        source ? { source } : undefined,
      );
      remote = rows.map(fromBq);
    } catch {
      remote = [];
    }
  }
  const store = await loadStore();
  const local = source ? store.runs.filter((run) => run.source === source) : store.runs;
  return collapseSyncRunsById([...remote, ...local]);
}

export async function findActiveSyncRun(source: string): Promise<SyncRun | null> {
  const runs = await listSyncRuns(source);
  return pickActiveSyncWinner(runs);
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
