import { NextResponse } from "next/server";
import { publicBuildInfo } from "@/lib/build-info";
import { getPreparedServing } from "@/lib/platform/prepared-load";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** Ungated deploy identity so Production SHA and prepared serving can be verified without login. */
export async function GET() {
  const prepared = await getPreparedServing();
  return NextResponse.json({
    ok: true,
    ...publicBuildInfo(),
    prepared,
  });
}
