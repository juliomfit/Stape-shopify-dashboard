import { cookies } from "next/headers";
import { parseRangeDays, RANGE_COOKIE, type RangeDays } from "@/lib/period";

export async function getSelectedRangeDays(): Promise<RangeDays> {
  return parseRangeDays((await cookies()).get(RANGE_COOKIE)?.value);
}
