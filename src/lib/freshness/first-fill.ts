import type { FreshnessSnapshot } from "./model.ts";

export const FIRST_FILL_BACKOFF_MS = 10 * 60 * 1000;

export type FirstFillSource = "shopify" | "meta";

/**
 * Kick a background ingest only when the source has never succeeded.
 * Daily Hobby crons can miss the first day after deploy; logged-in freshness
 * polling may start the first fill without blocking page reads.
 */
export function shouldKickFirstFill(input: {
  configured: boolean;
  warehouseReady: boolean;
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  activelyRunning: boolean;
  nowMs?: number;
  backoffMs?: number;
}): boolean {
  if (!input.configured || !input.warehouseReady) return false;
  if (input.lastSuccessAt) return false;
  if (input.activelyRunning) return false;
  if (input.lastAttemptAt) {
    const started = Date.parse(input.lastAttemptAt);
    if (Number.isFinite(started)) {
      const backoff = input.backoffMs ?? FIRST_FILL_BACKOFF_MS;
      if ((input.nowMs ?? Date.now()) - started < backoff) return false;
    }
  }
  return true;
}

export function firstFillSourcesFromSnapshot(
  snapshot: FreshnessSnapshot,
  input: { warehouseReady: boolean; nowMs?: number },
): FirstFillSource[] {
  const kicks: FirstFillSource[] = [];
  for (const source of ["shopify", "meta"] as const) {
    const row = snapshot.sources.find((item) => item.source === source);
    if (!row) continue;
    if (
      shouldKickFirstFill({
        configured: row.configured,
        warehouseReady: input.warehouseReady,
        lastSuccessAt: row.last_successful_sync,
        lastAttemptAt: row.last_attempt,
        activelyRunning: row.status === "syncing",
        nowMs: input.nowMs,
      })
    ) {
      kicks.push(source);
    }
  }
  return kicks;
}
