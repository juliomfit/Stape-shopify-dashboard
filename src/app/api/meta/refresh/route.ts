import { NextResponse } from "next/server";
import { after } from "next/server";
import { planSourceRefresh } from "@/lib/platform/enqueue-refresh";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Manual refresh enqueue. Returns immediately (HTTP 202) and continues the
 * provider job via Next.js `after()` up to maxDuration=300.
 * Dashboard pages never call this.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      source?: string;
      startDate?: string;
      endDate?: string;
    };
    const plan = await planSourceRefresh(body);
    if (plan.status === 409) {
      return NextResponse.json(
        {
          ok: false,
          message: plan.message,
          error: plan.message,
          runId: null,
          status: "running",
        },
        { status: 409 },
      );
    }
    after(async () => {
      try {
        await plan.execute();
      } catch (error) {
        console.error("[meta-refresh] background job failed", error);
      }
    });
    return NextResponse.json(
      {
        ok: true,
        message: plan.message,
      },
      { status: 202 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refresh enqueue failed.";
    return NextResponse.json(
      { ok: false, message, error: message, runId: null, status: "failed" },
      { status: 500 },
    );
  }
}
