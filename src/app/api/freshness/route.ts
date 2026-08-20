import { NextResponse } from "next/server";
import { after } from "next/server";
import { isPlatformBqReady } from "@/lib/platform/bq";
import { planSourceRefresh } from "@/lib/platform/enqueue-refresh";
import { firstFillSourcesFromSnapshot } from "@/lib/freshness/first-fill";
import { getFreshnessSnapshot } from "@/lib/freshness/load";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Lightweight version/freshness check. Does not query Flyweel or heavy analytics. */
export async function GET() {
  const snapshot = await getFreshnessSnapshot();
  const firstFill = firstFillSourcesFromSnapshot(snapshot, {
    warehouseReady: isPlatformBqReady(),
  });
  if (firstFill.length > 0) {
    after(async () => {
      await Promise.allSettled(
        firstFill.map(async (source) => {
          try {
            const plan = await planSourceRefresh({ source });
            if (plan.status === 202) {
              await plan.execute();
            }
          } catch (error) {
            console.error(`[freshness] first-fill ${source} failed`, error);
          }
        }),
      );
    });
  }
  return NextResponse.json({
    ok: true,
    version: snapshot.version,
    generated_at: snapshot.generated_at,
    compact: snapshot.compact,
    sources: snapshot.sources,
    first_fill: firstFill,
  });
}
