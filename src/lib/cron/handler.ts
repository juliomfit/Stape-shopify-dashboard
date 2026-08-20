import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron/auth";
import {
  runDailyReconciliation,
  runEveningIngest,
  runScheduledSync,
} from "@/lib/platform/orchestrator";

export async function handleSourceCron(
  request: Request,
  source: "meta" | "shopify" | "ga4" | "stape" | "daily" | "evening",
) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (source === "daily") {
    const result = await runDailyReconciliation();
    return NextResponse.json(result);
  }
  if (source === "evening") {
    const result = await runEveningIngest();
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
