import { getSelectedPeriod } from "@/lib/period-server";
import type { DashboardPeriod } from "@/lib/period";

export type AlignedPeriod = DashboardPeriod;

export async function getAlignedPeriod(): Promise<DashboardPeriod> {
  return getSelectedPeriod();
}

export function shopifyMetricsSince(
  orderPoints: { createdAt: string; amount: number }[],
  startMs: number,
  endMs?: number,
) {
  const matched = orderPoints.filter((order) => {
    const created = new Date(order.createdAt).getTime();
    if (created < startMs) {
      return false;
    }

    if (endMs !== undefined && created >= endMs) {
      return false;
    }

    return true;
  });

  return {
    orders: matched.length,
    revenue: matched.reduce((total, order) => total + order.amount, 0),
  };
}
