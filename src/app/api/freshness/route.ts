import { NextResponse } from "next/server";
import { getFreshnessSnapshot } from "@/lib/freshness/load";

export const dynamic = "force-dynamic";

/** Lightweight version/freshness check. Does not query Flyweel or heavy analytics. */
export async function GET() {
  const snapshot = await getFreshnessSnapshot();
  return NextResponse.json({
    ok: true,
    version: snapshot.version,
    generated_at: snapshot.generated_at,
    compact: snapshot.compact,
    sources: snapshot.sources,
  });
}
