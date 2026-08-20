import {
  nextExpectedSyncIso,
  scheduleFor,
  type FreshnessSourceId,
} from "./schedules.ts";
import { isSyncActivelyRunning, type SyncRunLike } from "../platform/sync-run-state.ts";

export type FreshnessStatus = "fresh" | "syncing" | "delayed" | "stale" | "unavailable";

export type SourceFreshness = {
  source: FreshnessSourceId | string;
  label: string;
  last_successful_sync: string | null;
  last_attempt: string | null;
  age_ms: number | null;
  status: FreshnessStatus;
  latest_error: string | null;
  next_expected_sync: string | null;
  configured: boolean;
};

export type FreshnessSnapshot = {
  version: string;
  generated_at: string;
  sources: SourceFreshness[];
  compact: {
    status: FreshnessStatus;
    label: string;
  };
};

export function ageMs(iso: string | null, nowMs = Date.now()): number | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, nowMs - parsed);
}

export function freshnessStatus(input: {
  configured: boolean;
  lastSuccessIso: string | null;
  lastAttemptIso: string | null;
  latestError: string | null;
  activelyRunning: boolean;
  intervalMs: number;
  nowMs?: number;
}): FreshnessStatus {
  if (input.activelyRunning) return "syncing";
  if (!input.configured && !input.lastSuccessIso) return "unavailable";
  if (!input.lastSuccessIso) return "unavailable";
  const age = ageMs(input.lastSuccessIso, input.nowMs);
  if (age == null) return "unavailable";
  const interval = Math.max(input.intervalMs, 60_000);
  if (age <= interval * 2) return "fresh";
  if (age <= interval * 6) return "delayed";
  return "stale";
}

export function formatFreshnessAge(age: number | null): string {
  if (age == null) return "No data yet";
  const minutes = Math.round(age / 60_000);
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `Updated ${hours}h ago`;
  const days = Math.round(hours / 24);
  return `Updated ${days}d ago`;
}

export function compactFreshnessLabel(
  sources: SourceFreshness[],
  nowMs = Date.now(),
): {
  status: FreshnessStatus;
  label: string;
} {
  const primary = sources.filter((row) => row.source === "meta" || row.source === "shopify");
  const pool = primary.length ? primary : sources;
  if (pool.some((row) => row.status === "syncing")) {
    return { status: "syncing", label: "Updating…" };
  }
  const dated = pool
    .map((row) => row.last_successful_sync)
    .filter((iso): iso is string => Boolean(iso))
    .map((iso) => Date.parse(iso))
    .filter((ms) => Number.isFinite(ms));
  if (!dated.length) {
    const unavailable = pool.every((row) => row.status === "unavailable");
    return {
      status: "unavailable",
      label: unavailable ? "No data yet" : "Waiting for first sync",
    };
  }
  const oldest = Math.min(...dated);
  const worst = pool.reduce<FreshnessStatus>((acc, row) => {
    const rank = { fresh: 0, delayed: 1, stale: 2, unavailable: 3, syncing: 4 };
    return rank[row.status] > rank[acc] ? row.status : acc;
  }, "fresh");
  return {
    status: worst === "unavailable" ? "stale" : worst,
    label: formatFreshnessAge(nowMs - oldest),
  };
}

export function buildSourceFreshness(input: {
  source: string;
  configured: boolean;
  latest: (SyncRunLike & { error_message?: string | null }) | null;
  lastSuccess: SyncRunLike | null;
  nowMs?: number;
}): SourceFreshness {
  const nowMs = input.nowMs ?? Date.now();
  const schedule = scheduleFor(input.source);
  const windowMs = schedule?.maxDurationMs;
  const activelyRunning = isSyncActivelyRunning(input.latest, nowMs, windowMs);
  const lastSuccessIso = input.lastSuccess?.completed_at ?? null;
  const lastAttemptIso = input.latest?.started_at ?? null;
  const latestError =
    input.latest && input.latest.status === "failed"
      ? input.latest.error_message || "Last sync failed."
      : null;
  const intervalMs = schedule?.intervalMs ?? 60 * 60 * 1000;
  const status = freshnessStatus({
    configured: input.configured,
    lastSuccessIso,
    lastAttemptIso,
    latestError,
    activelyRunning,
    intervalMs,
    nowMs,
  });
  return {
    source: input.source,
    label: schedule?.label || input.source,
    last_successful_sync: lastSuccessIso,
    last_attempt: lastAttemptIso,
    age_ms: ageMs(lastSuccessIso, nowMs),
    status,
    latest_error: latestError,
    next_expected_sync: nextExpectedSyncIso(lastAttemptIso, intervalMs, nowMs),
    configured: input.configured,
  };
}

export function freshnessVersion(sources: SourceFreshness[]): string {
  return sources
    .map(
      (row) =>
        `${row.source}:${row.last_successful_sync || ""}:${row.last_attempt || ""}:${row.status}`,
    )
    .join("|");
}

export function buildFreshnessSnapshot(
  sources: SourceFreshness[],
  nowMs = Date.now(),
): FreshnessSnapshot {
  return {
    version: freshnessVersion(sources),
    generated_at: new Date(nowMs).toISOString(),
    sources,
    compact: compactFreshnessLabel(sources, nowMs),
  };
}
