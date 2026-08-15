import { NextResponse } from "next/server";
import { cronSecret } from "@/lib/platform/config";
import { runScheduledSync } from "@/lib/platform/orchestrator";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = cronSecret();
  if (!secret) {
    return false;
  }
  const header = request.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const query = new URL(request.url).searchParams.get("secret") || "";
  return bearer === secret || query === secret;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const source = new URL(request.url).searchParams.get("source") || "all";
  const result = await runScheduledSync(source);
  return NextResponse.json({
    ok: result.ok,
    message: result.message,
    runId: result.run?.id ?? null,
    status: result.run?.status ?? null,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
