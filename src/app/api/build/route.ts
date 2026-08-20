import { NextResponse } from "next/server";
import { publicBuildInfo } from "@/lib/build-info";

export const dynamic = "force-dynamic";

/** Ungated deploy identity so Production SHA can be verified without login. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    ...publicBuildInfo(),
  });
}
