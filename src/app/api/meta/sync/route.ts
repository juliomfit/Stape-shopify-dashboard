import { NextResponse } from "next/server";
import { runScheduledSync, syncMetaBackfill } from "@/lib/platform/orchestrator";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500) {
  return NextResponse.json(
    { ok: false, message, error: message, runId: null, status: "failed" },
    { status },
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
      return NextResponse.json({
        ok: result.ok,
        message: result.message,
        runId: result.run?.id ?? null,
        status: result.run?.status ?? null,
        error: result.run?.error_message ?? null,
      });
    }
    const result = await runScheduledSync(body.source || "meta");
    return NextResponse.json({
      ok: result.ok,
      message: result.message,
      runId: result.run?.id ?? null,
      status: result.run?.status ?? null,
      error: result.run?.error_message ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meta sync failed.";
    return jsonError(message);
  }
}
