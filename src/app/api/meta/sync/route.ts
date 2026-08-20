import { invalidateCachedSources } from "@/lib/cache/invalidate";
import { NextResponse } from "next/server";
import { runScheduledSync, syncMetaBackfill } from "@/lib/platform/orchestrator";
import { META_SYNC_ALREADY_RUNNING } from "@/lib/platform/sync-run-state";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500) {
  return NextResponse.json(
    { ok: false, message, error: message, runId: null, status: "failed" },
    { status },
  );
}

function jsonResult(result: {
  ok: boolean;
  message: string;
  run?: { id: string; status: string; error_message: string | null } | null;
}) {
  const alreadyRunning = result.message === META_SYNC_ALREADY_RUNNING;
  return NextResponse.json(
    {
      ok: result.ok,
      message: result.message,
      runId: result.run?.id ?? null,
      status: result.run?.status ?? (alreadyRunning ? "running" : null),
      error: result.run?.error_message ?? (alreadyRunning ? META_SYNC_ALREADY_RUNNING : null),
    },
    { status: alreadyRunning ? 409 : 200 },
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      source?: string;
      startDate?: string;
      endDate?: string;
    };
    if (body.startDate && body.endDate) {
      const result = await syncMetaBackfill(body.startDate, body.endDate);
      if (result.ok) {
        await invalidateCachedSources("meta");
      }
      return jsonResult(result);
    }
    return jsonResult(await runScheduledSync(body.source || "meta"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meta sync failed.";
    return jsonError(message);
  }
}
