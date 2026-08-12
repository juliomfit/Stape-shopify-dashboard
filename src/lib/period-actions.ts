"use server";

import { cookies } from "next/headers";
import { parseRangeKey, RANGE_COOKIE, type RangeKey } from "@/lib/period";

export async function setDashboardRange(range: RangeKey) {
  const value = parseRangeKey(range);
  (await cookies()).set(RANGE_COOKIE, value, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
