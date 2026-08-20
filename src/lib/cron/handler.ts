import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron/auth";
import { runDailyReconciliation, runScheduledSync } from "@/lib/platform/orchestrator";

export async function handleSourceCron(
  request: Request,
  source: "meta" | "shopify" | "ga4" | "stape" | "daily",
) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (source === "daily") {
    const result = await runDailyReconciliation();
    return NextResponse.json(result);
  }
  const result = await runScheduledSync(source, { invalidation: "swr" });
  return NextResponse.json({
    ok: result.ok,
    message: result.message,
    runId: result.run?.id ?? null,
    status: result.run?.status ?? null,
    source,
  });
}
