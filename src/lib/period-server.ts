import { cookies } from "next/headers";
import {
  getDashboardPeriod,
  parseRangeKey,
  RANGE_COOKIE,
  type DashboardPeriod,
  type RangeKey,
} from "@/lib/period";

export async function getSelectedRange(): Promise<RangeKey> {
  return parseRangeKey((await cookies()).get(RANGE_COOKIE)?.value);
}

export async function getSelectedPeriod(): Promise<DashboardPeriod> {
  return getDashboardPeriod(await getSelectedRange());
}

/** @deprecated Use getSelectedRange */
export async function getSelectedRangeDays() {
  const key = await getSelectedRange();
  return key === "7d" ? 7 : 30;
}
