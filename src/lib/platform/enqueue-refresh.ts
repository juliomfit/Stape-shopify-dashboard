import { invalidateCachedSources } from "@/lib/cache/invalidate";
import { runScheduledSync, syncMetaBackfill } from "@/lib/platform/orchestrator";
import { findActiveSyncRun } from "@/lib/platform/sync-runs";
import { META_SYNC_ALREADY_RUNNING } from "@/lib/platform/sync-run-state";

export type RefreshPlan = {
  status: 202 | 409;
  ok: boolean;
  message: string;
  source: string;
  execute: () => Promise<void>;
};

function alreadyRunningMessage(source: string) {
  if (source === "meta" || source === "all") {
    return META_SYNC_ALREADY_RUNNING;
  }
  if (source === "shopify") return "Shopify sync already running";
  if (source === "ga4") return "GA4 sync already running";
  if (source === "stape") return "Stape sync already running";
  if (source === "google_ads") return "Google Ads sync already running";
  return `${source} sync already running`;
}

function startedMessage(source: string) {
  if (source === "meta") return "Meta refresh started";
  if (source === "all") return "Refresh started";
  if (source === "shopify") return "Shopify refresh started";
  if (source === "ga4") return "GA4 refresh started";
  if (source === "stape") return "Stape refresh started";
  if (source === "google_ads") return "Google Ads refresh started";
  return "Refresh started";
}

async function sourceIsBusy(source: string): Promise<boolean> {
  if (source === "all") {
    return Boolean(await findActiveSyncRun("meta"));
  }
  return Boolean(await findActiveSyncRun(source));
}

/**
 * Validate and schedule provider work. The HTTP handler must return 202
 * immediately and run `execute` via Next.js `after()`.
 */
export async function planSourceRefresh(input: {
  source?: string;
  startDate?: string;
  endDate?: string;
}): Promise<RefreshPlan> {
  const source = input.source || "meta";

  if (input.startDate && input.endDate) {
    if (await sourceIsBusy("meta")) {
      return {
        status: 409,
        ok: false,
        message: META_SYNC_ALREADY_RUNNING,
        source: "meta",
        execute: async () => undefined,
      };
    }
    const startDate = input.startDate;
    const endDate = input.endDate;
    return {
      status: 202,
      ok: true,
      message: "Meta refresh started",
      source: "meta",
      execute: async () => {
        const result = await syncMetaBackfill(startDate, endDate);
        if (result.ok) {
          await invalidateCachedSources("meta", { mode: "hard" });
        }
      },
    };
  }

  if (await sourceIsBusy(source)) {
    return {
      status: 409,
      ok: false,
      message: alreadyRunningMessage(source),
      source,
      execute: async () => undefined,
    };
  }

  return {
    status: 202,
    ok: true,
    message: startedMessage(source),
    source,
    execute: async () => {
      await runScheduledSync(source, { invalidation: "hard" });
    },
  };
}
