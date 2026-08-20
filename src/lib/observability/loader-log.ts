export type LoaderSource = "cache" | "live" | "stale-fallback";

export function publicErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(/\s+/g, " ").trim().slice(0, 400);
  }
  return String(error).replace(/\s+/g, " ").trim().slice(0, 400);
}

export function logLoader(entry: {
  loader: string;
  elapsed_ms: number;
  source: LoaderSource;
  fallback_used: boolean;
  period?: string;
  error?: unknown;
}) {
  const payload: Record<string, unknown> = {
    kind: "loader_timing",
    loader: entry.loader,
    elapsed_ms: entry.elapsed_ms,
    source: entry.source,
    fallback_used: entry.fallback_used,
  };
  if (entry.period) {
    payload.period = entry.period;
  }
  if (entry.error !== undefined) {
    payload.error = publicErrorMessage(entry.error);
  }
  console.info(JSON.stringify(payload));
}

export function loggedFallback<T>(loader: string, fallback: T) {
  return (error: unknown): T => {
    logLoader({
      loader,
      elapsed_ms: 0,
      source: "live",
      fallback_used: true,
      error,
    });
    return fallback;
  };
}
