export const META_SYNC_MAX_DURATION_SECONDS = 300;
export const META_SYNC_MAX_DURATION_MS = META_SYNC_MAX_DURATION_SECONDS * 1000;
export const META_SYNC_ALREADY_RUNNING = "Meta sync already running";

export type RefreshSyncParsed = {
  ok?: boolean;
  message?: string;
  error?: string;
};

/**
 * Map /api/meta/sync HTTP results to RefreshControls copy.
 * 409 / already-running must be classified before any generic !ok failure.
 */
export function refreshMetaSyncUiMessage(input: {
  status: number;
  ok: boolean;
  parsed: RefreshSyncParsed | null;
  raw: string;
}): { message: string; alreadyRunning: boolean; shouldRefresh: boolean } {
  const parsedText = (input.parsed?.message || input.parsed?.error || "").trim();
  if (input.status === 409 || parsedText === META_SYNC_ALREADY_RUNNING) {
    return {
      message: META_SYNC_ALREADY_RUNNING,
      alreadyRunning: true,
      shouldRefresh: false,
    };
  }
  if (!input.parsed) {
    const clipped = input.raw.replace(/\s+/g, " ").trim().slice(0, 240);
    const message =
      input.status === 504 || /timeout|timed out/i.test(clipped)
        ? "Meta sync timed out (Vercel 300s). Wait, then press Refresh Meta once."
        : clipped
          ? `Refresh failed (HTTP ${input.status}): ${clipped}`
          : `Refresh failed (HTTP ${input.status}). Wait for deploy, then try again.`;
    return { message, alreadyRunning: false, shouldRefresh: false };
  }
  if (!input.ok) {
    const clipped = (parsedText || input.raw.replace(/\s+/g, " ").trim()).slice(0, 240);
    const message = clipped
      ? `Refresh failed (HTTP ${input.status}): ${clipped}`
      : `Refresh failed (HTTP ${input.status}). Wait for deploy, then try again.`;
    return { message, alreadyRunning: false, shouldRefresh: false };
  }
  const text = parsedText || `HTTP ${input.status}`;
  return {
    message: input.parsed.ok ? `Meta updated. ${text}` : text,
    alreadyRunning: false,
    shouldRefresh: Boolean(input.parsed.ok),
  };
}

export type SyncRunLike = {
  id: string;
  status: string;
  started_at: string;
  completed_at?: string | null;
};

export function isSyncActivelyRunning(
  run: SyncRunLike | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!run || run.status !== "running") return false;
  const started = Date.parse(run.started_at);
  if (!Number.isFinite(started)) return false;
  return nowMs - started < META_SYNC_MAX_DURATION_MS;
}

export function syncRunDisplayStatus(run: SyncRunLike, nowMs = Date.now()): string {
  if (run.status === "running" && !isSyncActivelyRunning(run, nowMs)) {
    return "stale/timed-out";
  }
  return run.status;
}

export function canonicalSyncRunRank(status: string): number {
  if (status === "completed") return 0;
  if (status === "partial") return 1;
  if (status === "failed") return 2;
  if (status === "queued") return 3;
  return 4;
}

export function collapseSyncRunsById<T extends SyncRunLike>(runs: T[]): T[] {
  const best = new Map<string, T>();
  for (const run of runs) {
    const prev = best.get(run.id);
    if (!prev) {
      best.set(run.id, run);
      continue;
    }
    const prevRank = canonicalSyncRunRank(prev.status);
    const nextRank = canonicalSyncRunRank(run.status);
    if (nextRank < prevRank) {
      best.set(run.id, run);
      continue;
    }
    if (nextRank > prevRank) continue;
    const prevCompleted = Date.parse(prev.completed_at || "") || 0;
    const nextCompleted = Date.parse(run.completed_at || "") || 0;
    if (nextCompleted > prevCompleted) {
      best.set(run.id, run);
      continue;
    }
    if (nextCompleted < prevCompleted) continue;
    if (Date.parse(run.started_at) >= Date.parse(prev.started_at)) {
      best.set(run.id, run);
    }
  }
  return [...best.values()].sort(
    (a, b) => Date.parse(b.started_at) - Date.parse(a.started_at),
  );
}

export function pickActiveSyncWinner<T extends SyncRunLike>(
  runs: T[],
  nowMs = Date.now(),
): T | null {
  const active = runs.filter((run) => isSyncActivelyRunning(run, nowMs));
  if (active.length === 0) return null;
  return [...active].sort((a, b) => {
    const byStart = a.started_at.localeCompare(b.started_at);
    return byStart !== 0 ? byStart : a.id.localeCompare(b.id);
  })[0];
}

export function isMetaSyncWinner<T extends SyncRunLike>(
  runs: T[],
  candidateId: string,
  nowMs = Date.now(),
): boolean {
  const winner = pickActiveSyncWinner(runs, nowMs);
  return winner?.id === candidateId;
}

export type MetaSyncObservability = {
  provider: string;
  deep_ingest_enabled: boolean;
  campaign_row_count: number;
  adset_row_count: number;
  ad_row_count: number;
  provider_requests: number;
  elapsed_ms: number;
  adset_skip?: string;
  ad_skip?: string;
  steps: string[];
  account_id?: string;
};

export function buildMetaSyncMetadata(
  input: MetaSyncObservability,
): Record<string, unknown> {
  return {
    provider: input.provider,
    deep_ingest_enabled: input.deep_ingest_enabled,
    campaign_row_count: input.campaign_row_count,
    adset_row_count: input.adset_row_count,
    ad_row_count: input.ad_row_count,
    provider_requests: input.provider_requests,
    elapsed_ms: input.elapsed_ms,
    ...(input.adset_skip ? { adset_skip: input.adset_skip } : {}),
    ...(input.ad_skip ? { ad_skip: input.ad_skip } : {}),
    steps: input.steps,
    ...(input.account_id ? { account_id: input.account_id } : {}),
  };
}
