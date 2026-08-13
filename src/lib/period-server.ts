import { cookies } from "next/headers";
import {
  CUSTOM_RANGE_COOKIE,
  getDashboardPeriod,
  parseCustomRange,
  parseRangeKey,
  RANGE_COOKIE,
  type DashboardPeriod,
  type RangeKey,
} from "@/lib/period";

export async function getSelectedRange(): Promise<RangeKey> {
  return parseRangeKey((await cookies()).get(RANGE_COOKIE)?.value);
}

export async function getSelectedPeriod(): Promise<DashboardPeriod> {
  const jar = await cookies();
  const key = parseRangeKey(jar.get(RANGE_COOKIE)?.value);
  const custom = parseCustomRange(jar.get(CUSTOM_RANGE_COOKIE)?.value);
  return getDashboardPeriod(key, new Date(), custom);
}

/** @deprecated Use getSelectedPeriod().dayCount */
export async function getSelectedRangeDays() {
  return (await getSelectedPeriod()).dayCount;
}
