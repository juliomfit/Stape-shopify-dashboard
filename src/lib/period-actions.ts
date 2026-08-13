"use server";

import { cookies } from "next/headers";
import {
  CUSTOM_RANGE_COOKIE,
  parseRangeKey,
  parseYmd,
  RANGE_COOKIE,
  serializeCustomRange,
  type RangeKey,
} from "@/lib/period";

function cookieOptions() {
  return {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax" as const,
  };
}

export async function setDashboardRange(range: RangeKey) {
  const value = parseRangeKey(range);
  const jar = await cookies();
  jar.set(RANGE_COOKIE, value, cookieOptions());
}

export async function setDashboardCustomRange(startDate: string, endDate: string) {
  const start = parseYmd(startDate);
  const end = parseYmd(endDate);
  if (!start || !end) {
    return { ok: false as const, message: "Pick a valid start and end date." };
  }

  const jar = await cookies();
  jar.set(RANGE_COOKIE, "custom", cookieOptions());
  jar.set(
    CUSTOM_RANGE_COOKIE,
    serializeCustomRange({ startDate, endDate }),
    cookieOptions(),
  );
  return { ok: true as const };
}
