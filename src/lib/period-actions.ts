"use server";

import { cookies } from "next/headers";
import { parseRangeDays, RANGE_COOKIE, type RangeDays } from "@/lib/period";

export async function setDashboardRange(days: RangeDays) {
  const value = parseRangeDays(String(days));
  (await cookies()).set(RANGE_COOKIE, String(value), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
